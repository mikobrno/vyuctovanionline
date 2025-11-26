'use client'

import { useState } from 'react'
import Link from 'next/link'

interface BillingResultsViewerProps {
  buildingId: string
  billingPeriods: Array<{
    id: string
    year: number
    status: string
    totalCosts: number
    calculatedAt: Date | null
    results: Array<{
      id: string
      unitId: string
      totalCost: number
      totalAdvancePrescribed: number
      repairFund: number
      result: number
      isPaid: boolean
      unit: {
        id: string
        name: string
        unitNumber: string
        variableSymbol: string | null
        ownerships: Array<{
          owner: {
            firstName: string
            lastName: string
            email: string | null
          }
        }>
      }
      serviceCosts: Array<{
        serviceId: string
        unitCost: number
        buildingTotalCost: number
        calculationBasis: string | null
        service: {
          name: string
          code: string
          isActive: boolean
          order?: number
          serviceGroupId?: string | null
          serviceGroup?: {
            label: string
          } | null
        }
      }>
    }>
  }>
}

export default function BillingResultsViewer({ buildingId, billingPeriods }: BillingResultsViewerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    billingPeriods.length > 0 ? billingPeriods[0].id : ''
  )
  const [sendingAll, setSendingAll] = useState(false)
  const [showHiddenServices, setShowHiddenServices] = useState(false)
  const [sendResult, setSendResult] = useState<{
    sentEmail: number
    sentSms: number
    failed: number
    skipped: number
    errors: string[]
  } | null>(null)

  const currentPeriod = billingPeriods.find(p => p.id === selectedPeriod)

  // Seřadit výsledky podle čísla jednotky
  const sortedResults = currentPeriod ? [...currentPeriod.results].sort((a, b) => {
    return a.unit.unitNumber.localeCompare(b.unit.unitNumber, undefined, { numeric: true })
  }) : []

  // Získat všechny unikátní služby (nebo skupiny) pro hlavičku tabulky
  const allServicesMap = new Map<string, { name: string, isActive: boolean, order: number, isGroup: boolean, serviceIds: string[] }>()
  
  if (currentPeriod) {
    currentPeriod.results.forEach(r => {
      r.serviceCosts.forEach(sc => {
        const isActive = sc.service.isActive ?? true
        const order = sc.service.order ?? 0
        
        if (sc.service.serviceGroupId && sc.service.serviceGroup) {
           const groupId = sc.service.serviceGroupId
           if (!allServicesMap.has(groupId)) {
             allServicesMap.set(groupId, {
               name: sc.service.serviceGroup.label,
               isActive: true, 
               order: order, 
               isGroup: true,
               serviceIds: [sc.serviceId]
             })
           } else {
             const group = allServicesMap.get(groupId)!
             if (!group.serviceIds.includes(sc.serviceId)) {
               group.serviceIds.push(sc.serviceId)
             }
           }
        } else {
           if (!allServicesMap.has(sc.serviceId)) {
             allServicesMap.set(sc.serviceId, {
               name: sc.service.name,
               isActive,
               order,
               isGroup: false,
               serviceIds: [sc.serviceId]
             })
           }
        }
      })
    })
  }

  const services = Array.from(allServicesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter(s => showHiddenServices || s.isActive)
    .sort((a, b) => a.order - b.order)

  const handleSendAllNotifications = async () => {
    if (!currentPeriod) return
    
    if (!confirm(`Opravdu chcete odeslat notifikace (Email + SMS) všem vlastníkům v období ${currentPeriod.year}?`)) {
      return
    }

    try {
      setSendingAll(true)
      setSendResult(null)

      const response = await fetch(`/api/buildings/${buildingId}/billing-periods/${currentPeriod.id}/send-all-notifications`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || 'Nepodařilo se odeslat notifikace')
      }

      setSendResult(data.details)
      
      // Obnovit stránku za 3 sekundy
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Nepodařilo se odeslat notifikace')
    } finally {
      setSendingAll(false)
    }
  }

  const handleTestEmail = async (resultId: string) => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'kost@onlinesprava.cz' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací email odeslán na kost@onlinesprava.cz!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleTestSms = async (resultId: string) => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '777338203' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací SMS odeslána na 777338203!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  if (billingPeriods.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-800/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400 text-2xl">
          ⚠️
        </div>
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2">
          Zatím nebylo vygenerováno žádné vyúčtování
        </h3>
        <p className="text-amber-800 dark:text-amber-300 max-w-md mx-auto">
          Pro vytvoření vyúčtování přejděte na záložku <strong>Generování</strong> a spusťte výpočet pro požadované období.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Výběr období */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Vyberte období vyúčtování
        </label>
        <div className="relative max-w-md">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white appearance-none font-medium"
            aria-label="Výběr období vyúčtování"
          >
            {billingPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                Rok {period.year} - {period.status} ({period.totalCosts.toLocaleString('cs-CZ')} Kč)
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {currentPeriod && (
        <>
          {/* Akční tlačítka a notifikace */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    📨
                  </span>
                  Hromadné odeslání
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-9">
                  Odeslat vyúčtování všem vlastníkům (Email + SMS)
                </p>
              </div>
              <button
                onClick={handleSendAllNotifications}
                disabled={sendingAll}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              >
                {sendingAll ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Odesílám...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    Odeslat vše (Email + SMS)
                  </>
                )}
              </button>
            </div>
            
            {sendResult && (
              <div className="mt-4 p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Výsledek odesílání
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-800/30">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Emailů</span>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{sendResult.sentEmail}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-800/30">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">SMS</span>
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{sendResult.sentSms}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-800/30">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Přeskočeno</span>
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{sendResult.skipped}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-800/30">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Selhalo</span>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{sendResult.failed}</div>
                  </div>
                </div>
                {sendResult.errors.length > 0 && (
                  <div className="mt-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/30">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Chyby:</p>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                      {sendResult.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Souhrnné karty */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-16 h-16 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
              </div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Celkové náklady</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentPeriod.totalCosts.toLocaleString('cs-CZ')} Kč
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-16 h-16 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
              </div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Rozúčtováno</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-16 h-16 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path></svg>
              </div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Zálohy</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-16 h-16 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"></path></svg>
              </div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Bilance</div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          </div>

          {/* Tabulka výsledků */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                Výsledky vyúčtování
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  ({currentPeriod.results.length} jednotek)
                </span>
              </h3>
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none bg-gray-50 dark:bg-slate-700/50 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={showHiddenServices}
                    onChange={(e) => setShowHiddenServices(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </div>
                Zobrazit skryté služby
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-4 font-semibold sticky left-0 bg-gray-50/50 dark:bg-slate-800/50 backdrop-blur-sm z-10 min-w-[100px]">
                      Jednotka
                    </th>
                    {services.map(service => (
                      <th key={service.id} className="px-4 py-4 font-semibold text-right min-w-[120px] group">
                        <div className="flex items-center justify-end gap-1">
                          <span>{service.name}</span>
                          <Link 
                            href={`/buildings/${buildingId}?tab=settings`}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                            title="Upravit nastavení služby"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Link>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-4 font-bold text-gray-900 dark:text-white text-right bg-gray-50/80 dark:bg-slate-800/80 border-l border-gray-100 dark:border-slate-700">
                      Náklady celkem
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-900 dark:text-white text-right bg-gray-50/80 dark:bg-slate-800/80">
                      Zálohy
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-900 dark:text-white text-right bg-gray-50/80 dark:bg-slate-800/80">
                      Přeplatek / Nedoplatek
                    </th>
                    <th className="px-4 py-4 font-semibold text-center">
                      Kontrola
                    </th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {/* Řádek se součty */}
                  <tr className="bg-gray-50 dark:bg-slate-800/80 font-bold text-gray-900 dark:text-white">
                    <td className="px-4 py-3 sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                      CELKEM (Rozúčtováno)
                    </td>
                    {services.map(column => {
                      const serviceTotal = currentPeriod.results.reduce((sum, r) => {
                        const costs = r.serviceCosts.filter(c => column.serviceIds.includes(c.serviceId))
                        return sum + costs.reduce((s, c) => s + (c.unitCost || 0), 0)
                      }, 0)
                      return (
                        <td key={column.id} className="px-4 py-3 text-right font-mono">
                          {serviceTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right border-l border-gray-200 dark:border-slate-600 font-mono">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      OK
                    </td>
                    <td></td>
                  </tr>

                  {/* Řádek Skutečná suma */}
                  <tr className="bg-blue-50/50 dark:bg-blue-900/10 font-semibold text-blue-800 dark:text-blue-200">
                    <td className="px-4 py-3 sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                      SKUTEČNÁ SUMA (Faktury)
                    </td>
                    {services.map(column => {
                      const firstResult = currentPeriod.results[0]
                      const buildingTotal = firstResult ? column.serviceIds.reduce((sum, sId) => {
                         const sc = firstResult.serviceCosts.find(c => c.serviceId === sId)
                         return sum + (sc?.buildingTotalCost || 0)
                      }, 0) : 0

                      return (
                        <td key={column.id} className="px-4 py-3 text-right font-mono">
                          {buildingTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right border-l border-blue-100 dark:border-blue-800 font-mono">
                      {(() => {
                         const firstResult = currentPeriod.results[0]
                         if (!firstResult) return '0'
                         
                         // Sum all unique services building costs
                         // We can iterate over all columns and sum their building totals
                         const totalRealCost = services.reduce((sum, column) => {
                            const colTotal = column.serviceIds.reduce((s, sId) => {
                               const sc = firstResult.serviceCosts.find(c => c.serviceId === sId)
                               return s + (sc?.buildingTotalCost || 0)
                            }, 0)
                            return sum + colTotal
                         }, 0)
                         
                         return totalRealCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                      })()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>

                  {/* Řádek Rozdíl */}
                  <tr className="bg-orange-50/50 dark:bg-orange-900/10 font-semibold border-b-2 border-orange-100 dark:border-orange-800/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 bg-orange-50 dark:bg-orange-900/20 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                      ROZDÍL (Kontrola)
                    </td>
                    {services.map(column => {
                      const serviceTotal = currentPeriod.results.reduce((sum, r) => {
                        const costs = r.serviceCosts.filter(c => column.serviceIds.includes(c.serviceId))
                        return sum + costs.reduce((s, c) => s + (c.unitCost || 0), 0)
                      }, 0)
                      
                      const firstResult = currentPeriod.results[0]
                      const buildingTotal = firstResult ? column.serviceIds.reduce((sum, sId) => {
                         const sc = firstResult.serviceCosts.find(c => c.serviceId === sId)
                         return sum + (sc?.buildingTotalCost || 0)
                      }, 0) : 0
                      
                      const diff = serviceTotal - buildingTotal

                      return (
                        <td key={column.id} className={`px-4 py-3 text-right font-mono ${Math.abs(diff) > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {diff.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right border-l border-orange-100 dark:border-orange-800 font-mono">
                       {(() => {
                         const totalCalculated = currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0)
                         
                         const firstResult = currentPeriod.results[0]
                         const totalReal = firstResult ? services.reduce((sum, column) => {
                            const colTotal = column.serviceIds.reduce((s, sId) => {
                               const sc = firstResult.serviceCosts.find(c => c.serviceId === sId)
                               return s + (sc?.buildingTotalCost || 0)
                            }, 0)
                            return sum + colTotal
                         }, 0) : 0

                         const diff = totalCalculated - totalReal
                         return (
                           <span className={Math.abs(diff) > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                             {diff.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                           </span>
                         )
                       })()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>

                  {/* Jednotlivé řádky */}
                  {sortedResults.map((result) => {
                    const check = Math.round(result.totalAdvancePrescribed - result.totalCost - result.result)
                    const isCheckOk = Math.abs(check) < 1

                    return (
                      <tr key={result.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-gray-50/50 dark:group-hover:bg-slate-700/50 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                          <Link 
                            href={`/buildings/${buildingId}/billing/${result.id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                          >
                            {result.unit.unitNumber}
                          </Link>
                        </td>
                        {services.map(column => {
                          const costs = result.serviceCosts.filter(c => column.serviceIds.includes(c.serviceId))
                          const columnCost = costs.reduce((s, c) => s + (c.unitCost || 0), 0)
                          return (
                            <td key={column.id} className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                              {columnCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white bg-gray-50/30 dark:bg-slate-800/30 border-l border-gray-100 dark:border-slate-700 whitespace-nowrap font-mono">
                          {result.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 bg-gray-50/30 dark:bg-slate-800/30 whitespace-nowrap font-mono">
                          {result.totalAdvancePrescribed.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold bg-gray-50/30 dark:bg-slate-800/30 whitespace-nowrap font-mono ${
                          result.result > 0 ? 'text-red-600 dark:text-red-400' : result.result < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {result.result.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-bold ${isCheckOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isCheckOk ? 'OK' : `${check} Kč`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleTestEmail(result.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Odeslat testovací email na kost@onlinesprava.cz"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </button>
                            <button
                              onClick={() => handleTestSms(result.id)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                              title="Odeslat testovací SMS na 777338203"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
