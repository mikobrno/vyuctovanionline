'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BillingGeneratorProps {
  buildingId: string
  buildingName: string
  services: Array<{
    id: string
    name: string
    code: string
  }>
  costs: Array<{
    period: number
    serviceId: string
    amount: number
  }>
}

export default function BillingGenerator({ buildingId, buildingName, services, costs }: BillingGeneratorProps) {
  const router = useRouter()
  const [period, setPeriod] = useState(2024)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{
    summary: {
      totalCosts: number
      totalDistributed: number
      totalAdvances: number
      totalBalance: number
    }
    numberOfUnits: number
    numberOfServices: number
    services: Array<{
      name: string
      code: string
      totalCost: number
    }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Získat dostupná období z nákladů
  const availablePeriods = Array.from(new Set(costs.map(c => c.period))).sort((a, b) => b - a)

  // Statistiky pro vybrané období
  const periodCosts = costs.filter(c => c.period === period)
  const totalCostForPeriod = periodCosts.reduce((sum, c) => sum + c.amount, 0)
  const servicesWithCosts = new Set(periodCosts.map(c => c.serviceId))

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/buildings/${buildingId}/generate-billing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ period }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Chyba při generování vyúčtování')
      }

      setResult(data.data)
      
      // Refresh stránky po úspěšném generování
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          📊 Generování vyúčtování
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Vygeneruje kompletní vyúčtování pro všechny jednotky v domě {buildingName} pomocí dynamického výpočetního enginu
        </p>
      </div>

      {/* Výběr období */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Období (rok) *
        </label>
        <select
          value={period}
          onChange={(e) => setPeriod(parseInt(e.target.value))}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-gray-900"
          disabled={generating}
          aria-label="Výběr období pro vyúčtování"
        >
          {availablePeriods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {availablePeriods.length === 0 && (
            <option value={2024}>2024</option>
          )}
        </select>
      </div>

      {/* Přehled nákladů pro vybrané období */}
      <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">
          📋 Přehled nákladů pro rok {period}
        </h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Celkové náklady</div>
            <div className="text-2xl font-bold text-gray-900">
              {totalCostForPeriod.toLocaleString('cs-CZ')} Kč
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Počet faktur</div>
            <div className="text-2xl font-bold text-gray-900">
              {periodCosts.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Služeb s náklady</div>
            <div className="text-2xl font-bold text-gray-900">
              {servicesWithCosts.size} / {services.length}
            </div>
          </div>
        </div>

        {/* Seznam služeb s náklady */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Služby v období:</div>
          <div className="grid grid-cols-2 gap-2">
            {services.map((service) => {
              const serviceCost = periodCosts
                .filter(c => c.serviceId === service.id)
                .reduce((sum, c) => sum + c.amount, 0)
              const hasCost = serviceCost > 0

              return (
                <div
                  key={service.id}
                  className={`p-2 rounded text-sm ${
                    hasCost
                      ? 'bg-green-100 border border-green-300 text-green-900'
                      : 'bg-gray-100 border border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="font-medium">{service.name}</div>
                  <div className="text-xs">
                    {hasCost
                      ? `${serviceCost.toLocaleString('cs-CZ')} Kč`
                      : 'Žádné náklady'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Upozornění */}
      {servicesWithCosts.size === 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          ⚠️ <strong>Pozor:</strong> Pro vybrané období neexistují žádné náklady (faktury). 
          Vyúčtování bude prázdné.
        </div>
      )}

      {/* Tlačítko generování */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full bg-primary text-white px-6 py-4 rounded-lg font-semibold text-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            Generuji vyúčtování...
          </>
        ) : (
          <>
            🚀 Vygenerovat vyúčtování pro rok {period}
          </>
        )}
      </button>

      {/* Chyba */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      {/* Výsledek */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✅</span>
              <h3 className="text-lg font-bold text-green-900">
                Vyúčtování úspěšně vygenerováno!
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded p-3">
                <div className="text-sm text-gray-600">Celkové náklady</div>
                <div className="text-xl font-bold text-gray-900">
                  {result.summary.totalCosts.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-sm text-gray-600">Rozúčtováno</div>
                <div className="text-xl font-bold text-gray-900">
                  {result.summary.totalDistributed.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-sm text-gray-600">Zálohy celkem</div>
                <div className="text-xl font-bold text-gray-900">
                  {result.summary.totalAdvances.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-sm text-gray-600">Celková bilance</div>
                <div className={`text-xl font-bold ${
                  result.summary.totalBalance > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {result.summary.totalBalance.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Počet jednotek:</span>
                <span className="ml-2 font-semibold text-gray-900">{result.numberOfUnits}</span>
              </div>
              <div>
                <span className="text-gray-600">Počet služeb:</span>
                <span className="ml-2 font-semibold text-gray-900">{result.numberOfServices}</span>
              </div>
            </div>

            {/* Seznam služeb */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Rozúčtované služby:</div>
              <div className="space-y-1">
                {result.services.map((service, idx: number) => (
                  <div key={idx} className="bg-white rounded p-2 flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-900">
                      {service.name} ({service.code})
                    </span>
                    <span className="text-gray-900">
                      {service.totalCost.toLocaleString('cs-CZ')} Kč
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-green-300">
              <p className="text-sm text-green-800">
                ℹ️ Stránka se za chvíli automaticky obnoví. Pak můžete zobrazit detaily vyúčtování na záložce &ldquo;📊 Vyúčtování&rdquo;.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nápověda */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Jak to funguje?</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>
            <strong>1. Načtení nákladů:</strong> Systém načte všechny faktury (náklady) pro vybrané období ze záložky &ldquo;🧾 Faktury&rdquo;
          </li>
          <li>
            <strong>2. Dynamický výpočet:</strong> Pro každou službu použije nakonfigurovaná pravidla (měřidla, podíl, výměra, atd.)
          </li>
          <li>
            <strong>3. Distribuce:</strong> Rozúčtuje náklady na jednotky podle vypočítaných poměrů
          </li>
          <li>
            <strong>4. Zálohy:</strong> Započítá zaplacené zálohy z &ldquo;📅 Předpis po měsíci&rdquo;
          </li>
          <li>
            <strong>5. Bilance:</strong> Vypočítá nedoplatek nebo přeplatek pro každou jednotku
          </li>
        </ul>
      </div>
    </div>
  )
}
