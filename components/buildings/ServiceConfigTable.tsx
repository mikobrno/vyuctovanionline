'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ServiceConfigTableProps {
  buildingId: string
  services: any[]
  units: any[]
  costs: any[]
}

export default function ServiceConfigTable({ buildingId, services, units, costs }: ServiceConfigTableProps) {
  const router = useRouter()
  const [localServices, setLocalServices] = useState(services)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || '')
  const [versions, setVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [showHiddenServices, setShowHiddenServices] = useState(false)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null)
  
  // State pro editor vzorců
  const [editingFormulaServiceId, setEditingFormulaServiceId] = useState<string | null>(null)
  const [tempFormula, setTempFormula] = useState('')

  // Získat unikátní názvy parametrů ze všech jednotek
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableParameters = Array.from(new Set(units.flatMap((u: any) => u.parameters?.map((p: any) => p.name) || []))).sort() as string[]

  useEffect(() => {
    setLocalServices(services)
  }, [services])

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data)
      }
    } finally {
      setLoadingVersions(false)
    }
  }, [buildingId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const saveVersion = async () => {
    if (!newVersionName.trim()) return
    setSavingVersion(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVersionName })
      })
      if (res.ok) {
        setNewVersionName('')
        setShowVersionModal(false)
        loadVersions()
      }
    } finally {
      setSavingVersion(false)
    }
  }

  const restoreVersion = async (versionId: string) => {
    if (!confirm('Opravdu chcete obnovit toto nastavení? Současné změny budou přepsány.')) return
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${versionId}`, {
        method: 'POST'
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (e) {
      alert('Chyba při obnově verze')
    }
  }

  const deleteVersion = async (versionId: string) => {
    if (!confirm('Opravdu smazat tuto verzi?')) return
    try {
      const res = await fetch(`/api/buildings/${buildingId}/config-versions/${versionId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        loadVersions()
      }
    } catch (e) {
      alert('Chyba při mazání')
    }
  }

  const updateLocalService = (serviceId: string, field: string, value: any) => {
    setLocalServices(prev => prev.map(s => s.id === serviceId ? { ...s, [field]: value } : s))
  }

  const saveServiceChange = async (serviceId: string, field: string, value: any) => {
    try {
      await fetch(`/api/buildings/${buildingId}/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      router.refresh()
    } catch (e) {
      console.error('Failed to update service', e)
    }
  }

  const handleMethodologyChange = async (serviceId: string, value: string) => {
    let methodology = value;
    let dataSourceName = null;
    let dataSourceType = null;

    if (value.startsWith('METER_READING_')) {
      methodology = 'METER_READING';
      const type = value.replace('METER_READING_', '');
      if (type !== 'AUTO') dataSourceName = type;
      dataSourceType = 'METER_DATA';
    } else if (value.startsWith('METER_COST_')) {
      methodology = 'METER_READING';
      const type = value.replace('METER_COST_', '');
      dataSourceName = type;
      dataSourceType = 'FIXED_AMOUNT';
    }

    // Update local state
    setLocalServices(prev => prev.map(s => s.id === serviceId ? { ...s, methodology, dataSourceName, dataSourceType } : s));

    // Save to server
    try {
      await fetch(`/api/buildings/${buildingId}/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodology, dataSourceName, dataSourceType })
      })
      router.refresh()
    } catch (e) {
      console.error('Failed to update service methodology', e)
    }
  }

  const toggleServiceVisibility = async (serviceId: string, currentStatus: boolean) => {
    // Optimistic update
    setLocalServices(prev => prev.map(s => s.id === serviceId ? { ...s, isActive: !currentStatus } : s))

    try {
      await fetch(`/api/buildings/${buildingId}/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })
      router.refresh()
    } catch (e) {
      console.error('Failed to toggle service visibility', e)
      // Revert on error
      setLocalServices(prev => prev.map(s => s.id === serviceId ? { ...s, isActive: currentStatus } : s))
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement
    // Prevent dragging when interacting with form elements
    if (['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA'].includes(target.tagName) || target.closest('select') || target.closest('input') || target.closest('button')) {
      e.preventDefault()
      return
    }
    setDraggedItemIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Optional: set drag image or style
    if (e.currentTarget instanceof HTMLElement) {
       e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
       e.currentTarget.style.opacity = '1'
    }
    setDraggedItemIndex(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return

    const visible = localServices.filter(s => showHiddenServices || s.isActive !== false)
    const newVisible = [...visible]
    const [movedItem] = newVisible.splice(draggedItemIndex, 1)
    newVisible.splice(targetIndex, 0, movedItem)

    // Assign new orders to visible items
    const updatedVisible = newVisible.map((s, i) => ({ ...s, order: i + 1 }))

    // Merge back into localServices
    const newLocalServices = localServices.map(s => {
      const updated = updatedVisible.find(u => u.id === s.id)
      return updated ? { ...s, order: updated.order } : s
    }).sort((a, b) => (a.order || 0) - (b.order || 0))

    setLocalServices(newLocalServices)
    setDraggedItemIndex(null)
    
    if (e.currentTarget instanceof HTMLElement) {
       e.currentTarget.style.opacity = '1'
    }

    // Save changes
    const promises = updatedVisible.map(s => {
        const original = visible.find(v => v.id === s.id)
        // Save if order changed or if it's the moved item (to be safe)
        if (original && original.order !== s.order) {
             return fetch(`/api/buildings/${buildingId}/services/${s.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: s.order })
              })
        }
        return Promise.resolve()
    })

    try {
        await Promise.all(promises)
    } catch (err) {
        console.error('Failed to save order', err)
        router.refresh()
    }
  }

  // Pomocná funkce pro získání kontextu výpočtu (proměnných)
  const getCalculationContext = (service: any, unitId: string) => {
    const unit = units.find(u => u.id === unitId)
    if (!unit) return null

    const totalCost = costs
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

    return {
      TOTAL_COST: totalCost,
      UNIT_SHARE: unit.shareDenominator ? (unit.shareNumerator / unit.shareDenominator) : 0,
      UNIT_AREA: unit.totalArea || 0,
      UNIT_PEOPLE: unit.residents || 0,
      UNIT_CONSUMPTION: unitConsumption,
      TOTAL_CONSUMPTION: totalConsumption,
      TOTAL_AREA: totalArea,
      TOTAL_PEOPLE: totalPeople
    }
  }

  // Výpočet náhledu pro vybranou jednotku
  const calculatePreview = (service: any) => {
    if (!selectedUnitId) return '-'
    const unit = units.find(u => u.id === selectedUnitId)
    if (!unit) return '-'

    const totalCost = costs
      .filter(c => c.serviceId === service.id)
      .reduce((sum, c) => sum + c.amount, 0)

    // Pro METER_READING a CUSTOM nemusí být totalCost > 0, pokud je fixní cena nebo vzorec
    if (totalCost === 0 && service.methodology !== 'METER_READING' && service.methodology !== 'CUSTOM') return '0 Kč (bez nákladů)'

    let result = 0
    let explanation = ''

    switch (service.methodology) {
      case 'OWNERSHIP_SHARE':
        const totalShare = units.reduce((sum, u) => sum + (u.shareNumerator || 0), 0)
        if (totalShare > 0) {
          result = totalCost * (unit.shareNumerator / totalShare)
          explanation = `Podíl: ${unit.shareNumerator}/${totalShare}`
        }
        break
      case 'AREA':
        const totalArea = units.reduce((sum, u) => sum + (u.totalArea || 0), 0)
        if (totalArea > 0) {
          result = totalCost * (unit.totalArea / totalArea)
          explanation = `Plocha: ${unit.totalArea} m²`
        }
        break
      case 'EQUAL_SPLIT':
        const divisor = service.divisor || units.length
        if (divisor > 0) {
          result = totalCost / divisor
          explanation = `1/${divisor} (dělitel)`
        }
        break
      case 'FIXED_PER_UNIT':
        if (service.fixedAmountPerUnit) {
          result = service.fixedAmountPerUnit
          explanation = `Fixní částka`
        } else {
          const count = units.length
          if (count > 0) {
            result = totalCost / count
            explanation = `1/${count} jednotek`
          }
        }
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
           
           if (totalParamValue > 0) {
             result = totalCost * (val / totalParamValue)
             explanation = `${paramName}: ${val} / ${totalParamValue}`
           } else {
             explanation = `${paramName}: ${val} (Celkem 0)`
           }
        } else {
          explanation = 'Není vybrán parametr'
        }
        break
      case 'PERSON_MONTHS':
        const totalPeople = units.reduce((sum, u) => sum + (u.residents || 0), 0)
        if (totalPeople > 0) {
          result = totalCost * ((unit.residents || 0) / totalPeople)
          explanation = `Osoby: ${unit.residents || 0}/${totalPeople}`
        }
        break
      case 'METER_READING':
        // Simulace spotřeby (zde nemáme přístup k DB, tak jen odhadneme nebo zobrazíme placeholder)
        // V reálu by to chtělo načíst spotřebu jednotky, ale to je složité na klientovi.
        // Zkusíme najít spotřebu v unit.meters (pokud tam je)
        let consumption = 0
        let precalculatedCost = 0
        
        const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV')
        const isHeating = service.name.toLowerCase().includes('teplo')
        const isElectricity = service.name.toLowerCase().includes('elek')
        
        if (unit.meters) {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const meters = unit.meters.filter((m: any) => {
             if (service.dataSourceName) {
               // Pokud je explicitně určen typ (např. z dropdownu)
               return m.type === service.dataSourceName || m.type === service.dataSourceName.replace('METER_COST_', '')
             }
             // Fallback podle názvu
             if (isWater) return (m.type === 'COLD_WATER' || m.type === 'HOT_WATER')
             if (isHeating) return m.type === 'HEATING'
             if (isElectricity) return m.type === 'ELECTRICITY'
             return false
           })
           
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           meters.forEach((m: any) => {
             if (m.readings && m.readings[0]) {
               consumption += (m.readings[0].consumption ?? m.readings[0].value ?? 0)
               if (m.readings[0].precalculatedCost) {
                 precalculatedCost += m.readings[0].precalculatedCost
               }
             }
           })
        }
        
        if (service.dataSourceType === 'FIXED_AMOUNT') {
           // Varianta "Náklad" - zobrazíme přímo načtený náklad
           if (precalculatedCost > 0) {
             result = precalculatedCost
             explanation = `Externí náklad (z měřidel)`
           } else {
             explanation = `Žádný externí náklad nenalezen`
           }
        } else {
           // Varianta "Náměr"
           if (service.unitPrice) {
             result = consumption * service.unitPrice
             explanation = `${consumption.toFixed(2)} jedn. * ${service.unitPrice} Kč`
           } else {
             explanation = `Spotřeba: ${consumption.toFixed(2)} jedn. (cena neurčena)`
           }
        }
        break
      case 'CUSTOM':
        if (service.customFormula) {
           try {
             const vars = getCalculationContext(service, selectedUnitId)
             if (!vars) return 'Chyba kontextu'

             let f = service.customFormula
             Object.entries(vars).forEach(([k, v]) => { f = f.replace(new RegExp(k, 'g'), String(v)) })
             
             result = new Function('return ' + f)()
             explanation = `Vzorec: ${service.customFormula}`
           } catch {
             explanation = 'Chyba vzorce'
           }
        } else {
          explanation = 'Vzorec nezadán'
        }
        break
      default:
        return '?'
    }

    return (
      <div className="text-xs">
        <div className="font-bold">{result.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč</div>
        <div className="text-gray-500">{explanation}</div>
      </div>
    )
  }

  // Otevření editoru vzorců
  const openFormulaEditor = (service: any) => {
    setEditingFormulaServiceId(service.id)
    setTempFormula(service.customFormula || '')
  }

  const insertIntoFormula = (text: string) => {
    setTempFormula(prev => prev + text)
  }

  const saveFormulaFromEditor = async () => {
    if (!editingFormulaServiceId) return
    
    // Update local state
    setLocalServices(prev => prev.map(s => s.id === editingFormulaServiceId ? { ...s, customFormula: tempFormula } : s))
    
    // Save to server
    try {
      await fetch(`/api/buildings/${buildingId}/services/${editingFormulaServiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customFormula: tempFormula })
      })
      setEditingFormulaServiceId(null)
      router.refresh()
    } catch (e) {
      console.error('Failed to save formula', e)
    }
  }

  const visibleServices = localServices.filter(s => showHiddenServices || s.isActive !== false)
  const totalCostsSum = visibleServices.reduce((sum, service) => {
    const serviceCost = costs
      .filter(c => c.serviceId === service.id)
      .reduce((cSum, c) => cSum + c.amount, 0)
    return sum + serviceCost
  }, 0)

  return (
    <div className="space-y-6">
      {/* Editor vzorců Modal */}
      {editingFormulaServiceId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700">
             <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 rounded-t-2xl">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">✏️</span>
                  Editor vzorce
                  <span className="text-sm font-normal text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">
                    {localServices.find(s => s.id === editingFormulaServiceId)?.name}
                  </span>
                </h3>
                <button onClick={() => setEditingFormulaServiceId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
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
                            { code: 'TOTAL_COST', label: 'Celkový náklad (Kč)', desc: 'Suma faktur pro tuto službu' },
                            { code: 'TOTAL_CONSUMPTION', label: 'Celková spotřeba', desc: 'Součet náměrů všech bytů' },
                            { code: 'UNIT_CONSUMPTION', label: 'Spotřeba bytu', desc: 'Náměr vybraného bytu' },
                            { code: 'UNIT_SHARE', label: 'Vlastnický podíl', desc: 'Podíl bytu na domě' },
                            { code: 'UNIT_AREA', label: 'Plocha bytu (m²)', desc: 'Celková plocha bytu' },
                            { code: 'UNIT_PEOPLE', label: 'Počet osob', desc: 'Počet osob v bytě' },
                            { code: 'TOTAL_AREA', label: 'Celková plocha domu', desc: 'Součet ploch všech bytů' },
                            { code: 'TOTAL_PEOPLE', label: 'Celkem osob v domě', desc: 'Součet osob ve všech bytech' },
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
                      <h4 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                        <span>👁️ Živý náhled</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">Byt {units.find(u => u.id === selectedUnitId)?.unitNumber}</span>
                      </h4>
                      
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
                          } catch (e) {
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

      {/* Horní lišta s verzemi */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Verze nastavení:</h3>
          <select 
            aria-label="Vybrat verzi"
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            onChange={(e) => {
              if (e.target.value) restoreVersion(e.target.value)
            }}
            value=""
          >
            <option value="">-- Vybrat uloženou verzi --</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({new Date(v.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowVersionModal(true)}
          className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors shadow-sm"
        >
          💾 Uložit aktuální nastavení
        </button>
      </div>

      {/* Modální okno pro uložení verze */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl w-96 border border-gray-200 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Uložit verzi nastavení</h3>
            <input
              type="text"
              placeholder="Název verze (např. Import 2024)"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-3 mb-6 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              value={newVersionName}
              onChange={e => setNewVersionName(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowVersionModal(false)}
                className="px-5 py-2.5 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={saveVersion}
                disabled={savingVersion || !newVersionName}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-medium shadow-sm transition-colors"
              >
                {savingVersion ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabulka služeb */}
      <div className="bg-white dark:bg-slate-800 shadow-sm rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Nastavení výpočtů</h3>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={showHiddenServices}
                  onChange={(e) => setShowHiddenServices(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 bg-white dark:bg-slate-900"
                />
                Zobrazit skryté služby
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-slate-400">Náhled pro jednotku:</span>
              <select
                aria-label="Vybrat jednotku pro náhled"
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm w-40 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.unitNumber}</option>
                ))}
              </select>
            </div>
          </div>

          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium select-none transition-colors">
              <span>ℹ️ Nápověda k rozšířeným možnostem a proměnným</span>
              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-4 p-5 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-sm text-gray-700 dark:text-slate-300 space-y-3 border border-teal-100 dark:border-teal-800/30">
              <p className="font-semibold text-teal-900 dark:text-teal-100">Dostupné proměnné pro vlastní vzorce (CUSTOM):</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600 dark:text-slate-400">
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">TOTAL_COST</code> - Celkový náklad na službu za dům (Kč)</li>
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">TOTAL_CONSUMPTION</code> - Celková spotřeba domu (m³, kWh) - <em>pouze pro měřené služby</em></li>
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">UNIT_CONSUMPTION</code> - Spotřeba konkrétní jednotky (m³, kWh)</li>
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">UNIT_SHARE</code> - Vlastnický podíl jednotky (např. 0.054)</li>
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">UNIT_AREA</code> - Celková plocha jednotky (m²)</li>
                <li><code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-xs">UNIT_PEOPLE</code> - Počet osob v jednotce</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
                Příklad vzorce pro kombinovaný výpočet (30% plocha, 70% spotřeba):<br/>
                <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700 font-mono mt-1 block w-fit">(TOTAL_COST * 0.3 * UNIT_AREA / TOTAL_AREA) + (TOTAL_COST * 0.7 * UNIT_CONSUMPTION / TOTAL_CONSUMPTION)</code>
              </p>
            </div>
          </details>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Služba</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Náklad</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Způsob rozúčtování</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Parametry</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/10">Náhled výpočtu</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {localServices
              .filter(s => showHiddenServices || s.isActive !== false)
              .map((service, index) => {
              const totalCost = costs
                .filter(c => c.serviceId === service.id)
                .reduce((sum, c) => sum + c.amount, 0)
              
              const isHidden = service.isActive === false

              return (
                <tr 
                  key={service.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 ${isHidden ? 'bg-gray-50 dark:bg-slate-800/50 opacity-60' : ''} cursor-move transition-colors duration-200 ${draggedItemIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleServiceVisibility(service.id, !isHidden)}
                        className={`mt-1 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors ${isHidden ? 'text-gray-400 dark:text-slate-500' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}
                        title={isHidden ? "Zobrazit službu" : "Skrýt službu"}
                      >
                        {isHidden ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{service.code}</div>
                        {isHidden && <span className="text-[10px] text-red-500 dark:text-red-400 font-medium uppercase tracking-wider">Skryto</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                    {totalCost.toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      aria-label="Způsob rozúčtování"
                      value={
                        service.methodology === 'METER_READING' 
                          ? (service.dataSourceType === 'FIXED_AMOUNT' 
                              ? `METER_COST_${service.dataSourceName}` 
                              : `METER_READING_${service.dataSourceName || 'AUTO'}`)
                          : service.methodology
                      }
                      onChange={(e) => handleMethodologyChange(service.id, e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white border"
                    >
                      <option value="OWNERSHIP_SHARE">Vlastnický podíl</option>
                      <option value="AREA">Podle výměry</option>
                      <option value="PERSON_MONTHS">Osobo-měsíce</option>
                      <optgroup label="Podle měřidel (Náměr)">
                        <option value="METER_READING_AUTO">Automaticky (podle názvu)</option>
                        <option value="METER_READING_HOT_WATER">Vodoměry TUV | náměr</option>
                        <option value="METER_READING_COLD_WATER">Vodoměry SV | náměr</option>
                        <option value="METER_READING_HEATING">Teplo | náměr</option>
                        <option value="METER_READING_ELECTRICITY">Elektroměry | náměr</option>
                      </optgroup>
                      <optgroup label="Podle měřidel (Náklad)">
                        <option value="METER_COST_HOT_WATER">Vodoměry TUV | náklad</option>
                        <option value="METER_COST_COLD_WATER">Vodoměry SV | náklad</option>
                        <option value="METER_COST_HEATING">Teplo | náklad</option>
                        <option value="METER_COST_ELECTRICITY">Elektroměry | náklad</option>
                      </optgroup>
                      <option value="FIXED_PER_UNIT">Fixní částka/byt</option>
                      <option value="EQUAL_SPLIT">Rovným dílem</option>
                      <option value="UNIT_PARAMETER">Podle parametru (Excel)</option>
                      <option value="CUSTOM">Vlastní vzorec</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {service.methodology === 'UNIT_PARAMETER' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-slate-400">Vyberte parametr</label>
                        <select
                          aria-label="Vyberte parametr"
                          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          value={service.unitAttributeName || ''}
                          onChange={(e) => updateLocalService(service.id, 'unitAttributeName', e.target.value)}
                          onBlur={(e) => saveServiceChange(service.id, 'unitAttributeName', e.target.value)}
                        >
                          <option value="">-- Vyberte --</option>
                          {availableParameters.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {availableParameters.length === 0 && (
                          <span className="text-[10px] text-red-500 dark:text-red-400">Žádné parametry nenalezeny. Importujte je v sekci Parametry.</span>
                        )}
                      </div>
                    )}
                    {service.methodology === 'METER_READING' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-slate-400">Cena za jednotku (Kč)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Vypočítat z nákladu"
                          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          value={service.unitPrice || ''}
                          onChange={(e) => updateLocalService(service.id, 'unitPrice', e.target.value)}
                          onBlur={(e) => saveServiceChange(service.id, 'unitPrice', e.target.value ? parseFloat(e.target.value) : null)}
                        />
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {!service.unitPrice 
                            ? 'Automaticky: (Náklad / Celk. spotřeba) * Spotřeba jednotky' 
                            : 'Fixní cena: Spotřeba jednotky * Zadaná cena'}
                        </span>
                      </div>
                    )}
                    {service.methodology === 'EQUAL_SPLIT' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-slate-400">Dělitel (počet jednotek)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={`Výchozí: ${units.length}`}
                          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          value={service.divisor || ''}
                          onChange={(e) => updateLocalService(service.id, 'divisor', e.target.value)}
                          onBlur={(e) => saveServiceChange(service.id, 'divisor', e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </div>
                    )}
                    {service.methodology === 'FIXED_PER_UNIT' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-slate-400">Fixní částka (Kč)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Zadejte částku"
                          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          value={service.fixedAmountPerUnit || ''}
                          onChange={(e) => updateLocalService(service.id, 'fixedAmountPerUnit', e.target.value)}
                          onBlur={(e) => saveServiceChange(service.id, 'fixedAmountPerUnit', e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </div>
                    )}
                    {service.methodology === 'CUSTOM' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            placeholder="Klikněte pro úpravu vzorce"
                            className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full font-mono bg-gray-50 dark:bg-slate-800 cursor-pointer text-gray-900 dark:text-white"
                            value={service.customFormula || ''}
                            onClick={() => openFormulaEditor(service)}
                          />
                          <button
                            onClick={() => openFormulaEditor(service)}
                            className="px-2 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg text-xs hover:bg-teal-100 dark:hover:bg-teal-900/30 whitespace-nowrap transition-colors"
                          >
                            ✏️ Upravit
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight">
                          Klikněte pro otevření editoru vzorců
                        </div>
                      </div>
                    )}
                    {service.methodology === 'OWNERSHIP_SHARE' && (
                      <input
                        type="text"
                        placeholder="Atribut (nepovinné)"
                        className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        value={service.unitAttributeName || ''}
                        onChange={(e) => updateLocalService(service.id, 'unitAttributeName', e.target.value)}
                        onBlur={(e) => saveServiceChange(service.id, 'unitAttributeName', e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap bg-blue-50/50 dark:bg-blue-900/10">
                    {calculatePreview(service)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-slate-800/50 font-bold border-t-2 border-gray-200 dark:border-slate-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">CELKEM</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                {totalCostsSum.toLocaleString('cs-CZ')} Kč
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
