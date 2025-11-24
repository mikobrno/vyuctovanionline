'use client'

import { useState, useEffect, useMemo } from 'react'
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

  // State pro zálohy
  const [advancesData, setAdvancesData] = useState<Record<string, Record<string, { total: number }>>>({})
  
  // State pro manuální přepisy hodnot [serviceId]: { buildingUnits?: string, userUnits?: string, share?: string, advance?: string }
  const [manualOverrides, setManualOverrides] = useState<Record<string, { buildingUnits?: string, userUnits?: string, share?: string, advance?: string }>>({})

  useEffect(() => {
    setLocalServices(services)
    // Initialize overrides from service configuration (divisor)
    const initialOverrides: Record<string, any> = {}
    services.forEach(s => {
      if (s.divisor) {
        initialOverrides[s.id] = { buildingUnits: s.divisor.toString() }
      }
    })
    setManualOverrides(prev => ({ ...prev, ...initialOverrides }))
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

  // Pomocné výpočty pro celý dům
  const buildingStats = useMemo(() => {
    const totalArea = units.reduce((sum, u) => sum + (u.totalArea || 0), 0)
    const totalPersonMonths = units.reduce((sum, u) => {
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
          const meter = u.meters?.find((m: any) => m.type === meterType && m.isActive)
          const reading = meter?.readings?.[0] 
          return sum + (reading?.consumption || 0)
        }, 0)
        consumptionByService[service.id] = totalConsumption
      }
    })

    return { totalArea, totalPersonMonths, unitCount, consumptionByService }
  }, [units, localServices])

  // Výpočet náhledu pro řádek
  const calculatePreview = (service: any) => {
    if (!selectedUnit) return { unitCost: 0, unitShare: 0, unitAmount: 0, unitPrice: 0, buildingAmount: 0, formula: '' }

    const totalCost = costs
      .filter(c => c.serviceId === service.id)
      .reduce((sum, c) => sum + c.amount, 0)

    let unitCost = 0
    let unitShare = 0 
    let unitAmount = 0 
    let unitPrice = 0 
    let buildingAmount = 0
    let formula = ''

    // 1. Určení základních hodnot podle metodiky
    switch (service.method) {
      case 'OWNERSHIP_SHARE':
        buildingAmount = 1 // Celý dům je 1 celek (nebo součet podílů, což je 1)
        unitAmount = (selectedUnit.shareNumerator || 0) / (selectedUnit.shareDenominator || 1)
        break
      
      case 'AREA':
        buildingAmount = buildingStats.totalArea
        unitAmount = selectedUnit.totalArea || 0
        break
      
      case 'PERSON_MONTHS':
        buildingAmount = buildingStats.totalPersonMonths
        unitAmount = selectedUnit.personMonths?.reduce((s: number, pm: any) => s + pm.personCount, 0) || 0
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
        const meter = selectedUnit.meters?.find((m: any) => m.type === meterType && m.isActive)
        
        buildingAmount = buildingStats.consumptionByService[service.id] || 0
        unitAmount = meter?.readings?.[0]?.consumption || 0
        break
        
      case 'FIXED_PER_UNIT':
        buildingAmount = 0
        unitAmount = 1
        break
    }

    // 2. Aplikace manuálních přepisů (pokud existují)
    const overrides = manualOverrides[service.id]
    if (overrides?.buildingUnits && !isNaN(parseFloat(overrides.buildingUnits))) {
      buildingAmount = parseFloat(overrides.buildingUnits)
    }
    if (overrides?.userUnits && !isNaN(parseFloat(overrides.userUnits))) {
      unitAmount = parseFloat(overrides.userUnits)
    }

    // 3. Výpočet ceny
    if (service.method === 'FIXED_PER_UNIT') {
      // Zde by měla být logika pro fixní cenu, zatím 0 nebo placeholder
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

    // Override pro podíl (pokud je zadán ručně)
    if (overrides?.share && !isNaN(parseFloat(overrides.share))) {
      unitShare = parseFloat(overrides.share)
      unitAmount = (unitShare / 100) * buildingAmount
      unitCost = unitAmount * unitPrice
    }

    return { unitCost, unitShare, unitAmount, unitPrice, buildingAmount, formula }
  }

  // Handler pro změnu manuálních hodnot
  const handleOverrideChange = (serviceId: string, field: 'buildingUnits' | 'userUnits' | 'share' | 'advance', value: string) => {
    setManualOverrides(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value
      }
    }))
  }

  // Uložení změn
  const handleSave = async () => {
    setSaving(true)
    try {
      // Prepare services with overrides
      const servicesToSave = localServices.map(s => ({
        ...s,
        divisor: manualOverrides[s.id]?.buildingUnits || null // Save building units override as divisor
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
          manualOverrides // Save overrides with version
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
        setManualOverrides(data.config.manualOverrides)
      }

      const updatedServices = localServices.map(s => {
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
    } catch (e) {
      alert('Chyba při načítání verze')
    }
  }

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

  const updateService = (serviceId: string, updates: any) => {
    setLocalServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, ...updates } : s
    ))
  }

  const displayedServices = localServices.filter(s => showHiddenServices || s.isActive !== false)

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

        <button
          onClick={handleSave}
          disabled={saving}
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
              <button onClick={saveVersion} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors">Uložit</button>
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
                      <th className="p-4 w-10"></th>
                      <th className="p-4 text-left">Služba</th>
                      <th className="p-4 text-left">Metodika výpočtu</th>
                      <th className="p-4 text-right">Podíl</th>
                      <th className="p-4 text-right">Náklad (dům)</th>
                      <th className="p-4 text-right">Jednotek (dům)</th>
                      <th className="p-4 text-right">Cena/jedn.</th>
                      <th className="p-4 text-right">Jednotek (byt)</th>
                      <th className="p-4 text-right">Náklad (byt)</th>
                      <th className="p-4 text-right">Záloha</th>
                      <th className="p-4 text-right">Výsledek</th>
                      <th className="p-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {displayedServices.map((service, index) => {
                      const preview = calculatePreview(service)
                      const totalCost = costs.filter(c => c.serviceId === service.id).reduce((sum, c) => sum + c.amount, 0)
                      
                      let advance = advancesData[selectedUnitId]?.[service.id]?.total || 0
                      const overrideAdvance = manualOverrides[service.id]?.advance
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
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                              </td>
                              <td className="p-4 font-semibold text-gray-900 dark:text-white">
                                {service.name}
                              </td>
                              <td className="p-4">
                                <div className="relative">
                                  <select
                                    value={service.method}
                                    onChange={(e) => updateService(service.id, { method: e.target.value })}
                                    className="w-full bg-transparent border-none text-sm focus:ring-0 p-0 cursor-pointer text-gray-600 dark:text-gray-300 font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    <option value="OWNERSHIP_SHARE">Vlastnický podíl</option>
                                    <option value="AREA">Podlahová plocha (m²)</option>
                                    <option value="PERSON_MONTHS">Osobo-měsíce</option>
                                    <option value="METER_READING">Odečet měřidla</option>
                                    <option value="EQUAL_SPLIT">Rovným dílem</option>
                                    <option value="FIXED_PER_UNIT">Fixní částka na byt</option>
                                    <option value="NO_BILLING">Nevyúčtovávat</option>
                                  </select>
                                </div>
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-xs">
                                <div className="flex items-center justify-end gap-1 group">
                                  <input 
                                    type="text"
                                    className="w-12 text-right border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-xs transition-colors"
                                    placeholder={preview.unitShare > 0 ? preview.unitShare.toFixed(1) : '-'}
                                    value={manualOverrides[service.id]?.share || ''}
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
                                  value={manualOverrides[service.id]?.buildingUnits || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'buildingUnits', e.target.value)}
                                />
                              </td>
                              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-xs">
                                {preview.unitPrice > 0 ? preview.unitPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                              </td>
                              <td className="p-4 text-right font-medium text-gray-700 dark:text-gray-200">
                                <input 
                                  type="text"
                                  className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm font-bold"
                                  placeholder={preview.unitAmount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
                                  value={manualOverrides[service.id]?.userUnits || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'userUnits', e.target.value)}
                                />
                              </td>
                              <td className="p-4 text-right font-bold text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg mx-2" title={preview.formula}>
                                {preview.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                              </td>
                              <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                <input 
                                  type="text"
                                  className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                                  placeholder={advance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  value={manualOverrides[service.id]?.advance || ''}
                                  onChange={(e) => handleOverrideChange(service.id, 'advance', e.target.value)}
                                />
                              </td>
                              <td className={`p-4 text-right font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {balance.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => updateService(service.id, { isActive: !service.isActive })}
                                  className={`p-1 rounded-full transition-colors ${service.isActive !== false ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                                  title={service.isActive !== false ? 'Služba je aktivní' : 'Služba je skrytá'}
                                >
                                  {service.isActive !== false ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
                      <td colSpan={4} className="p-4 text-left uppercase text-xs tracking-wider text-gray-500 dark:text-gray-400">Celkem náklady na odběrné místo</td>
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
                            const overrideAdvance = manualOverrides[s.id]?.advance
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
                            const overrideAdvance = manualOverrides[s.id]?.advance
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
                            const overrideAdvance = manualOverrides[s.id]?.advance
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
        <p className="mt-0.5"><strong>Tip:</strong> Hodnoty ve sloupcích &quot;Jednotek (dům)&quot; a &quot;Jednotek (byt)&quot; můžete ručně přepsat kliknutím do pole. Změny se ihned projeví ve výpočtu. Pro zobrazení vzorce najeďte myší na částku &quot;Náklad (byt)&quot;.</p>
      </div>
    </div>
  )
}
