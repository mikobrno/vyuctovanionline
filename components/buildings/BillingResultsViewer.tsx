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
    sent: number
    failed: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [sendingAllSms, setSendingAllSms] = useState(false)
  const [smsResult, setSmsResult] = useState<{
    sent: number
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

  const handleSendAll = async () => {
    if (!currentPeriod) return
    
    if (!confirm(`Opravdu chcete odeslat vyúčtování pro všechny jednotky v období ${currentPeriod.year}?`)) {
      return
    }

    try {
      setSendingAll(true)
      setSendResult(null)

      const response = await fetch(`/api/buildings/${buildingId}/billing-periods/${currentPeriod.id}/send-all`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || 'Nepodařilo se odeslat emaily')
      }

      setSendResult(data.details)
      
      // Obnovit stránku za 3 sekundy
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Nepodařilo se odeslat emaily')
    } finally {
      setSendingAll(false)
    }
  }

  const handleSendAllSms = async () => {
    if (!currentPeriod) return
    
    if (!confirm(`Opravdu chcete odeslat SMS notifikaci všem vlastníkům v období ${currentPeriod.year}?`)) {
      return
    }

    try {
      setSendingAllSms(true)
      setSmsResult(null)

      const response = await fetch(`/api/buildings/${buildingId}/billing-periods/${currentPeriod.id}/send-all-sms`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || 'Nepodařilo se odeslat SMS')
      }

      setSmsResult(data.details)
      
      // Obnovit stránku za 3 sekundy
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Nepodařilo se odeslat SMS')
    } finally {
      setSendingAllSms(false)
    }
  }

  if (billingPeriods.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">
              Zatím nebylo vygenerováno žádné vyúčtování
            </h3>
            <p className="text-sm text-yellow-800">
              Pro vytvoření vyúčtování přejděte na záložku Vyúčtování a klikněte na tlačítko generování.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Vyberte období vyúčtování
        </label>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-gray-900"
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
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Hromadné akce - E-mail</h3>
                <p className="text-sm text-gray-600">
                  Odeslat vyúčtování emailem všem vlastníkům najednou
                </p>
              </div>
              <button
                onClick={handleSendAll}
                disabled={sendingAll}
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sendingAll ? '⏳ Odesílám...' : '📧 Odeslat všem e-mailem'}
              </button>
            </div>
            {sendResult && (
              <div className="mt-4 p-4 bg-teal-50 rounded border border-teal-200">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-gray-600">Odesláno:</span>
                    <span className="ml-2 font-bold text-green-600">{sendResult.sent}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Přeskočeno:</span>
                    <span className="ml-2 font-bold text-yellow-600">{sendResult.skipped}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Selhalo:</span>
                    <span className="ml-2 font-bold text-red-600">{sendResult.failed}</span>
                  </div>
                </div>
                {sendResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Chyby:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {sendResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Hromadné akce - SMS</h3>
                <p className="text-sm text-gray-600">
                  Odeslat SMS notifikaci všem vlastníkům s telefonním číslem
                </p>
              </div>
              <button
                onClick={handleSendAllSms}
                disabled={sendingAllSms}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sendingAllSms ? '⏳ Odesílám...' : '📱 Odeslat všem SMS'}
              </button>
            </div>
            {smsResult && (
              <div className="mt-4 p-4 bg-purple-50 rounded border border-purple-200">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-gray-600">Odesláno:</span>
                    <span className="ml-2 font-bold text-green-600">{smsResult.sent}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Přeskočeno:</span>
                    <span className="ml-2 font-bold text-yellow-600">{smsResult.skipped}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Selhalo:</span>
                    <span className="ml-2 font-bold text-red-600">{smsResult.failed}</span>
                  </div>
                </div>
                {smsResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Chyby:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {smsResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="text-sm text-teal-600 uppercase mb-1">Celkové náklady</div>
              <div className="text-2xl font-bold text-teal-900">
                {currentPeriod.totalCosts.toLocaleString('cs-CZ')} Kč
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 uppercase mb-1">Rozúčtováno</div>
              <div className="text-2xl font-bold text-green-900">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-600 uppercase mb-1">Zálohy</div>
              <div className="text-2xl font-bold text-purple-900">
                {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-600 uppercase mb-1">Bilance</div>
              <div className="text-2xl font-bold text-orange-900">
                {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Výsledky vyúčtování pro {currentPeriod.results.length} jednotek
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[150px]">
                      Jednotka
                    </th>
                    {services.map(service => (
                      <th key={service.id} className="px-2 py-3 text-right font-medium text-gray-500 uppercase min-w-[100px]">
                        {service.name}
                      </th>
                    ))}
                    <th className="px-2 py-3 text-right font-bold text-gray-900 uppercase bg-gray-100 border-l border-gray-200">
                      Náklady celkem
                    </th>
                    <th className="px-2 py-3 text-right font-bold text-gray-900 uppercase bg-gray-100">
                      Zálohy
                    </th>
                    <th className="px-2 py-3 text-right font-bold text-gray-900 uppercase bg-gray-100">
                      Přeplatek / Nedoplatek
                    </th>
                    <th className="px-2 py-3 text-center font-medium text-gray-500 uppercase">
                      Kontrola
                    </th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Řádek se součty */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-2 py-3 text-gray-900 sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                      CELKEM (Rozúčtováno)
                    </td>
                    {services.map(service => {
                      const serviceTotal = currentPeriod.results.reduce((sum, r) => {
                        const sc = r.serviceCosts.find(c => c.serviceId === service.id)
                        return sum + (sc?.unitCost || 0)
                      }, 0)
                      return (
                        <td key={service.id} className="px-2 py-3 text-right text-gray-900">
                          {serviceTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right text-gray-900 border-l border-gray-200">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-right text-gray-900">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-right text-gray-900">
                      {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-500">
                      OK
                    </td>
                    <td></td>
                  </tr>

                  {/* Řádek Skutečná suma */}
                  <tr className="bg-blue-50 font-bold border-t border-blue-200">
                    <td className="px-2 py-3 text-blue-900 sticky left-0 bg-blue-50 z-10 border-r border-blue-200">
                      SKUTEČNÁ SUMA (Faktury)
                    </td>
                    {services.map(service => {
                      // Najdeme náklad na budovu pro tuto službu z prvního výsledku, který tuto službu má
                      const serviceCost = currentPeriod.results
                        .flatMap(r => r.serviceCosts)
                        .find(sc => sc.serviceId === service.id)
                      
                      const buildingTotal = serviceCost?.buildingTotalCost || 0

                      return (
                        <td key={service.id} className="px-2 py-3 text-right text-blue-900">
                          {buildingTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right text-blue-900 border-l border-blue-200">
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
                  <tr className="bg-orange-50 font-bold border-b-2 border-orange-200">
                    <td className="px-2 py-3 text-gray-900 sticky left-0 bg-orange-50 z-10 border-r border-orange-200">
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
                        <td key={service.id} className={`px-2 py-3 text-right ${Math.abs(diff) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                          {diff.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-right border-l border-orange-200">
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
                           <span className={Math.abs(diff) > 1 ? 'text-red-600' : 'text-green-600'}>
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
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-10 border-r border-gray-200">
                          {result.unit.unitNumber}
                        </td>
                        {services.map(service => {
                          const sc = result.serviceCosts.find(c => c.serviceId === service.id)
                          return (
                            <td key={service.id} className="px-2 py-2 text-right text-gray-900 whitespace-nowrap">
                              {sc ? sc.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-right font-semibold text-gray-900 bg-gray-50 border-l border-gray-200 whitespace-nowrap">
                          {result.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900 bg-gray-50 whitespace-nowrap">
                          {result.totalAdvancePrescribed.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-2 text-right font-bold bg-gray-50 whitespace-nowrap ${
                          result.result > 0 ? 'text-red-600' : result.result < 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {result.result.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-2 text-center text-xs font-bold ${isCheckOk ? 'text-green-600' : 'text-red-600'}`}>
                          {isCheckOk ? 'OK' : `${check} Kč`}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/buildings/${buildingId}/billing/${result.id}`}
                            className="text-primary hover:text-primary-hover text-xs font-medium"
                          >
                            Detail
                          </Link>
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
