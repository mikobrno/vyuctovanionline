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

  // Získat všechny unikátní služby pro hlavičku tabulky
  const allServicesMap = new Map<string, string>()
  if (currentPeriod) {
    currentPeriod.results.forEach(r => {
      r.serviceCosts.forEach(sc => {
        allServicesMap.set(sc.serviceId, sc.service.name)
      })
    })
  }
  const services = Array.from(allServicesMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

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
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
              Zatím nebylo vygenerováno žádné vyúčtování
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Pro vytvoření vyúčtování přejděte na záložku Vyúčtování a klikněte na tlačítko generování.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Vyberte období vyúčtování
        </label>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 dark:text-white dark:bg-slate-700"
          aria-label="Výběr období vyúčtování"
        >
          {billingPeriods.map((period) => (
            <option key={period.id} value={period.id}>
              Rok {period.year} - {period.status} ({period.totalCosts.toLocaleString('cs-CZ')} Kč)
            </option>
          ))}
        </select>
      </div>

      {currentPeriod && (
        <>
          {/* Akční tlačítka */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Hromadné odeslání</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Odeslat vyúčtování všem vlastníkům (Email + SMS)
                </p>
              </div>
              <button
                onClick={handleSendAllNotifications}
                disabled={sendingAll}
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sendingAll ? '⏳ Odesílám...' : '🚀 Odeslat vše (Email + SMS)'}
              </button>
            </div>
            {sendResult && (
              <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-900/20 rounded border border-teal-200 dark:border-teal-800">
                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Emailů:</span>
                    <span className="ml-2 font-bold text-green-600 dark:text-green-400">{sendResult.sentEmail}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">SMS:</span>
                    <span className="ml-2 font-bold text-purple-600 dark:text-purple-400">{sendResult.sentSms}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Přeskočeno:</span>
                    <span className="ml-2 font-bold text-yellow-600 dark:text-yellow-400">{sendResult.skipped}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Selhalo:</span>
                    <span className="ml-2 font-bold text-red-600 dark:text-red-400">{sendResult.failed}</span>
                  </div>
                </div>
                {sendResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Chyby:</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {sendResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
              <div className="text-sm text-teal-600 dark:text-teal-400 uppercase mb-1">Celkové náklady</div>
              <div className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                {currentPeriod.totalCosts.toLocaleString('cs-CZ')} Kč
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm text-green-600 dark:text-green-400 uppercase mb-1">Rozúčtováno</div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="text-sm text-purple-600 dark:text-purple-400 uppercase mb-1">Zálohy</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="text-sm text-orange-600 dark:text-orange-400 uppercase mb-1">Bilance</div>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Výsledky vyúčtování pro {currentPeriod.results.length} jednotek
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-2 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 border-r border-gray-200 dark:border-slate-700 min-w-[150px]">
                      Jednotka
                    </th>
                    {services.map(service => (
                      <th key={service.id} className="px-2 py-3 text-right font-medium text-gray-500 dark:text-gray-400 uppercase min-w-[100px]">
                        {service.name}
                      </th>
                    ))}
                    <th className="px-2 py-3 text-right font-bold text-gray-900 dark:text-white uppercase bg-gray-100 dark:bg-slate-700 border-l border-gray-200 dark:border-slate-600">
                      Náklady celkem
                    </th>
                    <th className="px-2 py-3 text-right font-bold text-gray-900 dark:text-white uppercase bg-gray-100 dark:bg-slate-700">
                      Zálohy
                    </th>
                    <th className="px-2 py-3 text-right font-bold text-gray-900 dark:text-white uppercase bg-gray-100 dark:bg-slate-700">
                      Přeplatek / Nedoplatek
                    </th>
                    <th className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Kontrola
                    </th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {/* Řádek se součty */}
                  <tr className="bg-gray-100 dark:bg-slate-700 font-bold">
                    <td className="px-2 py-3 text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-slate-700 z-10 border-r border-gray-200 dark:border-slate-600">
                      CELKEM (Rozúčtováno)
                    </td>
                    {services.map(service => {
                      const serviceTotal = currentPeriod.results.reduce((sum, r) => {
                        const sc = r.serviceCosts.find(c => c.serviceId === service.id)
                        return sum + (sc?.unitCost || 0)
                      }, 0)
                      return (
                        <td key={service.id} className="px-2 py-3 text-right text-gray-900 dark:text-white">
                          {serviceTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right text-gray-900 dark:text-white border-l border-gray-200 dark:border-slate-600">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-right text-gray-900 dark:text-white">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-right text-gray-900 dark:text-white">
                      {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-500 dark:text-gray-400">
                      OK
                    </td>
                    <td></td>
                  </tr>

                  {/* Řádek Skutečná suma */}
                  <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t border-blue-200 dark:border-blue-800">
                    <td className="px-2 py-3 text-blue-900 dark:text-blue-100 sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10 border-r border-blue-200 dark:border-blue-800">
                      SKUTEČNÁ SUMA (Faktury)
                    </td>
                    {services.map(service => {
                      // Najdeme náklad na budovu pro tuto službu z prvního výsledku, který tuto službu má
                      const serviceCost = currentPeriod.results
                        .flatMap(r => r.serviceCosts)
                        .find(sc => sc.serviceId === service.id)
                      
                      const buildingTotal = serviceCost?.buildingTotalCost || 0

                      return (
                        <td key={service.id} className="px-2 py-3 text-right text-blue-900 dark:text-blue-100">
                          {buildingTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right text-blue-900 dark:text-blue-100 border-l border-blue-200 dark:border-blue-800">
                      {(() => {
                         const totalRealCost = services.reduce((sum, service) => {
                            const sc = currentPeriod.results
                              .flatMap(r => r.serviceCosts)
                              .find(c => c.serviceId === service.id)
                            return sum + (sc?.buildingTotalCost || 0)
                         }, 0)
                         return totalRealCost.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                      })()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>

                  {/* Řádek Rozdíl */}
                  <tr className="bg-orange-50 dark:bg-orange-900/20 font-bold border-b-2 border-orange-200 dark:border-orange-800">
                    <td className="px-2 py-3 text-gray-900 dark:text-white sticky left-0 bg-orange-50 dark:bg-orange-900/20 z-10 border-r border-orange-200 dark:border-orange-800">
                      ROZDÍL (Kontrola)
                    </td>
                    {services.map(service => {
                      const serviceTotal = currentPeriod.results.reduce((sum, r) => {
                        const sc = r.serviceCosts.find(c => c.serviceId === service.id)
                        return sum + (sc?.unitCost || 0)
                      }, 0)
                      
                      const serviceCost = currentPeriod.results
                        .flatMap(r => r.serviceCosts)
                        .find(sc => sc.serviceId === service.id)
                      const buildingTotal = serviceCost?.buildingTotalCost || 0
                      
                      const diff = serviceTotal - buildingTotal

                      return (
                        <td key={service.id} className={`px-2 py-3 text-right ${Math.abs(diff) > 1 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {diff.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right border-l border-orange-200 dark:border-orange-800">
                       {(() => {
                         const totalCalculated = currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0)
                         const totalReal = services.reduce((sum, service) => {
                            const sc = currentPeriod.results
                              .flatMap(r => r.serviceCosts)
                              .find(c => c.serviceId === service.id)
                            return sum + (sc?.buildingTotalCost || 0)
                         }, 0)
                         const diff = totalCalculated - totalReal
                         return (
                           <span className={Math.abs(diff) > 1 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
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
                      <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 z-10 border-r border-gray-200 dark:border-slate-700">
                          {result.unit.unitNumber}
                        </td>
                        {services.map(service => {
                          const sc = result.serviceCosts.find(c => c.serviceId === service.id)
                          return (
                            <td key={service.id} className="px-2 py-2 text-right text-gray-900 dark:text-gray-300 whitespace-nowrap">
                              {sc ? sc.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-right font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-700/50 border-l border-gray-200 dark:border-slate-700 whitespace-nowrap">
                          {result.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/50 whitespace-nowrap">
                          {result.totalAdvancePrescribed.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-2 text-right font-bold bg-gray-50 dark:bg-slate-700/50 whitespace-nowrap ${
                          result.result > 0 ? 'text-red-600 dark:text-red-400' : result.result < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {result.result.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-2 text-center text-xs font-bold ${isCheckOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isCheckOk ? 'OK' : `${check} Kč`}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            <button
                              onClick={() => handleTestEmail(result.id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Odeslat testovací email na kost@onlinesprava.cz"
                            >
                              Test Email
                            </button>
                            <button
                              onClick={() => handleTestSms(result.id)}
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-xs font-medium px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                              title="Odeslat testovací SMS na 777338203"
                            >
                              Test SMS
                            </button>
                            <Link
                              href={`/buildings/${buildingId}/billing/${result.id}`}
                              className="text-primary hover:text-primary-hover text-xs font-medium px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                              Detail
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Rozbalené detaily služeb - ODSTRANĚNO, nyní je detail na samostatné stránce */}
          </div>
        </>
      )}
    </div>
  )
}
