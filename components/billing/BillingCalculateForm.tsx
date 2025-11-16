'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface BillingCalculateFormProps {
  buildingId: string
  year: number
  building: any
  billingPeriod: any
}

export default function BillingCalculateForm({ 
  buildingId, 
  year, 
  building,
  billingPeriod 
}: BillingCalculateFormProps) {
  const router = useRouter()
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleCalculate = async () => {
    setCalculating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Chyba při výpočtu')
      }

      setSuccess(data.message)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při výpočtu')
    } finally {
      setCalculating(false)
    }
  }

  const totalCosts = building.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0)
  const servicesByMethodology = building.services.reduce((acc: any, service: any) => {
    const costs = building.costs.filter((c: any) => c.serviceId === service.id)
    const total = costs.reduce((sum: number, c: any) => sum + c.amount, 0)
    
    if (!acc[service.methodology]) {
      acc[service.methodology] = { services: [], total: 0 }
    }
    
    acc[service.methodology].services.push({ ...service, totalCost: total })
    acc[service.methodology].total += total
    
    return acc
  }, {})

  const methodLabels: Record<string, { label: string; icon: string }> = {
    'OWNERSHIP_SHARE': { label: 'Vlastnický podíl', icon: '👥' },
    'AREA': { label: 'Podle výměry', icon: '📐' },
    'PERSON_MONTHS': { label: 'Osobo-měsíce', icon: '👨‍👩‍👧‍👦' },
    'METER_READING': { label: 'Podle měřidel', icon: '📊' },
    'FIXED_PER_UNIT': { label: 'Fixní částka/byt', icon: '💰' },
    'EQUAL_SPLIT': { label: 'Rovným dílem', icon: '🔄' },
    'CUSTOM': { label: 'Vlastní vzorec', icon: '🔧' },
  }

  return (
    <div className="space-y-6">
      {/* Přehled dat */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">📊 Přehled dat pro výpočet</h2>
          <Link
            href={`/buildings/${buildingId}?tab=parameters`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            ⚙️ Zobrazit parametry jednotek
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">Jednotky</div>
            <div className="text-2xl font-bold text-blue-900">{building.units.length}</div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Služby</div>
            <div className="text-2xl font-bold text-green-900">{building.services.length}</div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-700 mb-1">Celkové náklady</div>
            <div className="text-2xl font-bold text-purple-900">
              {totalCosts.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
            </div>
          </div>
        </div>

        {/* Služby podle způsobu výpočtu */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Služby podle způsobu výpočtu</h3>
          
          {Object.entries(servicesByMethodology).map(([method, data]: [string, any]) => (
            <div key={method} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{methodLabels[method]?.icon}</span>
                  <span className="font-medium text-gray-900">{methodLabels[method]?.label}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {data.total.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                </span>
              </div>
              
              <div className="space-y-1">
                {data.services.map((service: any) => (
                  <div key={service.id} className="flex justify-between text-sm pl-8">
                    <span className="text-gray-900">{service.name}</span>
                    <span className="text-gray-900 font-medium">
                      {service.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tlačítko pro výpočet */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Spustit výpočet</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Výpočet provede:</strong>
          </p>
          <ul className="mt-2 text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Rozúčtování nákladů podle nastavených metod</li>
            <li>Výpočet předepsaných a uhrazených záloh</li>
            <li>Stanovení přeplatku/nedoplatku pro každou jednotku</li>
            <li>Uložení detailů pro tisk výpisů</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
            ✅ {success}
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={calculating || building.costs.length === 0}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calculating ? '⏳ Počítám...' : '🚀 Spustit výpočet vyúčtování'}
        </button>

        {building.costs.length === 0 && (
          <p className="mt-2 text-sm text-orange-600">
            ⚠️ Nejsou zadány žádné náklady pro rok {year}
          </p>
        )}
      </div>

      {/* Výsledky výpočtu */}
      {billingPeriod && billingPeriod.results && billingPeriod.results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">📋 Výsledky vyúčtování</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-3 py-1 rounded-full ${
                billingPeriod.status === 'CALCULATED' ? 'bg-green-100 text-green-800' :
                billingPeriod.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                billingPeriod.status === 'SENT' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {billingPeriod.status === 'CALCULATED' && '✓ Vypočteno'}
                {billingPeriod.status === 'APPROVED' && '✓ Schváleno'}
                {billingPeriod.status === 'SENT' && '✓ Odesláno'}
                {billingPeriod.status === 'DRAFT' && 'Koncept'}
              </span>
              {billingPeriod.calculatedAt && (
                <span className="text-gray-900">
                  {new Date(billingPeriod.calculatedAt).toLocaleString('cs-CZ')}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">Jednotka</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Náklad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Předpis</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Uhrazeno</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Výsledek</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {billingPeriod.results.map((result: any) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.unit.unitNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {result.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {result.totalAdvancePrescribed.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {result.totalAdvancePaid.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                      result.result > 0 ? 'text-green-600' : 
                      result.result < 0 ? 'text-red-600' : 
                      'text-gray-900'
                    }`}>
                      {result.result > 0 && '+'}{result.result.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <Link
                        href={`/buildings/${buildingId}/billing/${billingPeriod.id}/unit/${result.unitId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-900">Celkem</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {billingPeriod.results.reduce((sum: number, r: any) => sum + r.totalCost, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {billingPeriod.results.reduce((sum: number, r: any) => sum + r.totalAdvancePrescribed, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {billingPeriod.results.reduce((sum: number, r: any) => sum + r.totalAdvancePaid, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {billingPeriod.results.reduce((sum: number, r: any) => sum + r.result, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
