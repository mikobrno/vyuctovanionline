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
        router.push(`/buildings/${buildingId}?tab=results`)
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
      <div className="border-b border-gray-100 dark:border-slate-700 pb-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
            📊
          </span>
          Generování vyúčtování
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 ml-14">
          Vygeneruje kompletní vyúčtování pro všechny jednotky v domě <span className="font-medium text-gray-900 dark:text-white">{buildingName}</span> pomocí dynamického výpočetního enginu.
        </p>
      </div>

      {/* Výběr období */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Vyberte období (rok)
        </label>
        <div className="relative max-w-xs">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white appearance-none font-medium"
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
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Přehled nákladů pro vybrané období */}
      <div className="mb-8 p-6 bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800/30 rounded-2xl">
        <h3 className="font-bold text-teal-900 dark:text-teal-100 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          Přehled nákladů pro rok {period}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-teal-100 dark:border-teal-800/30">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Celkové náklady</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalCostForPeriod.toLocaleString('cs-CZ')} Kč
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-teal-100 dark:border-teal-800/30">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Počet faktur</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {periodCosts.length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-teal-100 dark:border-teal-800/30">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Služeb s náklady</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {servicesWithCosts.size} <span className="text-gray-400 text-lg font-normal">/ {services.length}</span>
            </div>
          </div>
        </div>

        {/* Seznam služeb s náklady */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-teal-800 dark:text-teal-200 uppercase tracking-wider">Služby v období</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((service) => {
              const serviceCost = periodCosts
                .filter(c => c.serviceId === service.id)
                .reduce((sum, c) => sum + c.amount, 0)
              const hasCost = serviceCost > 0

              return (
                <div
                  key={service.id}
                  className={`px-4 py-3 rounded-xl text-sm border transition-all ${
                    hasCost
                      ? 'bg-white dark:bg-slate-800 border-teal-200 dark:border-teal-800 shadow-sm'
                      : 'bg-gray-50 dark:bg-slate-800/50 border-transparent text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${hasCost ? 'text-gray-900 dark:text-white' : ''}`}>{service.name}</span>
                    <span className={`font-mono ${hasCost ? 'text-teal-600 dark:text-teal-400 font-bold' : ''}`}>
                      {hasCost
                        ? `${serviceCost.toLocaleString('cs-CZ')} Kč`
                        : '-'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Upozornění */}
      {servicesWithCosts.size === 0 && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-6 py-4 rounded-2xl flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong className="block font-semibold mb-1">Pozor</strong>
            Pro vybrané období neexistují žádné náklady (faktury). Vyúčtování bude prázdné.
          </div>
        </div>
      )}

      {/* Tlačítko generování */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white px-8 py-5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
      >
        {generating ? (
          <>
            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generuji vyúčtování...
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Vygenerovat vyúčtování pro rok {period}
          </>
        )}
      </button>

      {/* Chyba */}
      {error && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-2xl flex items-center gap-3">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {/* Výsledek */}
      {result && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                Vyúčtování úspěšně vygenerováno!
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Celkové náklady</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.summary.totalCosts.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rozúčtováno</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.summary.totalDistributed.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Zálohy celkem</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.summary.totalAdvances.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Celková bilance</div>
                <div className={`text-lg font-bold ${
                  result.summary.totalBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {result.summary.totalBalance.toLocaleString('cs-CZ')} Kč
                </div>
              </div>
            </div>

            <div className="flex gap-6 text-sm text-emerald-800 dark:text-emerald-200 mb-6 px-2">
              <div>
                <span className="opacity-70">Počet jednotek:</span>
                <span className="ml-2 font-bold">{result.numberOfUnits}</span>
              </div>
              <div>
                <span className="opacity-70">Počet služeb:</span>
                <span className="ml-2 font-bold">{result.numberOfServices}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-emerald-200 dark:border-emerald-800/50 flex flex-col gap-4">
              <p className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Vyúčtování bylo úspěšně vytvořeno. Pro zobrazení detailní tabulky po jednotkách klikněte na tlačítko níže.
              </p>
              <button
                onClick={() => router.push(`/buildings/${buildingId}?tab=results`)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-center shadow-lg shadow-emerald-600/20"
              >
                📋 Zobrazit detailní tabulku výsledků
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nápověda */}
      <div className="mt-8 p-6 bg-gray-50 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700 rounded-2xl">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Jak to funguje?
        </h3>
        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-slate-600">1</span>
            <span>
              <strong className="text-gray-900 dark:text-white">Načtení nákladů:</strong> Systém načte všechny faktury (náklady) pro vybrané období ze záložky &ldquo;🧾 Faktury&rdquo;
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-slate-600">2</span>
            <span>
              <strong className="text-gray-900 dark:text-white">Dynamický výpočet:</strong> Pro každou službu použije nakonfigurovaná pravidla (měřidla, podíl, výměra, atd.)
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-slate-600">3</span>
            <span>
              <strong className="text-gray-900 dark:text-white">Distribuce:</strong> Rozúčtuje náklady na jednotky podle vypočítaných poměrů
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-slate-600">4</span>
            <span>
              <strong className="text-gray-900 dark:text-white">Zálohy:</strong> Započítá zaplacené zálohy z &ldquo;📅 Předpis po měsíci&rdquo;
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-slate-600">5</span>
            <span>
              <strong className="text-gray-900 dark:text-white">Bilance:</strong> Vypočítá nedoplatek nebo přeplatek pro každou jednotku
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
