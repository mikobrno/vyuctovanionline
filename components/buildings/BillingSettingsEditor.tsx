'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [year, setYear] = useState<number>(new Date().getFullYear())
  
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

  // State pro zálohy
  const [advancesData, setAdvancesData] = useState<Record<string, Record<string, { total: number }>>>({})
  
  // State pro manuální přepisy hodnot
  // Global overrides: [serviceId]: { buildingUnits?: string, share?: string }
  const [globalOverrides, setGlobalOverrides] = useState<Record<string, { buildingUnits?: string, share?: string }>>({})
  // Unit overrides: [unitId]: { [serviceId]: { userUnits?: string, advance?: string } }
  const [unitOverrides, setUnitOverrides] = useState<Record<string, Record<string, { userUnits?: string, advance?: string }>>>({})

  useEffect(() => {
    // Transform methodology -> method for component compatibility
    const transformedServices = services.map(s => ({
      ...s,
      method: s.methodology || s.method || 'OWNERSHIP_SHARE'
    }))
    setLocalServices(transformedServices)
    // Initialize global overrides from service configuration (divisor)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialOverrides: Record<string, any> = {}
    transformedServices.forEach(s => {
      if (s.divisor) {
        initialOverrides[s.id] = { buildingUnits: s.divisor.toString() }
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
      const costDate = new Date(c.invoiceDate || c.createdAt)
      return costDate.getFullYear() === year
    })
  }, [costs, year])

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
        const meterTypeMap: Record<string, string> = {
          'TEPLO': 'HEATING',
          'TUV': 'HOT_WATER',
          'SV': 'COLD_WATER',
          'ELEKTRINA': 'ELECTRICITY',
        }
        const meterType = meterTypeMap[service.code] || 'HEATING'
        
        const totalConsumption = units.reduce((sum, u) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meter = u.meters?.find((m: any) => m.type === meterType && m.isActive)
          const reading = meter?.readings?.[0] 
          return sum + (reading?.consumption || 0)
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

    let totalCost = filteredCosts
      .filter(c => c.serviceId === service.id)
      .reduce((sum, c) => sum + c.amount, 0)

    // Aplikace podílu služby (Service Share) - default 100%
    const gOverride = globalOverrides[service.id]
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
        const meterTypeMap: Record<string, string> = {
          'TEPLO': 'HEATING',
          'TUV': 'HOT_WATER',
          'SV': 'COLD_WATER',
          'ELEKTRINA': 'ELECTRICITY',
        }
        const meterType = meterTypeMap[service.code] || 'HEATING'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meter = unit.meters?.find((m: any) => m.type === meterType && m.isActive)
        buildingAmount = buildingStats.consumptionByService[service.id] || 0
        unitAmount = meter?.readings?.[0]?.consumption || 0
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
    if (gOverride?.buildingUnits && !isNaN(parseFloat(gOverride.buildingUnits))) {
      buildingAmount = parseFloat(gOverride.buildingUnits)
    }
    
    const uOverride = unitOverrides[unit.id]?.[service.id]
    if (uOverride?.userUnits && !isNaN(parseFloat(uOverride.userUnits))) {
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
      if (buildingAmount > 0) {
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
  const handleOverrideChange = (serviceId: string, field: 'buildingUnits' | 'userUnits' | 'share' | 'advance', value: string) => {
    if (field === 'buildingUnits' || field === 'share') {
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
        divisor: globalOverrides[s.id]?.buildingUnits || null // Save building units override as divisor
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

    const items = Array.from(localServices)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }))

    setLocalServices(updatedItems)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateService = (serviceId: string, updates: any) => {
    setLocalServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, ...updates } : s
    ))
  }

  const displayedServices = localServices.filter(s => showHiddenServices || s.isActive !== false)

  return (
    <div className="space-y-6">
      {/* Editor vzorců Modal */}
      {editingFormulaServiceId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700 transform transition-all scale-100">
             <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 rounded-t-2xl">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">✏️</span>
                  {editingFormulaMode === 'PRICE' ? 'Editor ceny za jednotku' : 'Editor vzorce'}
                  <span className="text-sm font-normal text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">
                    {localServices.find(s => s.id === editingFormulaServiceId)?.name}
                  </span>
                </h3>
                <button onClick={() => setEditingFormulaServiceId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg" title="Zavřít" aria-label="Zavřít">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                   {/* Left Column: Editor */}
                   <div className="flex flex-col gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-2">Vzorec</label>
                        <textarea
                          className="w-full h-32 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-mono text-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm text-gray-900 dark:text-white"
                          value={tempFormula}
                          onChange={(e) => setTempFormula(e.target.value)}
                          placeholder="Např. (TOTAL_COST * UNIT_SHARE) + FIXED_FEE"
                        />
                      </div>
                      
                      {/* Operátory */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Operátory</label>
                        <div className="flex flex-wrap gap-2">
                          {['+', '-', '*', '/', '(', ')'].map(op => (
                            <button
                              key={op}
                              onClick={() => insertIntoFormula(` ${op} `)}
                              className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl font-mono font-bold text-lg transition-all shadow-sm hover:shadow text-gray-700 dark:text-slate-200"
                            >
                              {op}
                            </button>
                          ))}
                          <button onClick={() => setTempFormula('')} className="px-4 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-medium ml-auto transition-colors">
                            Vymazat
                          </button>
                        </div>
                      </div>

                      {/* Proměnné */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Proměnné (kliknutím vložíte)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { code: 'TOTAL_COST', label: 'Náklad dům [D]', desc: 'Suma faktur pro tuto službu' },
                            { code: 'TOTAL_CONSUMPTION', label: 'Jednotek dům [E]', desc: 'Součet náměrů/ploch/osob' },
                            { code: 'UNIT_CONSUMPTION', label: 'Jednotek byt [G]', desc: 'Náměr/plocha/osoby bytu' },
                            { code: 'UNIT_SHARE', label: 'Podíl [C]', desc: 'Vlastnický podíl bytu' },
                            { code: 'UNIT_AREA', label: 'Plocha bytu (m²)', desc: 'Celková plocha bytu' },
                            { code: 'UNIT_PEOPLE', label: 'Počet osob', desc: 'Počet osob v bytě' },
                            { code: 'TOTAL_AREA', label: 'Celková plocha domu', desc: 'Součet ploch všech bytů' },
                            { code: 'TOTAL_PEOPLE', label: 'Celkem osob v domě', desc: 'Součet osob ve všech bytech' },
                            { code: 'UNIT_COUNT', label: 'Počet jednotek', desc: 'Celkový počet bytů v domě' },
                          ].map(v => (
                            <button
                              key={v.code}
                              onClick={() => insertIntoFormula(v.code)}
                              className="flex flex-col items-start p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl text-left transition-all group hover:shadow-sm"
                            >
                              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm mb-1">{v.code}</span>
                              <span className="text-xs text-gray-600 dark:text-slate-400">{v.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Čísla */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Čísla</label>
                        <div className="flex gap-2 flex-wrap">
                          {[0.1, 0.3, 0.5, 0.7, 100, 1000].map(n => (
                            <button
                              key={n}
                              onClick={() => insertIntoFormula(String(n))}
                              className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors shadow-sm"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>

                   {/* Right Column: Preview */}
                   <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span>👁️ Živý náhled</span>
                        </h4>
                        <select
                          value={selectedUnitId}
                          onChange={e => setSelectedUnitId(e.target.value)}
                          className="max-w-[200px] text-xs font-normal text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                          aria-label="Vybrat jednotku pro náhled"
                        >
                           {units.map(u => (
                            <option key={u.id} value={u.id}>
                              Byt {u.unitNumber} {u.owners?.[0]?.lastName ? `(${u.owners[0].lastName})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-6 flex-1">
                        {(() => {
                          const service = localServices.find(s => s.id === editingFormulaServiceId)
                          const ctx = service ? getCalculationContext(service, selectedUnitId) : null
                          
                          if (!ctx) return <div className="text-red-500 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">Nelze načíst kontext pro vybraný byt.</div>

                          let previewResult: number | string = '...'
                          let error = null
                          try {
                            let f = tempFormula
                            Object.entries(ctx).forEach(([k, v]) => { f = f.replace(new RegExp(k, 'g'), String(v)) })
                            if (f.trim()) {
                              previewResult = new Function('return ' + f)()
                            } else {
                              previewResult = 0
                            }
                          } catch {
                            error = 'Chyba ve vzorci'
                          }

                          return (
                            <>
                              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                <div className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Výsledek výpočtu</div>
                                {error ? (
                                  <div className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {error}
                                  </div>
                                ) : (
                                  <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                                    {typeof previewResult === 'number' ? previewResult.toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) : previewResult} Kč
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                <div className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Hodnoty proměnných pro tento byt</div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700 text-sm overflow-hidden">
                                  {Object.entries(ctx).map(([key, val]) => (
                                    <div key={key} className="flex justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                      <span className="font-mono text-gray-600 dark:text-slate-400">{key}</span>
                                      <span className="font-medium text-gray-900 dark:text-slate-200">{typeof val === 'number' ? val.toLocaleString('cs-CZ', { maximumFractionDigits: 4 }) : val}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end gap-3">
                <button
                  onClick={() => setEditingFormulaServiceId(null)}
                  className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Zrušit
                </button>
                <button
                  onClick={saveFormulaFromEditor}
                  className="px-6 py-2.5 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 shadow-sm hover:shadow transition-all"
                >
                  Uložit vzorec
                </button>
             </div>
          </div>
        </div>
      )}

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
            className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 font-bold shadow-sm transition-all flex items-center gap-2"
          >
            {importing ? (
               <>
                 <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>Nahrávám...</span>
               </>
            ) : (
               <>
                 <span>📤 Nahrát Excel</span>
               </>
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
                      const preview = calculatePreview(service)
                      const totalCost = filteredCosts.filter(c => c.serviceId === service.id).reduce((sum, c) => sum + c.amount, 0)
                      
                      let advance = advancesData[selectedUnitId]?.[service.id]?.total || 0
                      const overrideAdvance = unitOverrides[selectedUnitId]?.[service.id]?.advance
                      if (overrideAdvance && !isNaN(parseFloat(overrideAdvance))) {
                        advance = parseFloat(overrideAdvance)
                      }

                      const balance = advance - preview.unitCost
                      
                      return (
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
                                {totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400">
                                <input 
                                  type="text"
                                  className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                                  placeholder={preview.buildingAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                  value={globalOverrides[service.id]?.buildingUnits || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'buildingUnits', e.target.value)}
                                />
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-xs relative group">
                                {preview.unitPrice > 0 ? preview.unitPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                <button
                                  onClick={() => openFormulaEditor(service, 'PRICE')}
                                  className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                  title="Upravit vzorec ceny"
                                  aria-label="Upravit vzorec ceny"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              </td>
                              <td className="p-4 text-right font-medium text-gray-700 dark:text-gray-200 border-l border-gray-100 dark:border-slate-700">
                                <input 
                                  type="text"
                                  className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm font-bold"
                                  placeholder={preview.unitAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                  value={unitOverrides[selectedUnitId]?.[service.id]?.userUnits || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'userUnits', e.target.value)}
                                />
                              </td>
                              <td className="p-4 text-right font-bold text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg mx-2 relative group" title={preview.formula}>
                                {preview.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                                <button
                                  onClick={() => openFormulaEditor(service, 'COST')}
                                  className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-all"
                                  title="Upravit vzorec výpočtu"
                                  aria-label="Upravit vzorec výpočtu"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              </td>
                              <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                <input 
                                  type="text"
                                  className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                                  placeholder={advance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  value={unitOverrides[selectedUnitId]?.[service.id]?.advance || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'advance', e.target.value)}
                                />
                              </td>
                              <td className={`p-4 text-right font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {balance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => updateService(service.id, { isActive: !service.isActive })}
                                  className={`p-1 rounded-full transition-colors ${service.isActive !== false ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                                  title={service.isActive !== false ? 'Služba je aktivní (kliknutím skryjete)' : 'Služba je skrytá (kliknutím zobrazíte)'}
                                >
                                  {service.isActive !== false ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )}
                        </Draggable>
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
                        {displayedServices
                          .filter(s => s.isActive !== false)
                          .reduce((sum, s) => sum + calculatePreview(s).unitCost, 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className="p-4 text-right">
                        {displayedServices
                          .filter(s => s.isActive !== false)
                          .reduce((sum, s) => {
                            let advance = advancesData[selectedUnitId]?.[s.id]?.total || 0
                            const overrideAdvance = unitOverrides[selectedUnitId]?.[s.id]?.advance
                            if (overrideAdvance && !isNaN(parseFloat(overrideAdvance))) {
                              advance = parseFloat(overrideAdvance)
                            }
                            return sum + advance
                          }, 0)
                          .toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                      </td>
                      <td className={`p-4 text-right ${
                        displayedServices
                          .filter(s => s.isActive !== false)
                          .reduce((sum, s) => {
                            let advance = advancesData[selectedUnitId]?.[s.id]?.total || 0
                            const overrideAdvance = unitOverrides[selectedUnitId]?.[s.id]?.advance
                            if (overrideAdvance && !isNaN(parseFloat(overrideAdvance))) {
                              advance = parseFloat(overrideAdvance)
                            }
                            return sum + advance - calculatePreview(s).unitCost
                          }, 0) >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {displayedServices
                          .filter(s => s.isActive !== false)
                          .reduce((sum, s) => {
                            let advance = advancesData[selectedUnitId]?.[s.id]?.total || 0
                            const overrideAdvance = unitOverrides[selectedUnitId]?.[s.id]?.advance
                            if (overrideAdvance && !isNaN(parseFloat(overrideAdvance))) {
                              advance = parseFloat(overrideAdvance)
                            }
                            return sum + advance - calculatePreview(s).unitCost
                          }, 0)
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
