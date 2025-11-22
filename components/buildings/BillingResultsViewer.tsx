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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Jednotka
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vlastník
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Náklady
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Zálohy
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Bilance
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Stav
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPeriod.results.map((result) => {
                    const owner = result.unit.ownerships[0]?.owner

                    return (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {result.unit.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {result.unit.unitNumber}
                            {result.unit.variableSymbol && ` • VS: ${result.unit.variableSymbol}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {owner ? (
                            <div>
                              <div>{owner.firstName} {owner.lastName}</div>
                              {owner.email && (
                                <div className="text-xs text-gray-500">{owner.email}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Bez vlastníka</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {result.totalCost.toLocaleString('cs-CZ')} Kč
                          {result.repairFund > 0 && (
                            <div className="text-xs text-gray-500">
                              (+{result.repairFund.toLocaleString('cs-CZ')} fond)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {result.totalAdvancePrescribed.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${
                            result.result > 0 ? 'text-red-600' : result.result < 0 ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {result.result.toLocaleString('cs-CZ')} Kč
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            result.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {result.isPaid ? '✓ Zaplaceno' : '⏳ Čeká'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/buildings/${buildingId}/billing/${result.id}`}
                            className="text-primary hover:text-primary-hover text-sm font-medium"
                          >
                            📄 Zobrazit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
                      Celkem
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalCost, 0).toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {currentPeriod.results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {currentPeriod.results.reduce((sum, r) => sum + r.result, 0).toLocaleString('cs-CZ')} Kč
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Rozbalené detaily služeb - ODSTRANĚNO, nyní je detail na samostatné stránce */}
          </div>
        </>
      )}
    </div>
  )
}
