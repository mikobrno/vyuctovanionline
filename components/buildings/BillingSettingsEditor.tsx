'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface BillingSettingsEditorProps {
  buildingId: string
  services: any[]
  units: any[]
  costs: any[]
}

export default function BillingSettingsEditor({ buildingId, services, units, costs }: BillingSettingsEditorProps) {
  const router = useRouter()
  const [localServices, setLocalServices] = useState(services)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || '')
  const [showHiddenServices, setShowHiddenServices] = useState(false)
  const [saving, setSaving] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1)
  
  // State pro verze
  const [versions, setVersions] = useState<any[]>([])
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [savingVersion, setSavingVersion] = useState(false)

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
  
  // State pro manuální přepisy hodnot
  // Global overrides: [serviceId]: { buildingUnits?: string, share?: string, manualCost?: string }
  const [globalOverrides, setGlobalOverrides] = useState<Record<string, { buildingUnits?: string, share?: string, manualCost?: string }>>({})
  // Unit overrides: [unitId]: { [serviceId]: { userUnits?: string, advance?: string } }
  const [unitOverrides, setUnitOverrides] = useState<Record<string, Record<string, { userUnits?: string, advance?: string }>>>({})

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
      .then(json => setAdvancesData(json.data || {}))
      .catch(err => console.error('Failed to load advances', err))
  }, [buildingId, year])

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
    const uMeters = unit.meters?.filter((m: any) => {
       if (isWater) return (m.type === 'COLD_WATER' || m.type === 'HOT_WATER');
       if (isHeating) return (m.type === 'HEATING');
       return false;
    }) || []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uMeters.forEach((m: any) => {
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

  // Uložení verze
  const saveVersion = async () => {
    if (!newVersionName) return
    setSavingVersion(true)
    try {
      await fetch(`/api/buildings/${buildingId}/config-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newVersionName, 
          services: localServices,
          manualOverrides: { global: globalOverrides, unit: unitOverrides } // Save overrides with version
        })
      })
      setNewVersionName('')
      setShowVersionModal(false)
      const res = await fetch(`/api/buildings/${buildingId}/config-versions`)
      const data = await res.json()
      setVersions(data)
    } catch (e) {
      console.error(e)
      alert('Chyba při ukládání verze')
    } finally {
      setSavingVersion(false)
    }
  }

  // Načtení verze
  const loadVersion = async (versionId: string) => {
    if (!versionId) return
    if (!confirm('Opravdu chcete načíst tuto verzi? Neuložené změny budou ztraceny.')) return
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${versionId}`)
      const data = await res.json()
      
      // Restore overrides if they exist in the version
      if (data.config?.manualOverrides) {
        if (data.config.manualOverrides.global) {
           setGlobalOverrides(data.config.manualOverrides.global)
        } else {
           // Backwards compatibility
           setGlobalOverrides(data.config.manualOverrides)
        }
        
        if (data.config.manualOverrides.unit) {
           setUnitOverrides(data.config.manualOverrides.unit)
        }
      }

      const updatedServices = localServices.map(s => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = data.configs.find((c: any) => c.serviceId === s.id)
        if (config) {
          return {
            ...s,
            method: config.method,
            isActive: config.isActive,
            order: config.order,
            divisor: config.divisor // Restore divisor
          }
        }
        return s
      }).sort((a, b) => (a.order || 0) - (b.order || 0))
      
      setLocalServices(updatedServices)
    } catch {
      alert('Chyba při načítání verze')
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                onChange={(e) => loadVersion(e.target.value)}
                className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                defaultValue=""
                aria-label="Načíst verzi"
              >
                <option value="" disabled>-- Načíst uloženou verzi --</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({new Date(v.createdAt).toLocaleDateString()})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <button
              onClick={() => setShowVersionModal(true)}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium shadow-sm transition-colors"
              title="Uložit novou verzi"
            >
              💾
            </button>
          </div>
        </div>
      </div>

      {/* Akční lišta */}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-[400px] border border-gray-100 dark:border-slate-700 transform transition-all scale-100">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Konfigurace odečtů
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Vyberte typy měřidel, které se mají sčítat pro tuto službu.
            </p>
            
            <div className="space-y-3 mb-6">
              {[
                { id: 'COLD_WATER', label: 'Studená voda (SV)' },
                { id: 'HOT_WATER', label: 'Teplá voda (TUV)' },
                { id: 'HEATING', label: 'Teplo' },
                { id: 'ELECTRICITY', label: 'Elektřina' }
              ].map(type => (
                <label key={type.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={tempMeterTypes.includes(type.id)}
                    onChange={() => toggleMeterType(type.id)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-slate-600"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-200">{type.label}</span>
                </label>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Co použít pro výpočet?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${tempMeterSourceColumn === 'consumption' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="meterSource"
                    value="consumption"
                    checked={tempMeterSourceColumn === 'consumption'}
                    onChange={() => setTempMeterSourceColumn('consumption')}
                    className="hidden"
                  />
                  <span className="font-medium">Spotřeba (m³/kWh)</span>
                </label>
                <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${tempMeterSourceColumn === 'precalculatedCost' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="meterSource"
                    value="precalculatedCost"
                    checked={tempMeterSourceColumn === 'precalculatedCost'}
                    onChange={() => setTempMeterSourceColumn('precalculatedCost')}
                    className="hidden"
                  />
                  <span className="font-medium">Náklad (Kč)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pokud zvolíte "Náklad", použije se předvypočítaná částka z importu odečtů (např. pro poměrové měřiče tepla).
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingMeterServiceId(null)} 
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                Zrušit
              </button>
              <button 
                onClick={saveMeterConfig} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
              >
                Uložit nastavení
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hlavní editor - Moderní tabulka */}
      <div className="bg-white dark:bg-slate-800 shadow-sm rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
        <div className="bg-gray-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
            Nastavení služeb
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm">
            Jednotka: <span className="font-bold text-gray-900 dark:text-white ml-1">{selectedUnit?.unitNumber}</span>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="services">
            {(provided) => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" ref={provided.innerRef} {...provided.droppableProps}>
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-slate-700">
                      <th className="p-4 w-10" rowSpan={2}></th>
                      <th className="p-4 w-10 text-center" rowSpan={2}>#</th>
                      <th className="p-4 text-left" rowSpan={2}>Služba <span className="text-[10px] font-normal text-gray-400 ml-1">[A]</span></th>
                      <th className="p-4 text-left" rowSpan={2}>Způsob rozúčtování <span className="text-[10px] font-normal text-gray-400 ml-1">[B]</span></th>
                      <th className="p-4 text-center border-l border-gray-200 dark:border-slate-700 bg-gray-100/50 dark:bg-slate-800" colSpan={4}>Odběrné místo (dům)</th>
                      <th className="p-4 text-center border-l border-gray-200 dark:border-slate-700 bg-gray-100/50 dark:bg-slate-800" colSpan={4}>Uživatel</th>
                      <th className="p-4 w-10 text-center" rowSpan={2} title="Viditelnost">
                        <svg className="w-4 h-4 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </th>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-slate-700">
                      <th className="p-2 text-right border-l border-gray-200 dark:border-slate-700">Podíl <span className="text-[9px] font-normal text-gray-400 ml-1">[C]</span></th>
                      <th className="p-2 text-right">Náklad <span className="text-[9px] font-normal text-gray-400 ml-1">[D]</span></th>
                      <th className="p-2 text-right">Jednotek <span className="text-[9px] font-normal text-gray-400 ml-1">[E]</span></th>
                      <th className="p-2 text-right">Cena/jedn. <span className="text-[9px] font-normal text-gray-400 ml-1">[F]</span></th>
                      <th className="p-2 text-right border-l border-gray-200 dark:border-slate-700">Jednotek <span className="text-[9px] font-normal text-gray-400 ml-1">[G]</span></th>
                      <th className="p-2 text-right">Náklad <span className="text-[9px] font-normal text-gray-400 ml-1">[H]</span></th>
                      <th className="p-2 text-right">Záloha <span className="text-[9px] font-normal text-gray-400 ml-1">[I]</span></th>
                      <th className="p-2 text-right">Výsledek <span className="text-[9px] font-normal text-gray-400 ml-1">[J]</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
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
                                transition-colors duration-150
                                ${snapshot.isDragging ? 'bg-blue-50 dark:bg-blue-900/20 shadow-lg z-10' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'} 
                                ${service.isActive === false ? 'opacity-50 bg-gray-50 dark:bg-slate-800/50 grayscale' : 'bg-white dark:bg-slate-800'}
                              `}
                            >
                              <td className="p-4 text-center text-gray-300 dark:text-gray-600 cursor-grab hover:text-gray-500" {...provided.dragHandleProps}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                              </td>
                              <td className="p-4 text-center text-gray-400 dark:text-gray-500 font-mono text-xs">
                                {index + 1}
                              </td>
                              <td className="p-4 font-semibold text-gray-900 dark:text-white">
                                {service.name}
                              </td>
                              <td className="p-4">
                                <div className="relative flex items-center gap-2">
                                  <select
                                    value={service.method}
                                    onChange={(e) => updateService(service.id, { method: e.target.value })}
                                    className="w-full bg-transparent border-none text-sm focus:ring-0 p-0 cursor-pointer text-gray-600 dark:text-gray-300 font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    aria-label="Způsob rozúčtování"
                                  >
                                    <option value="OWNERSHIP_SHARE">Vlastnický podíl</option>
                                    <option value="AREA">Podlahová plocha (m²)</option>
                                    <option value="PERSON_MONTHS">Osobo-měsíce</option>
                                    <option value="METER_READING">Odečet měřidla</option>
                                    <option value="EQUAL_SPLIT">Rovným dílem</option>
                                    <option value="FIXED_PER_UNIT">Fixní částka na byt</option>
                                    <option value="UNIT_PARAMETER">Podle parametru</option>
                                    <option value="CUSTOM">Vlastní vzorec</option>
                                    <option value="NO_BILLING">Nevyúčtovávat</option>
                                  </select>
                                  {service.method === 'METER_READING' && (
                                     <button
                                       onClick={() => openMeterConfig(service)}
                                       className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                       title="Konfigurace měřidel"
                                       aria-label="Konfigurace měřidel"
                                     >
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                     </button>
                                  )}
                                  {service.method === 'CUSTOM' && (
                                     <button
                                       onClick={() => openFormulaEditor(service)}
                                       className="p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                                       title="Upravit vzorec"
                                       aria-label="Upravit vzorec"
                                     >
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                     </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-xs border-l border-gray-100 dark:border-slate-700">
                                <div className="flex items-center justify-end gap-1 group">
                                  <input 
                                    type="text"
                                    className="w-12 text-right border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-xs transition-colors"
                                    placeholder="100"
                                    value={globalOverrides[service.id]?.share || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'share', e.target.value)}
                                  />
                                  <span>%</span>
                                </div>
                              </td>
                              <td className="p-4 text-right text-gray-600 dark:text-gray-300 font-medium">
                                <div className="flex items-center justify-end gap-1 group">
                                  <input 
                                    type="text"
                                    className="w-20 text-right border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm font-medium"
                                    placeholder={totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    value={globalOverrides[service.id]?.manualCost || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'manualCost', e.target.value)}
                                    aria-label={`Náklad pro službu ${service.name}`}
                                  />
                                  <span>Kč</span>
                                </div>
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <input 
                                    type="text"
                                    className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                                    placeholder={preview.buildingAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                    value={globalOverrides[service.id]?.buildingUnits || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'buildingUnits', e.target.value)}
                                  />
                                )}
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-xs relative group">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <>
                                    {preview.unitPrice > 0 ? preview.unitPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    <button
                                      onClick={() => openFormulaEditor(service, 'PRICE')}
                                      className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                      title="Upravit vzorec ceny"
                                      aria-label="Upravit vzorec ceny"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                  </>
                                )}
                              </td>
                              <td className="p-4 text-right font-medium text-gray-700 dark:text-gray-200 border-l border-gray-100 dark:border-slate-700">
                                {isMeterCost ? (
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <input 
                                    type="text"
                                    className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm font-bold"
                                    placeholder={preview.unitAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                    value={unitOverrides[selectedUnitId]?.[service.id]?.userUnits || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'userUnits', e.target.value)}
                                  />
                                )}
                              </td>
                              <td className="p-4 text-right font-bold text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg mx-2 relative group" title={preview.formula}>
                                {displayUnitCost !== null && displayUnitCost !== undefined
                                  ? `${displayUnitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`
                                  : <span className="text-gray-400 dark:text-gray-500">–</span>}
                                {!isPartOfGroup && (
                                  <button
                                    onClick={() => openFormulaEditor(service, 'COST')}
                                    className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                    title="Upravit vzorec výpočtu"
                                    aria-label="Upravit vzorec výpočtu"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                )}
                              </td>
                              <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                {isPartOfGroup ? (
                                  displayAdvance !== null && displayAdvance !== undefined
                                    ? `${displayAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`
                                    : <span className="text-gray-400 dark:text-gray-500">–</span>
                                ) : (
                                  <input 
                                    type="text"
                                    className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                                    placeholder={advance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    value={unitOverrides[selectedUnitId]?.[service.id]?.advance || ''}
                                    onChange={(e) => handleOverrideChange(service.id, 'advance', e.target.value)}
                                  />
                                )}
                              </td>
                              <td className={`p-4 text-right font-bold ${ (displayBalance ?? balance) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {displayBalance !== null && displayBalance !== undefined
                                  ? `${displayBalance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`
                                  : <span className="text-gray-400 dark:text-gray-500">–</span>}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => updateService(service.id, { isActive: !service.isActive })}
                                  className={`p-1 rounded-full transition-colors ${service.isActive !== false ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                                  title={service.isActive !== false ? 'Služba je aktivní (kliknutím skryjete)' : 'Služba je skrytá (kliknutím zobrazíte)'}
                                >
                                  {service.isActive !== false ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )}
                          </Draggable>
                          {index < displayedServices.length - 1 && (
                            <tr>
                              <td colSpan={13} className="py-1">
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
                      <td colSpan={5} className="p-4 text-left uppercase text-xs tracking-wider text-gray-500 dark:text-gray-400">Celkem náklady na odběrné místo</td>
                      <td className="p-4 text-right">
                        {costs.reduce((sum, c) => sum + c.amount, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
                      </td>
                      <td colSpan={3}></td>
                      <td className="p-4 text-right bg-yellow-100/50 dark:bg-yellow-900/20 rounded-lg">
                        {rowMetrics
                          .reduce((sum, metrics, idx) => {
                            return displayedServices[idx].isActive !== false ? sum + metrics.preview.unitCost : sum
                          }, 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className="p-4 text-right">
                        {rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.advance : sum
                          ), 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className={`p-4 text-right ${
                        rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.balance : sum
                          ), 0) >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {rowMetrics
                          .reduce((sum, metrics, idx) => (
                            displayedServices[idx].isActive !== false ? sum + metrics.balance : sum
                          ), 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td></td>
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
    </div>
  )
}
