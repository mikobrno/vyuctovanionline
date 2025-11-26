'use client'

import { useState, useEffect, useMemo, useRef, Fragment, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { Service as PrismaService, Unit as PrismaUnit, Cost as PrismaCost } from '@prisma/client'

type BillingService = PrismaService & {
  method?: PrismaService['methodology']
  userMergeWithNext?: boolean
}

type BillingUnit = PrismaUnit & {
  owners?: { lastName?: string }[]
  meters?: Array<{ type?: string | null; isActive?: boolean; readings?: Array<{ consumption?: number | null; value?: number | null; precalculatedCost?: number | null }> }>
  personMonths?: Array<{ personCount: number }>
  parameters?: Array<{ name: string; value: number }>
}

type BillingCost = PrismaCost

type GlobalOverrideState = Record<string, { buildingUnits?: string; share?: string; manualCost?: string }>
type UnitOverrideState = Record<string, Record<string, { userUnits?: string; advance?: string }>>

type ManualOverridesSnapshot = {
  global?: GlobalOverrideState
  unit?: UnitOverrideState
} | null

type ServiceSnapshot = {
  serviceId?: string
  code: string
  name?: string
  methodology?: string
  method?: string
  order?: number
  dataSourceType?: string | null
  dataSourceName?: string | null
  dataSourceColumn?: string | null
  unitAttributeName?: string | null
  measurementUnit?: string | null
  unitPrice?: number | string | null
  fixedAmountPerUnit?: number | string | null
  divisor?: number | string | null
  manualCost?: number | string | null
  manualShare?: number | string | null
  customFormula?: string | null
  userMergeWithNext?: boolean
  showOnStatement?: boolean
  isActive?: boolean
  advancePaymentColumn?: string | null
  excelColumn?: string | null
  groupShareLabel?: string | null
}

type ConfigVersionSummary = {
  id: string
  name: string
  description?: string | null
  createdAt: string
  isDefault?: boolean
}

const parseVersionConfigPayload = (raw: unknown): { services: ServiceSnapshot[]; manualOverrides: ManualOverridesSnapshot } => {
  if (Array.isArray(raw)) {
    return { services: raw as ServiceSnapshot[], manualOverrides: null }
  }

  if (raw && typeof raw === 'object') {
    const candidate = raw as { services?: ServiceSnapshot[]; manualOverrides?: ManualOverridesSnapshot }
    if (Array.isArray(candidate.services)) {
      return { services: candidate.services, manualOverrides: candidate.manualOverrides ?? null }
    }
  }

  return { services: [], manualOverrides: null }
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const mergeServiceSnapshot = (service: BillingService, snapshot: ServiceSnapshot): BillingService => {
  const resolvedMethod = (snapshot.methodology ?? snapshot.method ?? service.method ?? service.methodology) as BillingService['method']
  const nextMethod = resolvedMethod ?? service.methodology
  return {
    ...service,
    method: nextMethod,
    methodology: nextMethod ?? service.methodology,
    order: snapshot.order ?? service.order,
    dataSourceType: (snapshot.dataSourceType as BillingService['dataSourceType']) ?? service.dataSourceType,
    dataSourceName: snapshot.dataSourceName ?? service.dataSourceName,
    dataSourceColumn: snapshot.dataSourceColumn ?? service.dataSourceColumn,
    unitAttributeName: snapshot.unitAttributeName ?? service.unitAttributeName,
    measurementUnit: snapshot.measurementUnit ?? service.measurementUnit,
    unitPrice: toNullableNumber(snapshot.unitPrice) ?? service.unitPrice,
    fixedAmountPerUnit: toNullableNumber(snapshot.fixedAmountPerUnit) ?? service.fixedAmountPerUnit,
    divisor: toNullableNumber(snapshot.divisor) ?? service.divisor,
    manualCost: toNullableNumber(snapshot.manualCost) ?? service.manualCost,
    manualShare: toNullableNumber(snapshot.manualShare) ?? service.manualShare,
    customFormula: snapshot.customFormula ?? service.customFormula,
    userMergeWithNext: snapshot.userMergeWithNext ?? service.userMergeWithNext,
    showOnStatement: snapshot.showOnStatement ?? service.showOnStatement,
    isActive: snapshot.isActive ?? service.isActive,
    advancePaymentColumn: snapshot.advancePaymentColumn ?? service.advancePaymentColumn,
    excelColumn: snapshot.excelColumn ?? service.excelColumn,
    groupShareLabel: snapshot.groupShareLabel ?? service.groupShareLabel,
  }
}

interface BillingSettingsEditorProps {
  buildingId: string
  services: BillingService[]
  units: BillingUnit[]
  costs: BillingCost[]
}

type BillingResultSummary = {
  id: string
  totalCost: number
  totalAdvancePrescribed: number
  totalAdvancePaid: number
  repairFund: number
  result: number
}

export default function BillingSettingsEditor({ buildingId, services, units, costs }: BillingSettingsEditorProps) {
  const router = useRouter()
  const [localServices, setLocalServices] = useState<BillingService[]>(services)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || '')
  const [showHiddenServices, setShowHiddenServices] = useState(false)
  const [saving, setSaving] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1)
  
  // State pro verze
  const [versions, setVersions] = useState<ConfigVersionSummary[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [appliedDefaultVersionId, setAppliedDefaultVersionId] = useState<string | null>(null)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [savingVersion, setSavingVersion] = useState(false)
  const [newVersionAsDefault, setNewVersionAsDefault] = useState(false)

  // State pro import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  // State pro editor vzorců
  const [editingFormulaServiceId, setEditingFormulaServiceId] = useState<string | null>(null)
  const [editingFormulaMode, setEditingFormulaMode] = useState<'COST' | 'PRICE'>('COST')
  const [tempFormula, setTempFormula] = useState('')

  // State pro konfiguraci měřidel
  const [editingMeterServiceId, setEditingMeterServiceId] = useState<string | null>(null)
  const [tempMeterTypes, setTempMeterTypes] = useState<string[]>([])
  const [tempMeterSourceColumn, setTempMeterSourceColumn] = useState<string>('consumption')

  // State pro zálohy
  const [advancesData, setAdvancesData] = useState<Record<string, Record<string, { total: number }>>>({})
  const [advancePayments, setAdvancePayments] = useState<Record<string, Record<string, number>>>({})
  const [billingSummary, setBillingSummary] = useState<{ current: BillingResultSummary | null; previous: BillingResultSummary | null } | null>(null)
  const [billingSummaryLoading, setBillingSummaryLoading] = useState(false)
  
  // State pro manuální přepisy hodnot
  // Global overrides: [serviceId]: { buildingUnits?: string, share?: string, manualCost?: string }
  const [globalOverrides, setGlobalOverrides] = useState<GlobalOverrideState>({})
  // Unit overrides: [unitId]: { [serviceId]: { userUnits?: string, advance?: string } }
  const [unitOverrides, setUnitOverrides] = useState<UnitOverrideState>({})

  const fetchConfigVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions`)
      if (!res.ok) throw new Error('Failed to load versions')
      const data: ConfigVersionSummary[] = await res.json()
      setVersions(data)
      setSelectedVersionId(prev => (prev && data.some(v => v.id === prev) ? prev : ''))
    } catch (error) {
      console.error('Failed to load versions', error)
    }
  }, [buildingId])

  const loadVersion = useCallback(async (versionId: string, options?: { skipConfirm?: boolean }) => {
    if (!versionId) return
    if (!options?.skipConfirm && !confirm('Opravdu chcete načíst tuto verzi? Neuložené změny budou ztraceny.')) return

    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${versionId}`)
      if (!res.ok) throw new Error('Nepodařilo se načíst verzi')
      const data = await res.json()
      const parsed = parseVersionConfigPayload(data?.config)

      const overrides = parsed.manualOverrides
      if (overrides) {
        if (overrides.global) {
          setGlobalOverrides(overrides.global)
        } else {
          setGlobalOverrides(overrides as GlobalOverrideState)
        }
        setUnitOverrides(overrides.unit ?? {})
      } else {
        setGlobalOverrides({})
        setUnitOverrides({})
      }

      setLocalServices(prev => {
        if (!parsed.services.length) return prev
        const snapshotMap = new Map<string, ServiceSnapshot>()
        parsed.services.forEach(snapshot => {
          const key = snapshot.serviceId ?? snapshot.code
          snapshotMap.set(key, snapshot)
        })
        const updated = prev.map(service => {
          const snapshot = snapshotMap.get(service.id) ?? snapshotMap.get(service.code)
          if (!snapshot) return service
          return mergeServiceSnapshot(service, snapshot)
        })
        return updated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      })
    } catch (error) {
      console.error('Failed to load version', error)
      alert('Chyba při načítání verze')
    }
  }, [buildingId])

  useEffect(() => {
    fetchConfigVersions()
  }, [fetchConfigVersions])

  useEffect(() => {
    if (!versions.length || !localServices.length) return
    const defaultVersion = versions.find(v => v.isDefault)
    if (!defaultVersion) return
    if (appliedDefaultVersionId === defaultVersion.id) return
    setSelectedVersionId(defaultVersion.id)
    loadVersion(defaultVersion.id, { skipConfirm: true })
    setAppliedDefaultVersionId(defaultVersion.id)
  }, [versions, localServices.length, appliedDefaultVersionId, loadVersion])

  const selectedVersion = useMemo(() => versions.find(v => v.id === selectedVersionId) ?? null, [versions, selectedVersionId])

  const formatCurrencyValue = (value: number | null | undefined, fractionDigits = 2) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    return `${value.toLocaleString('cs-CZ', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    })} Kč`
  }

  useEffect(() => {
    // Transform methodology -> method for component compatibility
    const transformedServices = services.map(s => ({
      ...s,
      method: s.methodology || s.method || 'OWNERSHIP_SHARE',
      userMergeWithNext: Boolean(s.userMergeWithNext)
    }))
    setLocalServices(transformedServices)
    // Initialize global overrides from service configuration (divisor, manualCost, manualShare)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialOverrides: Record<string, any> = {}
    transformedServices.forEach(s => {
      if (s.divisor || s.manualCost !== null || s.manualShare !== null) {
        initialOverrides[s.id] = { 
          buildingUnits: s.divisor?.toString(),
          manualCost: s.manualCost?.toString(),
          share: s.manualShare?.toString()
        }
      }
    })
    setGlobalOverrides(prev => ({ ...prev, ...initialOverrides }))
  }, [services])

  // Načtení verzí
  useEffect(() => {
    fetch(`/api/buildings/${buildingId}/config-versions`)
      .then(res => res.json())
      .then(data => setVersions(data))
      .catch(err => console.error('Failed to load versions', err))
  }, [buildingId])

  // Načtení záloh
  useEffect(() => {
    fetch(`/api/buildings/${buildingId}/advances?year=${year}`)
      .then(res => res.json())
      .then(json => {
        setAdvancesData(json.data || {})
        setAdvancePayments(json.paidByUnitService || {})
      })
      .catch(err => console.error('Failed to load advances', err))
  }, [buildingId, year])

  useEffect(() => {
    if (!selectedUnitId || !year) {
      setBillingSummary(null)
      return
    }

    const controller = new AbortController()
    setBillingSummaryLoading(true)

    fetch(`/api/buildings/${buildingId}/unit-billing-summary?unitId=${selectedUnitId}&year=${year}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Nepodařilo se načíst souhrn vyúčtování')
        }
        return res.json()
      })
      .then((json) => {
        setBillingSummary({
          current: json.current ?? null,
          previous: json.previous ?? null
        })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error('Failed to load billing summary', err)
        setBillingSummary(null)
      })
      .finally(() => setBillingSummaryLoading(false))

    return () => controller.abort()
  }, [buildingId, selectedUnitId, year])

  useEffect(() => {
    if (units.length > 0 && !selectedUnitId) {
      setSelectedUnitId(units[0].id)
    }
  }, [units, selectedUnitId])

  const selectedUnit = useMemo(() => units.find(u => u.id === selectedUnitId) || units[0], [units, selectedUnitId])

  // Filtrování nákladů podle roku
  const filteredCosts = useMemo(() => {
    return costs.filter(c => {
      // Pokud existuje period (rok vyúčtování), použijeme ten
      if (c.period !== undefined && c.period !== null) {
        return Number(c.period) === Number(year)
      }
      // Fallback na datum faktury
      const costDate = new Date(c.invoiceDate || c.createdAt)
      return costDate.getFullYear() === year
    })
  }, [costs, year])

  // Zjištění data posledního importu (podle data vytvoření nákladů)
  const lastImportDate = useMemo(() => {
    if (filteredCosts.length === 0) return null
    const dates = filteredCosts.map(c => new Date(c.createdAt).getTime())
    const maxDate = Math.max(...dates)
    return new Date(maxDate)
  }, [filteredCosts])

  const totalPrescribedAdvances = useMemo(() => {
    const unitAdvances = advancesData[selectedUnitId]
    if (!unitAdvances) return 0
    return Object.values(unitAdvances).reduce((sum, service) => sum + (service?.total || 0), 0)
  }, [advancesData, selectedUnitId])

  const totalPaidAdvances = useMemo(() => {
    const unitPaid = advancePayments[selectedUnitId]
    if (!unitPaid) return 0
    return Object.values(unitPaid).reduce((sum, amount) => sum + (amount || 0), 0)
  }, [advancePayments, selectedUnitId])

  const hasAdvanceSnapshot = useMemo(() => totalPrescribedAdvances !== 0 || totalPaidAdvances !== 0, [totalPrescribedAdvances, totalPaidAdvances])

  const advancePaymentDifference = useMemo(() => {
    if (!hasAdvanceSnapshot) return null
    return totalPrescribedAdvances - totalPaidAdvances
  }, [hasAdvanceSnapshot, totalPrescribedAdvances, totalPaidAdvances])

  const currentResultAmount = billingSummary?.current?.result ?? null
  const previousResultAmount = billingSummary?.previous?.result ?? null
  const currentTrend = currentResultAmount === null ? 0 : currentResultAmount > 0 ? 1 : currentResultAmount < 0 ? -1 : 0
  const previousTrend = previousResultAmount === null ? 0 : previousResultAmount > 0 ? 1 : previousResultAmount < 0 ? -1 : 0
  const fallbackTrend = advancePaymentDifference === null
    ? 0
    : advancePaymentDifference > 0
      ? -1
      : advancePaymentDifference < 0
        ? 1
        : 0
  const displayedCurrentTrend = currentResultAmount !== null ? currentTrend : fallbackTrend
  const displayedCurrentAmount = (() => {
    if (currentResultAmount !== null) return formatCurrencyValue(currentResultAmount)
    if (advancePaymentDifference !== null) return formatCurrencyValue(Math.abs(advancePaymentDifference))
    return '—'
  })()
  const isFallbackCurrentSummary = currentResultAmount === null && advancePaymentDifference !== null

  const currentAdvancePrescribed = billingSummary?.current?.totalAdvancePrescribed ?? (hasAdvanceSnapshot ? totalPrescribedAdvances : null)
  const currentAdvancePaid = billingSummary?.current?.totalAdvancePaid ?? (hasAdvanceSnapshot ? totalPaidAdvances : null)
  const currentFallbackSinglePayment = isFallbackCurrentSummary && advancePaymentDifference !== null
    ? Math.abs(advancePaymentDifference)
    : null

  const currentSummaryLabel = (() => {
    if (currentResultAmount !== null) {
      if (currentResultAmount < 0) return 'Nedoplatek v účtovaném období'
      if (currentResultAmount > 0) return 'Přeplatek v účtovaném období'
      return 'Vyrovnané vyúčtování'
    }
    if (advancePaymentDifference !== null) {
      if (advancePaymentDifference > 0) return 'Chybí doplatit na zálohách'
      if (advancePaymentDifference < 0) return 'Zálohy uhrazeny nad rámec předpisu'
      return 'Zálohy uhrazeny přesně dle předpisu'
    }
    return 'Pro zvolený rok zatím není uložené vyúčtování'
  })()

  const previousSummaryLabel = billingSummary?.previous
    ? previousTrend > 0
      ? 'Je evidován v minulém období přeplatek'
      : previousTrend < 0
        ? 'Je evidován v minulém období nedoplatek'
        : 'Není evidován v minulém období přeplatek ani nedoplatek'
    : 'Není evidován v minulém období přeplatek ani nedoplatek'

  // Pomocná funkce pro získání kontextu výpočtu (proměnných)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCalculationContext = (service: any, unitId: string) => {
    const unit = units.find(u => u.id === unitId)
    if (!unit) return null

    const totalCost = filteredCosts
      .filter(c => c.serviceId === service.id)
      .reduce((sum, c) => sum + c.amount, 0)

    let unitConsumption = 0
    let totalConsumption = 0
    
    const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV')
    const isHeating = service.name.toLowerCase().includes('teplo')
    
    // Celková spotřeba
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    units.forEach((u: any) => {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       const uMeters = u.meters?.filter((m: any) => {
           if (isWater) return (m.type === 'COLD_WATER' || m.type === 'HOT_WATER');
           if (isHeating) return (m.type === 'HEATING');
           return false;
       }) || []
       
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       uMeters.forEach((m: any) => {
           if (m.readings && m.readings[0]) {
               totalConsumption += (m.readings[0].consumption ?? m.readings[0].value ?? 0)
           }
       })
    })

    // Spotřeba jednotky
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedUnitMeters = unit.meters?.filter((m: any) => {
       if (isWater) return (m.type === 'COLD_WATER' || m.type === 'HOT_WATER');
       if (isHeating) return (m.type === 'HEATING');
       return false;
    }) || []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedUnitMeters.forEach((m: any) => {
        if (m.readings && m.readings[0]) {
            unitConsumption += (m.readings[0].consumption ?? m.readings[0].value ?? 0)
        }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalArea = units.reduce((sum, u: any) => sum + (u.totalArea || 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalPeople = units.reduce((sum, u: any) => sum + (u.residents || 0), 0)
    const unitCount = units.length

    const context: Record<string, number> = {
      TOTAL_COST: totalCost,
      UNIT_SHARE: unit.shareDenominator ? (unit.shareNumerator / unit.shareDenominator) : 0,
      UNIT_AREA: unit.totalArea || 0,
      UNIT_PEOPLE: unit.residents || 0,
      UNIT_CONSUMPTION: unitConsumption,
      TOTAL_CONSUMPTION: totalConsumption,
      TOTAL_AREA: totalArea,
      TOTAL_PEOPLE: totalPeople,
      UNIT_COUNT: unitCount
    }

    // Přidání hodnot z ostatních řádků (D, E, G)
    localServices.forEach((s, idx) => {
      const rowNum = idx + 1
      const baseValues = calculateBaseValues(s, unit)
      context[`D${rowNum}`] = baseValues.totalCost
      context[`E${rowNum}`] = baseValues.buildingAmount
      context[`G${rowNum}`] = baseValues.unitAmount
    })

    return context
  }

  // Otevření editoru vzorců
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openFormulaEditor = (service: any, mode: 'COST' | 'PRICE' = 'COST') => {
    setEditingFormulaServiceId(service.id)
    setEditingFormulaMode(mode)
    
    if (service.customFormula && mode === 'COST') {
      setTempFormula(service.customFormula)
    } else {
      // Předvyplnění vzorce podle aktuální metody
      const currentRow = localServices.findIndex(s => s.id === service.id) + 1
      
      if (mode === 'PRICE') {
        // Pro cenu za jednotku předvyplníme D/E
        setTempFormula(`D${currentRow} / E${currentRow}`)
      } else {
        switch (service.method) {
          case 'OWNERSHIP_SHARE':
            setTempFormula('TOTAL_COST * UNIT_SHARE')
            break
          case 'AREA':
            setTempFormula('UNIT_AREA * (TOTAL_COST / TOTAL_AREA)')
            break
          case 'PERSON_MONTHS':
            setTempFormula('UNIT_PEOPLE * (TOTAL_COST / TOTAL_PEOPLE)')
            break
          case 'METER_READING':
            setTempFormula('UNIT_CONSUMPTION * (TOTAL_COST / TOTAL_CONSUMPTION)')
            break
          case 'EQUAL_SPLIT':
            setTempFormula('TOTAL_COST / UNIT_COUNT')
            break
          default:
            setTempFormula('')
        }
      }
    }
  }

  const insertIntoFormula = (text: string) => {
    setTempFormula(prev => prev + text)
  }

  const saveFormulaFromEditor = async () => {
    if (!editingFormulaServiceId) return
    
    let finalFormula = tempFormula
    if (editingFormulaMode === 'PRICE') {
      // Pokud editujeme cenu, obalíme vzorec do výpočtu celkové ceny
      // Cena * Jednotky (byt)
      const currentRow = localServices.findIndex(s => s.id === editingFormulaServiceId) + 1
      finalFormula = `(${tempFormula}) * G${currentRow}`
    }

    // Update local state
    setLocalServices(prev => prev.map(s => s.id === editingFormulaServiceId ? { ...s, customFormula: finalFormula, method: 'CUSTOM' } : s))
    setEditingFormulaServiceId(null)
  }

  // Otevření konfigurace měřidel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openMeterConfig = (service: any) => {
    setEditingMeterServiceId(service.id)
    // Parse existing config or default
    let types: string[] = []
    if (service.dataSourceName) {
      types = service.dataSourceName.split('+')
    } else {
      // Default fallback based on code
      const meterTypeMap: Record<string, string> = {
        'TEPLO': 'HEATING',
        'TUV': 'HOT_WATER',
        'SV': 'COLD_WATER',
        'ELEKTRINA': 'ELECTRICITY',
        'VODA': 'COLD_WATER',
        'VODNE': 'COLD_WATER',
      }
      let defaultType = meterTypeMap[service.code]
      if (!defaultType) {
         const code = service.code.toUpperCase()
         const name = service.name.toLowerCase()
         if (code.includes('VOD') || name.includes('vod') || name.includes('studen')) defaultType = 'COLD_WATER'
         else if (code.includes('TUV') || name.includes('tuv') || name.includes('teplá') || name.includes('tepla')) defaultType = 'HOT_WATER'
         else if (code.includes('TEP') || name.includes('tep') || name.includes('topen')) defaultType = 'HEATING'
         else if (code.includes('ELE') || name.includes('ele')) defaultType = 'ELECTRICITY'
         else defaultType = 'HEATING'
      }
      if (defaultType) types = [defaultType]
    }
    setTempMeterTypes(types)
    setTempMeterSourceColumn(service.dataSourceColumn || 'consumption')
  }

  const toggleMeterType = (type: string) => {
    setTempMeterTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const saveMeterConfig = async () => {
    if (!editingMeterServiceId) return
    const newDataSourceName = tempMeterTypes.join('+')
    const serviceToUpdate = localServices.find(s => s.id === editingMeterServiceId)
    setLocalServices(prev => prev.map(s => s.id === editingMeterServiceId ? { 
      ...s, 
      dataSourceName: newDataSourceName,
      dataSourceColumn: tempMeterSourceColumn,
      dataSourceType: 'METER_DATA'
    } : s))

    if (serviceToUpdate) {
      try {
        await fetch(`/api/buildings/${buildingId}/services/${editingMeterServiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: serviceToUpdate.name,
            code: serviceToUpdate.code,
            methodology: serviceToUpdate.methodology || serviceToUpdate.method || 'METER_READING',
            dataSourceType: 'METER_DATA',
            dataSourceName: newDataSourceName,
            dataSourceColumn: tempMeterSourceColumn,
            unitAttributeName: serviceToUpdate.unitAttributeName || null,
            measurementUnit: serviceToUpdate.measurementUnit || null,
            unitPrice: serviceToUpdate.unitPrice ?? null,
            fixedAmountPerUnit: serviceToUpdate.fixedAmountPerUnit ?? null,
            divisor: serviceToUpdate.divisor ?? null,
            customFormula: serviceToUpdate.customFormula || null,
            advancePaymentColumn: serviceToUpdate.advancePaymentColumn || null,
            showOnStatement: serviceToUpdate.showOnStatement !== false,
            isActive: serviceToUpdate.isActive !== false,
            order: serviceToUpdate.order ?? 0,
            userMergeWithNext: serviceToUpdate.userMergeWithNext || false,
          })
        })
        router.refresh()
      } catch (error) {
        console.error('Failed to save meter configuration', error)
      }
    }

    setEditingMeterServiceId(null)
  }

  // Pomocné výpočty pro celý dům
  const buildingStats = useMemo(() => {
    const totalArea = units.reduce((sum, u) => sum + (u.totalArea || 0), 0)
    const totalPersonMonths = units.reduce((sum, u) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pmSum = u.personMonths?.reduce((s: number, pm: any) => s + pm.personCount, 0) || 0
      return sum + pmSum
    }, 0)
    const unitCount = units.length
    
    // Spotřeby pro měřidla
    const consumptionByService: Record<string, number> = {}
    localServices.forEach(service => {
      if (service.method === 'METER_READING') {
        let typesToSum: string[] = []
        
        if (service.dataSourceName) {
          typesToSum = service.dataSourceName.split('+')
        } else {
          const meterTypeMap: Record<string, string> = {
            'TEPLO': 'HEATING',
            'TUV': 'HOT_WATER',
            'SV': 'COLD_WATER',
            'ELEKTRINA': 'ELECTRICITY',
            'VODA': 'COLD_WATER',
            'VODNE': 'COLD_WATER',
          }
          let t = meterTypeMap[service.code]
          if (!t) {
             const code = service.code.toUpperCase()
             const name = service.name.toLowerCase()
             if (code.includes('VOD') || name.includes('vod') || name.includes('studen')) t = 'COLD_WATER'
             else if (code.includes('TUV') || name.includes('tuv') || name.includes('teplá') || name.includes('tepla')) t = 'HOT_WATER'
             else if (code.includes('TEP') || name.includes('tep') || name.includes('topen')) t = 'HEATING'
             else if (code.includes('ELE') || name.includes('ele')) t = 'ELECTRICITY'
             else t = 'HEATING'
          }
          typesToSum = [t]
        }
        
        const useCost = service.dataSourceColumn === 'precalculatedCost'

        const totalConsumption = units.reduce((sum, u) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unitMeters = u.meters?.filter((m: any) => typesToSum.includes(m.type) && m.isActive) || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unitSum = unitMeters.reduce((s: number, m: any) => {
             const reading = m.readings?.[0]
             if (!reading) return s
             if (useCost) {
                return s + (reading.precalculatedCost || 0)
             }
             return s + (reading.consumption || 0)
          }, 0)
          return sum + unitSum
        }, 0)
        consumptionByService[service.id] = totalConsumption
      }
    })

    return { totalArea, totalPersonMonths, unitCount, consumptionByService }
  }, [units, localServices])

  // Výpočet základních hodnot pro službu (D, E, G)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculateBaseValues = (service: any, unit: any) => {
    if (!unit) return { totalCost: 0, buildingAmount: 0, unitAmount: 0 }

    const gOverride = globalOverrides[service.id]
    const isMeterCost = service.method === 'METER_READING' && service.dataSourceColumn === 'precalculatedCost'
    let totalCost = 0

    // 1. Určení základního nákladu (z DB nebo manuální přepis)
    if (gOverride?.manualCost && !isNaN(parseFloat(gOverride.manualCost))) {
      totalCost = parseFloat(gOverride.manualCost)
    } else {
      totalCost = filteredCosts
        .filter(c => c.serviceId === service.id)
        .reduce((sum, c) => sum + c.amount, 0)
    }

    // Aplikace podílu služby (Service Share) - default 100%
    let serviceShare = 100
    if (gOverride?.share && !isNaN(parseFloat(gOverride.share))) {
      serviceShare = parseFloat(gOverride.share)
    }
    totalCost = totalCost * (serviceShare / 100)

    let buildingAmount = 0
    let unitAmount = 0

    switch (service.method) {
      case 'OWNERSHIP_SHARE':
        buildingAmount = 100
        unitAmount = ((unit.shareNumerator || 0) / (unit.shareDenominator || 1)) * 100
        break
      case 'AREA':
        buildingAmount = buildingStats.totalArea
        unitAmount = unit.totalArea || 0
        break
      case 'PERSON_MONTHS':
        buildingAmount = buildingStats.totalPersonMonths
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unitAmount = unit.personMonths?.reduce((s: number, pm: any) => s + pm.personCount, 0) || 0
        break
      case 'EQUAL_SPLIT':
        buildingAmount = buildingStats.unitCount
        unitAmount = 1
        break
      case 'METER_READING':
        let typesToSum: string[] = []
        if (service.dataSourceName) {
          typesToSum = service.dataSourceName.split('+')
        } else {
          const meterTypeMap: Record<string, string> = {
            'TEPLO': 'HEATING',
            'TUV': 'HOT_WATER',
            'SV': 'COLD_WATER',
            'ELEKTRINA': 'ELECTRICITY',
            'VODA': 'COLD_WATER',
            'VODNE': 'COLD_WATER',
          }
          let t = meterTypeMap[service.code]
          if (!t) {
             const code = service.code.toUpperCase()
             const name = service.name.toLowerCase()
             if (code.includes('VOD') || name.includes('vod') || name.includes('studen')) t = 'COLD_WATER'
             else if (code.includes('TUV') || name.includes('tuv') || name.includes('teplá') || name.includes('tepla')) t = 'HOT_WATER'
             else if (code.includes('TEP') || name.includes('tep') || name.includes('topen')) t = 'HEATING'
             else if (code.includes('ELE') || name.includes('ele')) t = 'ELECTRICITY'
             else t = 'HEATING'
          }
          typesToSum = [t]
        }
        
        const useCost = service.dataSourceColumn === 'precalculatedCost'
        
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unitMeters = unit.meters?.filter((m: any) => typesToSum.includes(m.type) && m.isActive) || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unitSum = unitMeters.reduce((s: number, m: any) => {
           const reading = m.readings?.[0]
           if (!reading) return s
           if (useCost) {
              return s + (reading.precalculatedCost || 0)
           }
           return s + (reading.consumption || 0)
        }, 0)
        
        buildingAmount = buildingStats.consumptionByService[service.id] || 0
        unitAmount = unitSum
        break
      case 'FIXED_PER_UNIT':
        buildingAmount = 0
        unitAmount = 1
        break
      case 'UNIT_PARAMETER':
        const paramName = service.unitAttributeName
        if (paramName) {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const param = unit.parameters?.find((p: any) => p.name === paramName)
           const val = param ? param.value : 0
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const totalParamValue = units.reduce((sum, u: any) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const p = u.parameters?.find((p: any) => p.name === paramName)
              return sum + (p ? p.value : 0)
           }, 0)
           buildingAmount = totalParamValue
           unitAmount = val
        }
        break
      case 'CUSTOM':
        // Pro CUSTOM metodu se snažíme odhadnout E a G, pokud to jde, jinak 1
        // Zde bychom mohli implementovat logiku pro "fallback" na původní metodu,
        // ale pro jednoduchost necháme 1, pokud není explicitně definováno jinak
        buildingAmount = 1
        unitAmount = 1
        break
    }

    // Aplikace manuálních přepisů
    if (!isMeterCost && gOverride?.buildingUnits && !isNaN(parseFloat(gOverride.buildingUnits))) {
      buildingAmount = parseFloat(gOverride.buildingUnits)
    }
    
    const uOverride = unitOverrides[unit.id]?.[service.id]
    if (!isMeterCost && uOverride?.userUnits && !isNaN(parseFloat(uOverride.userUnits))) {
      unitAmount = parseFloat(uOverride.userUnits)
    }

    return { totalCost, buildingAmount, unitAmount }
  }

  // Výpočet náhledu pro řádek
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculatePreview = (service: any) => {
    if (!selectedUnit) return { unitCost: 0, unitShare: 0, unitAmount: 0, unitPrice: 0, buildingAmount: 0, formula: '' }

    const baseValues = calculateBaseValues(service, selectedUnit)
    const totalCost = baseValues.totalCost
    const buildingAmount = baseValues.buildingAmount
    const unitAmount = baseValues.unitAmount
    
    let unitCost = 0
    let unitShare = 0 
    let unitPrice = 0 
    let formula = ''
    const isMeterCost = service.method === 'METER_READING' && service.dataSourceColumn === 'precalculatedCost'

    if (service.method === 'CUSTOM' && service.customFormula) {
       try {
         const vars = getCalculationContext(service, selectedUnitId)
         if (!vars) {
            formula = 'Chyba kontextu'
         } else {
           let f = service.customFormula
           // Nahrazení proměnných
           Object.entries(vars).forEach(([k, v]) => { f = f.replace(new RegExp(k, 'g'), String(v)) })
           
           const result = new Function('return ' + f)()
           
           if (typeof result === 'number' && !isNaN(result)) {
              unitCost = result
              formula = `Vzorec: ${service.customFormula}`
              
              // Pokud je to CUSTOM, unitPrice je dopočítaná
              if (unitAmount !== 0) {
                unitPrice = unitCost / unitAmount
              } else {
                unitPrice = unitCost // Fallback
              }
           } else {
              formula = 'Chyba výpočtu'
           }
         }
       } catch {
         formula = 'Chyba vzorce'
       }
    } else if (service.method === 'FIXED_PER_UNIT') {
      unitCost = 0
      formula = 'Fixní částka'
    } else {
      if (isMeterCost) {
        unitCost = unitAmount
        unitShare = buildingAmount > 0 ? (unitAmount / buildingAmount) * 100 : 0
        unitPrice = 0
        formula = 'Externí náklad z odečtů'
      } else if (buildingAmount > 0) {
        unitPrice = totalCost / buildingAmount
        unitCost = unitAmount * unitPrice
        unitShare = (unitAmount / buildingAmount) * 100
        formula = `${totalCost.toLocaleString('cs-CZ')} / ${buildingAmount.toLocaleString('cs-CZ')} * ${unitAmount.toLocaleString('cs-CZ')}`
      } else {
        unitPrice = 0
        unitCost = 0
        unitShare = 0
        formula = 'Nelze vypočítat (dělení nulou)'
      }
    }

    return { unitCost, unitShare, unitAmount, unitPrice, buildingAmount, formula }
  }

  // Handler pro změnu manuálních hodnot
  const handleOverrideChange = (serviceId: string, field: 'buildingUnits' | 'userUnits' | 'share' | 'advance' | 'manualCost', value: string) => {
    if (field === 'buildingUnits' || field === 'share' || field === 'manualCost') {
      setGlobalOverrides(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId],
          [field]: value
        }
      }))
    } else {
      // Unit specific overrides
      setUnitOverrides(prev => ({
        ...prev,
        [selectedUnitId]: {
          ...prev[selectedUnitId],
          [serviceId]: {
            ...prev[selectedUnitId]?.[serviceId],
            [field]: value
          }
        }
      }))
    }
  }

  // Handler pro nahrání Excelu
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!buildingId) {
      alert('Chyba: Není k dispozici ID budovy. Prosím obnovte stránku.')
      return
    }

    if (!confirm('Opravdu chcete přehrát aktuální data novým importem z Excelu? Veškeré ruční úpravy mohou být ztraceny.')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('buildingId', buildingId)
    formData.append('year', year.toString())

    try {
      const res = await fetch('/api/import/complete', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import selhal')
      }

      alert('Import byl úspěšně dokončen. Stránka se nyní obnoví.')
      router.refresh()
      window.location.reload()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Neznámá chyba'
      alert(`Chyba při importu: ${message}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Uložení změn
  const handleSave = async () => {
    setSaving(true)
    try {
      // Prepare services with overrides
      const servicesToSave = localServices.map(s => ({
        ...s,
        divisor: globalOverrides[s.id]?.buildingUnits || null, // Save building units override as divisor
        manualCost: globalOverrides[s.id]?.manualCost || null,
        manualShare: globalOverrides[s.id]?.share || null,
        dataSourceName: s.dataSourceName,
        dataSourceColumn: s.dataSourceColumn,
        customFormula: s.customFormula,
        userMergeWithNext: s.userMergeWithNext || false
      }))

      const res = await fetch(`/api/buildings/${buildingId}/services/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: servicesToSave }),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  // Obsluha verzí
  const saveVersion = async () => {
    if (!newVersionName) return
    setSavingVersion(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName,
          services: localServices,
          manualOverrides: { global: globalOverrides, unit: unitOverrides },
          setAsDefault: newVersionAsDefault,
        })
      })
      if (!res.ok) throw new Error('Uložení verze selhalo')
      const saved = await res.json()
      setNewVersionName('')
      setNewVersionAsDefault(false)
      setShowVersionModal(false)
      await fetchConfigVersions()
      if (newVersionAsDefault && saved?.id) {
        setAppliedDefaultVersionId(null)
        setSelectedVersionId(saved.id)
      }
    } catch (error) {
      console.error('Failed to save config version', error)
      alert('Chyba při ukládání verze')
    } finally {
      setSavingVersion(false)
    }
  }

  const handleVersionSelect = (value: string) => {
    setSelectedVersionId(value)
    if (value) {
      void loadVersion(value)
    }
  }

  const handleDeleteVersion = async () => {
    if (!selectedVersionId) return
    if (!confirm('Opravdu chcete tuto verzi smazat?')) return
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${selectedVersionId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Mazání verze selhalo')
      if (appliedDefaultVersionId === selectedVersionId) {
        setAppliedDefaultVersionId(null)
      }
      setSelectedVersionId('')
      await fetchConfigVersions()
    } catch (error) {
      console.error('Failed to delete version', error)
      alert('Chyba při mazání verze')
    }
  }

  const handleSetVersionAsDefault = async () => {
    if (!selectedVersionId) return
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${selectedVersionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      })
      if (!res.ok) throw new Error('Aktualizace výchozí verze selhala')
      setAppliedDefaultVersionId(null)
      await fetchConfigVersions()
    } catch (error) {
      console.error('Failed to set default version', error)
      alert('Chyba při nastavení výchozí verze')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDragEnd = (result: any) => {
    if (!result.destination) return

    const getLocalIndexFromDisplayedIndex = (displayIndex: number) => {
      if (displayIndex >= displayedServices.length) {
        return localServices.length
      }
      const serviceId = displayedServices[displayIndex]?.id
      if (!serviceId) return -1
      return localServices.findIndex(s => s.id === serviceId)
    }

    const sourceIndex = getLocalIndexFromDisplayedIndex(result.source.index)
    let destinationIndex = getLocalIndexFromDisplayedIndex(result.destination.index)

    if (sourceIndex === -1) return
    if (destinationIndex === -1) destinationIndex = localServices.length

    const items = Array.from(localServices)
    const [reorderedItem] = items.splice(sourceIndex, 1)
    items.splice(destinationIndex > sourceIndex ? destinationIndex - 1 : destinationIndex, 0, reorderedItem)

    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }))

    setLocalServices(updatedItems)
  }

  const toggleUserMergeBetween = (displayIndex: number) => {
    if (displayIndex < 0 || displayIndex >= displayedServices.length - 1) return
    const targetService = displayedServices[displayIndex]
    setLocalServices(prev => prev.map(s =>
      s.id === targetService.id
        ? { ...s, userMergeWithNext: !s.userMergeWithNext }
        : s
    ))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateService = (serviceId: string, updates: any) => {
    setLocalServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, ...updates } : s
    ))
  }

  const displayedServices = localServices.filter(s => showHiddenServices || s.isActive !== false)

  const rowMetrics = displayedServices.map(service => {
    const preview = calculatePreview(service)
    let advance = advancesData[selectedUnitId]?.[service.id]?.total || 0
    const overrideAdvance = unitOverrides[selectedUnitId]?.[service.id]?.advance
    if (overrideAdvance && !isNaN(parseFloat(overrideAdvance))) {
      advance = parseFloat(overrideAdvance)
    }
    const balance = advance - preview.unitCost
    return { preview, advance, balance }
  })

  const headIndexByRow: number[] = []
  let activeHeadIndex = -1
  displayedServices.forEach((service, index) => {
    const prevMerged = index > 0 && displayedServices[index - 1].userMergeWithNext
    if (service.userMergeWithNext) {
      if (!prevMerged) {
        activeHeadIndex = index
      }
      headIndexByRow[index] = activeHeadIndex
    } else if (prevMerged) {
      headIndexByRow[index] = activeHeadIndex
      activeHeadIndex = -1
    } else {
      headIndexByRow[index] = -1
      activeHeadIndex = -1
    }
  })

  const mergedGroupTotals: Record<number, { unitCost: number; advance: number; balance: number }> = {}
  headIndexByRow.forEach((headIndex, index) => {
    if (headIndex === index && displayedServices[index]?.userMergeWithNext) {
      let idx = index
      let unitCost = 0
      let advance = 0
      let balance = 0
      while (idx < displayedServices.length) {
        unitCost += rowMetrics[idx]?.preview.unitCost || 0
        advance += rowMetrics[idx]?.advance || 0
        balance += rowMetrics[idx]?.balance || 0
        if (!displayedServices[idx].userMergeWithNext) {
          break
        }
        idx += 1
      }
      mergedGroupTotals[index] = { unitCost, advance, balance }
    }
  })

  return (
    <div className="space-y-6">
      {/* Horní lišta s ovládáním - Moderní styl */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Karta: Výběr jednotky */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Náhled pro jednotku
          </label>
          <div className="relative">
            <select
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              aria-label="Vybrat jednotku"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber} {u.owners?.[0]?.lastName ? `(${u.owners[0].lastName})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        {/* Karta: Rok */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Rok vyúčtování
          </label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            aria-label="Rok vyúčtování"
          />
        </div>

        {/* Karta: Verze */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-slate-700 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Verze nastavení
          </label>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedVersionId}
                  onChange={(e) => handleVersionSelect(e.target.value)}
                  className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  aria-label="Načíst verzi"
                >
                  <option value="">-- Vybrat uloženou verzi --</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.isDefault ? '⭐ ' : ''}{v.name} ({new Date(v.createdAt).toLocaleDateString('cs-CZ')})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetVersionAsDefault}
                  disabled={!selectedVersionId}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-40 text-sm font-semibold"
                  title="Nastavit jako výchozí"
                >
                  ⭐
                </button>
                <button
                  onClick={handleDeleteVersion}
                  disabled={!selectedVersionId}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 text-sm font-semibold"
                  title="Smazat verzi"
                >
                  🗑️
                </button>
                <button
                  onClick={() => setShowVersionModal(true)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium shadow-sm transition-colors"
                  title="Uložit novou verzi"
                >
                  💾
                </button>
              </div>
            </div>
            {selectedVersion && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedVersion.isDefault ? '⭐ Tato verze je výchozí pro dům.' : 'Načtená verze není výchozí.'} Uložena {new Date(selectedVersion.createdAt).toLocaleString('cs-CZ')}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Akční lišta */}
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 mb-6">
                <input
                  type="checkbox"
                  checked={newVersionAsDefault}
                  onChange={(e) => setNewVersionAsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Nastavit jako výchozí pro tento dům</span>
              </label>
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition-colors">
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showHiddenServices ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
            {showHiddenServices && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
          </div>
          <input 
            type="checkbox" 
            checked={showHiddenServices}
            onChange={(e) => setShowHiddenServices(e.target.checked)}
            className="hidden"
            aria-label="Zobrazit skryté služby"
          />
          <span className="font-medium">Zobrazit skryté služby</span>
        </label>

        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".xlsx, .xls"
            aria-label="Nahrát Excel"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || importing}
            className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 font-bold shadow-sm transition-all flex items-center gap-2 relative group"
          >
            {importing ? (
               <>
                 <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>Nahrávám...</span>
               </>
            ) : (
               <div className="flex flex-col items-start text-left">
                 <div className="flex items-center gap-2">
                    <span>📤 Nahrát Excel</span>
                 </div>
                 {lastImportDate && (
                    <span className="text-[10px] font-normal text-gray-400 mt-0.5">
                      Naposledy: {lastImportDate.toLocaleDateString('cs-CZ')} {lastImportDate.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 )}
               </div>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || importing}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Ukládám...
              </>
            ) : (
              <>
                <span>Uložit změny</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal pro uložení verze */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-96 border border-gray-100 dark:border-slate-700 transform transition-all scale-100">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Uložit verzi nastavení</h3>
            <input
              type="text"
              placeholder="Název verze (např. 'Standardní 2024')"
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 mb-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newVersionName}
              onChange={e => setNewVersionName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowVersionModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">Zrušit</button>
              <button onClick={saveVersion} disabled={savingVersion} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors disabled:opacity-50">
                {savingVersion ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pro editor vzorců */}
      {editingFormulaServiceId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-[600px] border border-gray-100 dark:border-slate-700 transform transition-all scale-100">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Editor vzorce ({editingFormulaMode === 'COST' ? 'Náklad' : 'Cena'})
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vzorec</label>
              <textarea
                className="w-full h-32 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 font-mono text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={tempFormula}
                onChange={e => setTempFormula(e.target.value)}
                aria-label="Editor vzorce"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Dostupné proměnné</label>
              <div className="flex flex-wrap gap-2">
                {/*
                  { label: 'Celkový náklad', value: 'TOTAL_COST' },
                  { label: 'Podíl jednotky', value: 'UNIT_SHARE' },
                  { label: 'Plocha jednotky', value: 'UNIT_AREA' },
                  { label: 'Osoby v jednotce', value: 'UNIT_PEOPLE' },
                  { label: 'Spotřeba jednotky', value: 'UNIT_CONSUMPTION' },
                  { label: 'Celková spotřeba', value: 'TOTAL_CONSUMPTION' },
                  { label: 'Celková plocha', value: 'TOTAL_AREA' },
                  { label: 'Celkem osob', value: 'TOTAL_PEOPLE' },
                  { label: 'Počet jednotek', value: 'UNIT_COUNT' },
                */}
                {Object.keys(getCalculationContext(localServices[0], selectedUnitId) || {}).map(key => (
                  <button
                    key={key}
                    onClick={() => insertIntoFormula(key)}
                    className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300 transition-colors"
                    title={key}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingFormulaServiceId(null)} 
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                Zrušit
              </button>
              <button 
                onClick={saveFormulaFromEditor} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
              >
                Uložit vzorec
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pro konfiguraci měřidel */}
      {editingMeterServiceId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 px-8 py-6 border-b border-blue-200 dark:border-blue-800/50 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Konfigurace odečtů</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Vyberte typy měřidel pro tuto službu</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMeterServiceId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg"
                title="Zavřít"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-8 py-7 space-y-7">
              {/* Meter Types Selection */}
              <div>
                <label className="flex text-sm font-bold text-gray-900 dark:text-white mb-4 items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  Vyberte typy měřidel, které se mají sčítat
                </label>
                <div className="space-y-2.5">
                  {[
                    { id: 'COLD_WATER', label: 'Studená voda (SV)', icon: '💧', color: 'blue' },
                    { id: 'HOT_WATER', label: 'Teplá voda (TUV)', icon: '🌡️', color: 'red' },
                    { id: 'HEATING', label: 'Teplo', icon: '🔥', color: 'orange' },
                    { id: 'ELECTRICITY', label: 'Elektřina', icon: '⚡', color: 'yellow' }
                  ].map(type => (
                    <label key={type.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${tempMeterTypes.includes(type.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'}`}>
                      <div className="w-6 h-6 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={tempMeterTypes.includes(type.id)}
                          onChange={() => toggleMeterType(type.id)}
                          className="w-5 h-5 text-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                        />
                      </div>
                      <span className="text-2xl">{type.icon}</span>
                      <span className={`font-semibold flex-1 transition-colors ${tempMeterTypes.includes(type.id) ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'}`}>{type.label}</span>
                      {tempMeterTypes.includes(type.id) && (
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Meter Source Selection */}
              <div className="pt-2">
                <label className="flex text-sm font-bold text-gray-900 dark:text-white mb-4 items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  Co použít pro výpočet?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${tempMeterSourceColumn === 'consumption' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-gray-300 dark:hover:border-slate-600'}`}>
                    <input
                      type="radio"
                      name="meterSource"
                      value="consumption"
                      checked={tempMeterSourceColumn === 'consumption'}
                      onChange={() => setTempMeterSourceColumn('consumption')}
                      className="hidden"
                    />
                    <span className="text-3xl">📊</span>
                    <span className={`font-semibold text-center text-sm transition-colors ${tempMeterSourceColumn === 'consumption' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>Spotřeba<br/>(m³/kWh)</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${tempMeterSourceColumn === 'precalculatedCost' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-gray-300 dark:hover:border-slate-600'}`}>
                    <input
                      type="radio"
                      name="meterSource"
                      value="precalculatedCost"
                      checked={tempMeterSourceColumn === 'precalculatedCost'}
                      onChange={() => setTempMeterSourceColumn('precalculatedCost')}
                      className="hidden"
                    />
                    <span className="text-3xl">💰</span>
                    <span className={`font-semibold text-center text-sm transition-colors ${tempMeterSourceColumn === 'precalculatedCost' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>Náklad<br/>(Kč)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-200 dark:border-slate-700 leading-relaxed">
                  💡 Pokud zvolíte <strong>&quot;Náklad&quot;</strong>, použije se předvypočítaná částka z importu (např. pro poměrové měřiče tepla).
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button 
                onClick={() => setEditingMeterServiceId(null)} 
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl font-semibold transition-all transform hover:scale-105"
              >
                Zrušit
              </button>
              <button 
                onClick={saveMeterConfig} 
                className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                ✓ Uložit nastavení
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hlavní editor - Moderní tabulka */}
      <div className="bg-white dark:bg-slate-800 shadow-lg rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-8 py-5 border-b border-blue-200 dark:border-blue-800/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="w-1 h-7 bg-blue-600 rounded-full"></span>
            <span>Nastavení služeb</span>
            <span className="text-xs font-normal px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 rounded-full border border-blue-200 dark:border-blue-800">{displayedServices.length} služeb</span>
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm font-medium">
            📍 Jednotka: <span className="font-bold text-gray-900 dark:text-white ml-2">{selectedUnit?.unitNumber}</span>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="services">
            {(provided) => (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" ref={provided.innerRef} {...provided.droppableProps}>
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-bold border-b-2 border-gray-200 dark:border-slate-700">
                      <th className="px-3 py-3 w-10 text-center" rowSpan={2} title="Přesunutí"></th>
                      <th className="px-2 py-3 w-8 text-center" rowSpan={2}>#</th>
                      <th className="px-4 py-3 text-left min-w-[150px]" rowSpan={2}>📋 Služba</th>
                      <th className="px-3 py-3 text-left min-w-[140px]" rowSpan={2}>⚙️ Způsob</th>
                      <th className="px-2 py-3 text-center border-l-2 border-gray-300 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10" colSpan={4}>🏢 Dům</th>
                      <th className="px-2 py-3 text-center border-l-2 border-gray-300 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10" colSpan={4}>👤 Jednotka</th>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                      <th className="px-2 py-2 text-right border-l-2 border-gray-300 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">Podíl %</th>
                      <th className="px-2 py-2 text-right bg-blue-50/50 dark:bg-blue-900/10">Náklad</th>
                      <th className="px-2 py-2 text-right bg-blue-50/50 dark:bg-blue-900/10">Jedn.</th>
                      <th className="px-2 py-2 text-right bg-blue-50/50 dark:bg-blue-900/10">Cena/j.</th>
                      <th className="px-2 py-2 text-right border-l-2 border-gray-300 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10">Jedn.</th>
                      <th className="px-2 py-2 text-right bg-amber-50/50 dark:bg-amber-900/10">Náklad</th>
                      <th className="px-2 py-2 text-right bg-amber-50/50 dark:bg-amber-900/10">Záloha</th>
                      <th className="px-2 py-2 text-right bg-amber-50/50 dark:bg-amber-900/10">Výsledek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {displayedServices.map((service, index) => {
                      const metrics = rowMetrics[index]
                      const preview = metrics.preview
                      const totalCost = filteredCosts.filter(c => c.serviceId === service.id).reduce((sum, c) => sum + c.amount, 0)
                      const isMeterCost = service.method === 'METER_READING' && service.dataSourceColumn === 'precalculatedCost'
                      const advance = metrics.advance
                      const balance = metrics.balance
                      const headIndex = headIndexByRow[index]
                      const mergedTotals = headIndex !== undefined && headIndex !== -1 ? mergedGroupTotals[headIndex] : undefined
                      const isGroupHead = headIndex === index && service.userMergeWithNext
                      const isPartOfGroup = headIndex !== undefined && headIndex !== -1
                      const displayUnitCost = isPartOfGroup ? (isGroupHead ? mergedTotals?.unitCost ?? 0 : null) : preview.unitCost
                      const displayAdvance = isPartOfGroup ? (isGroupHead ? mergedTotals?.advance ?? 0 : null) : advance
                      const displayBalance = isPartOfGroup ? (isGroupHead ? mergedTotals?.balance ?? 0 : null) : balance
                      
                      return (
                        <Fragment key={service.id}>
                          <Draggable key={service.id} draggableId={service.id} index={index}>
                            {(provided, snapshot) => (
                            <tr 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`
                                transition-all duration-150
                                ${snapshot.isDragging ? 'bg-blue-100 dark:bg-blue-900/30 shadow-lg z-10 scale-[1.02]' : 'hover:bg-gray-50/80 dark:hover:bg-slate-700/40'} 
                                ${service.isActive === false ? 'opacity-50 bg-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}
                              `}
                            >
                              <td className="px-3 py-2.5 text-center text-gray-300 dark:text-gray-600 cursor-grab hover:text-gray-600 dark:hover:text-gray-400 transition-colors" {...provided.dragHandleProps} title="Přesuň">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zM7 18a2 2 0 11-4 0 2 2 0 014 0zM17 2a2 2 0 11-4 0 2 2 0 014 0zM17 10a2 2 0 11-4 0 2 2 0 014 0zM17 18a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                              </td>
                              <td className="px-2 py-2.5 text-center text-gray-400 dark:text-gray-500 font-mono text-xs font-bold">
                                {index + 1}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white text-sm">
                                {service.name}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="relative flex items-center gap-1">
                                  <select
                                    value={service.method}
                                    onChange={(e) => updateService(service.id, { method: e.target.value })}
                                    className="w-full bg-transparent border-none text-xs focus:ring-0 p-0 cursor-pointer text-gray-600 dark:text-gray-300 font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    aria-label="Způsob rozúčtování"
                                  >
                                    <option value="OWNERSHIP_SHARE">Podíl</option>
                                    <option value="AREA">Plocha</option>
                                    <option value="PERSON_MONTHS">Osoby</option>
                                    <option value="METER_READING">Měř.</option>
                                    <option value="EQUAL_SPLIT">Rovně</option>
                                    <option value="FIXED_PER_UNIT">Fixní</option>
                                    <option value="UNIT_PARAMETER">Param.</option>
                                    <option value="CUSTOM">Vzorec</option>
                                    <option value="NO_BILLING">Žádný</option>
                                  </select>
                                  {service.method === 'METER_READING' && (
                                     <button
                                       onClick={() => openMeterConfig(service)}
                                       className="shrink-0 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                       title="Konfigurace měřidel"
                                       aria-label="Konfigurace měřidel"
                                     >
                                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                     </button>
                                  )}
                                  {service.method === 'CUSTOM' && (
                                     <button
                                       onClick={() => openFormulaEditor(service)}
                                       className="shrink-0 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                                       title="Upravit vzorec"
                                       aria-label="Upravit vzorec"
                                     >
                                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                     </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-300 text-xs border-l-2 border-gray-300 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/5">
                                <div className="flex items-center justify-end gap-0.5 group">
                                  <input 
                                    type="text"
                                    className="w-10 text-right border-b border-transparent group-hover:border-gray-400 focus:border-blue-500 focus:outline-none bg-transparent text-xs font-semibold transition-colors"
                                    placeholder="100"
                                    value={globalOverrides[service.id]?.share || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'share', e.target.value)}
                                  />
                                  <span className="text-gray-500">%</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-right text-gray-700 dark:text-gray-200 bg-blue-50/30 dark:bg-blue-900/5 font-bold text-xs">
                                <div className="flex items-center justify-end gap-0.5 group">
                                  <input 
                                    type="text"
                                    className="w-16 text-right border-b border-transparent group-hover:border-gray-400 focus:border-blue-500 focus:outline-none bg-transparent text-xs font-semibold"
                                    placeholder={totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    value={globalOverrides[service.id]?.manualCost || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'manualCost', e.target.value)}
                                    aria-label={`Náklad pro službu ${service.name}`}
                                  />
                                  <span className="text-gray-500">Kč</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-300 bg-blue-50/30 dark:bg-blue-900/5 text-xs">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <input 
                                    type="text"
                                    className="w-14 text-right border-b border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none bg-transparent text-xs font-semibold"
                                    placeholder={preview.buildingAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                    value={globalOverrides[service.id]?.buildingUnits || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'buildingUnits', e.target.value)}
                                  />
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-300 bg-blue-50/30 dark:bg-blue-900/5 text-xs relative group">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <>
                                    {preview.unitPrice > 0 ? preview.unitPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    <button
                                      onClick={() => openFormulaEditor(service, 'PRICE')}
                                      className="absolute top-1/2 -translate-y-1/2 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                      title="Upravit vzorec ceny"
                                      aria-label="Upravit vzorec ceny"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                  </>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-300 text-xs border-l-2 border-gray-300 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-900/5">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <input 
                                    type="text"
                                    className="w-14 text-right border-b border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none bg-transparent text-xs font-semibold"
                                    placeholder={preview.unitAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                    value={unitOverrides[selectedUnitId]?.[service.id]?.userUnits || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'userUnits', e.target.value)}
                                  />
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-right font-bold text-gray-900 dark:text-white bg-amber-100/40 dark:bg-amber-900/20 rounded mx-1 relative group text-xs border-l border-amber-200 dark:border-amber-800" title={preview.formula}>
                                {displayUnitCost !== null && displayUnitCost !== undefined
                                  ? `${displayUnitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč`
                                  : <span className="text-gray-400 dark:text-gray-500">–</span>}
                                {!isPartOfGroup && (
                                  <button
                                    onClick={() => openFormulaEditor(service, 'COST')}
                                    className="absolute top-1/2 -translate-y-1/2 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                    title="Upravit vzorec výpočtu"
                                    aria-label="Upravit vzorec výpočtu"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-right font-semibold text-gray-900 dark:text-white bg-amber-100/30 dark:bg-amber-900/10 rounded mx-1 text-xs border-l border-amber-200 dark:border-amber-800">
                                {displayAdvance !== null && displayAdvance !== undefined
                                  ? `${displayAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč`
                                  : <span className="text-gray-400 dark:text-gray-500">–</span>}
                              </td>
                              <td
                                className={`px-2 py-2.5 text-right font-semibold text-xs border-l border-amber-200 dark:border-amber-800 bg-amber-100/60 dark:bg-amber-900/30 rounded ${
                                  displayBalance !== null && displayBalance !== undefined
                                    ? displayBalance >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                    : 'text-gray-400 dark:text-gray-500'
                                }`}
                                title="Výsledek = Záloha - Náklad"
                              >
                                {displayBalance !== null && displayBalance !== undefined ? (
                                  `${displayBalance.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč`
                                ) : (
                                  <span>–</span>
                                )}
                              </td>
                            </tr>
                          )}
                          </Draggable>
                          {index < displayedServices.length - 1 && (
                            <tr>
                              <td colSpan={12}>
                                <div className="flex justify-end pr-8">
                                  <button
                                    onClick={() => toggleUserMergeBetween(index)}
                                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${displayedServices[index].userMergeWithNext ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200 hover:text-blue-600'}`}
                                    title={displayedServices[index].userMergeWithNext ? 'Zrušit součet s řádkem níže' : 'Sečíst s řádkem níže'}
                                  >
                                    {displayedServices[index].userMergeWithNext ? '✕ Rozpojit' : '+ Sečíst s níže'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {provided.placeholder}
                    
                    {/* Řádek celkem */}
                    <tr className="bg-gray-50 dark:bg-slate-800 font-bold border-t border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white">
                      <td colSpan={8} className="p-4 text-left uppercase text-xs tracking-wider text-gray-500 dark:text-gray-400">
                        <div className="flex items-center justify-between">
                          <span>Celkem náklady na odběrné místo</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {costs.reduce((sum, c) => sum + c.amount, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-400 dark:text-gray-500">–</td>
                      <td className="p-4 text-right bg-amber-100/40 dark:bg-amber-900/20">
                        {rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.preview.unitCost : sum
                          ), 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className="p-4 text-right bg-amber-100/30 dark:bg-amber-900/10">
                        {rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.advance : sum
                          ), 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className={`p-4 text-right bg-amber-100/50 dark:bg-amber-900/20 ${
                        rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.balance : sum
                          ), 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.balance : sum
                          ), 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-3">
        <span className="text-xl">💡</span>
        <p className="mt-0.5"><strong>Tip:</strong> Hodnoty ve sloupcích &quot;Jednotek&quot; (ve skupině Dům i Uživatel) můžete ručně přepsat kliknutím do pole. Změny se ihned projeví ve výpočtu. Pro zobrazení vzorce najeďte myší na částku &quot;Náklad&quot; (ve skupině Uživatel).</p>
      </div>

      <div className="mt-6">
        {billingSummaryLoading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Načítám souhrn vyúčtování…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aktuální období</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{year}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  displayedCurrentTrend === 0
                    ? 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-300'
                    : displayedCurrentTrend < 0
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}>
                  {currentSummaryLabel}
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                displayedCurrentTrend === 0
                  ? 'text-gray-400 dark:text-gray-500'
                  : displayedCurrentTrend < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {displayedCurrentAmount}
              </p>
              {isFallbackCurrentSummary && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Částka vychází z rozdílu mezi předepsanými ({formatCurrencyValue(totalPrescribedAdvances, 0)}) a skutečně uhrazenými ({formatCurrencyValue(totalPaidAdvances, 0)}) zálohami.
                </p>
              )}
              <div className="mt-4 grid gap-1 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between"><span>Náklady jednotky</span><span className="font-semibold">{formatCurrencyValue(billingSummary?.current?.totalCost, 0)}</span></div>
                <div className="flex justify-between"><span>Předepsané zálohy</span><span className="font-semibold">{formatCurrencyValue(currentAdvancePrescribed, 0)}</span></div>
                <div className="flex justify-between"><span>Skutečně uhrazeno</span><span className="font-semibold">{formatCurrencyValue(currentAdvancePaid, 0)}</span></div>
                <div className="flex justify-between"><span>Fond oprav</span><span className="font-semibold">{formatCurrencyValue(billingSummary?.current?.repairFund, 0)}</span></div>
                {isFallbackCurrentSummary && currentFallbackSinglePayment !== null && (
                  <div className={`flex justify-between font-semibold ${
                    advancePaymentDifference && advancePaymentDifference > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : advancePaymentDifference && advancePaymentDifference < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 dark:text-gray-300'
                  }`}>
                    <span>{advancePaymentDifference && advancePaymentDifference > 0 ? 'Jednorázově uhradit' : advancePaymentDifference && advancePaymentDifference < 0 ? 'Přebytek záloh' : 'Vyrovnáno'}</span>
                    <span>{formatCurrencyValue(currentFallbackSinglePayment, 0)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Minulé období</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{year - 1}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  billingSummary?.previous
                    ? previousTrend < 0
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                      : previousTrend > 0
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-300'
                }`}>
                  {previousSummaryLabel}
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                previousTrend === 0
                  ? 'text-gray-400 dark:text-gray-500'
                  : previousTrend < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {billingSummary?.previous ? formatCurrencyValue(previousResultAmount) : '—'}
              </p>
              <div className="mt-4 grid gap-1 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between"><span>Náklady jednotky</span><span className="font-semibold">{formatCurrencyValue(billingSummary?.previous?.totalCost, 0)}</span></div>
                <div className="flex justify-between"><span>Uhrazené zálohy</span><span className="font-semibold">{formatCurrencyValue(billingSummary?.previous?.totalAdvancePaid, 0)}</span></div>
                <div className="flex justify-between"><span>Fond oprav</span><span className="font-semibold">{formatCurrencyValue(billingSummary?.previous?.repairFund, 0)}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
