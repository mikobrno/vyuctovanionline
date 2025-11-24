'use client'

import { useEffect, useState } from 'react'

interface CalculationTestProps {
  buildingId: string
  services: Array<{
    id: string
    name: string
    code: string
    dataSourceType: string | null
    dataSourceName: string | null
    unitAttributeName: string | null
  }>
}

export default function CalculationEngineTest({ buildingId, services }: CalculationTestProps) {
  const [selectedService, setSelectedService] = useState('')
  const [period, setPeriod] = useState(2024)
  const [totalCost, setTotalCost] = useState(100000)
  const [loading, setLoading] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [excelFileName, setExcelFileName] = useState<string>('vyuctovani2024 (20).xlsx')
  const [pendingExcelUnitName, setPendingExcelUnitName] = useState<string | null>(null)
  const [results, setResults] = useState<{
    totalCost: number
    totalDistributed: number
    difference: number
    numberOfUnits: number
    results: Array<{
      unitId: string
      unitName: string
      amount: number
      formula: string
      breakdown: {
        totalCost: number
        divisor: number
        unitValue: number
        pricePerUnit: number
      }
    }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    if (!selectedService) {
      setError('Vyberte službu')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch(`/api/buildings/${buildingId}/calculate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedService,
          period: period,
          totalCost: totalCost,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Chyba při výpočtu')
      }

      setResults(data.data)
      // reset per-unit selection after new run
      setSelectedUnitId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při testování')
    } finally {
      setLoading(false)
    }
  }

  const selectedServiceObj = services.find(s => s.id === selectedService)
  const unitsFromResults = results?.results?.map(r => ({ id: r.unitId, name: r.unitName })) || []
  const filteredResults = results ? (
    selectedUnitId ? { ...results, results: results.results.filter(r => r.unitId === selectedUnitId) } : results
  ) : null
  const selectedUnit = results?.results.find(r => r.unitId === selectedUnitId)

  // Pokud je k dispozici pendingExcelUnitName a máme načtené výsledky, zkusit auto-match
  useEffect(() => {
    if (pendingExcelUnitName && results?.results?.length) {
      const match = results.results.find(r => r.unitName?.toString().trim() === pendingExcelUnitName?.toString().trim())
      if (match) {
        setSelectedUnitId(match.unitId)
        setPendingExcelUnitName(null)
      }
    }
  }, [pendingExcelUnitName, results])

  const loadExcelSelection = async () => {
    try {
      const params = new URLSearchParams({ file: excelFileName, sheet: 'Vstupní data', addr: 'B4' })
      const res = await fetch(`/api/import/public/cell?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Nepodařilo se načíst buňku B4')
      const bytValue = (data?.value ?? '').toString().trim()
      if (!bytValue) throw new Error('V buňce B4 není žádná hodnota')

      // Pokud už máme výsledky, rovnou zkusíme spárovat
      if (results?.results?.length) {
        const match = results.results.find(r => r.unitName?.toString().trim() === bytValue)
        if (match) {
          setSelectedUnitId(match.unitId)
          setPendingExcelUnitName(null)
          return
        }
      }
      // Jinak si ji zapamatujeme a zkusíme po dalším výpočtu
      setPendingExcelUnitName(bytValue)
      alert(`Načteno z Excelu: BYT = ${bytValue}. Spáruji po výpočtu.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chyba načtení z Excelu'
      alert(msg)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
      <div className="border-b border-gray-100 dark:border-slate-700 pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">🧪</span>
          Test dynamického výpočetního enginu
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-11">
          Vyzkoušejte, jak engine rozúčtuje náklady na jednotky podle nastavené konfigurace
        </p>
      </div>

      <div className="space-y-6">
        {/* Výběr služby */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            Služba *
          </label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white font-medium transition-all"
            aria-label="Výběr služby"
          >
            <option value="">Vyberte službu...</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.code})
                {service.dataSourceType && ` - ${service.dataSourceType}`}
              </option>
            ))}
          </select>

          {selectedServiceObj && (
            <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl text-sm">
              <div className="font-bold text-blue-900 dark:text-blue-100 mb-2">Konfigurace:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-blue-800 dark:text-blue-200">
                  Typ: <span className="font-mono font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">{selectedServiceObj.dataSourceType || 'Stará metodologie'}</span>
                </div>
                {selectedServiceObj.dataSourceName && (
                  <div className="text-blue-800 dark:text-blue-200">
                    Zdroj: <span className="font-mono font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">{selectedServiceObj.dataSourceName}</span>
                  </div>
                )}
                {selectedServiceObj.unitAttributeName && (
                  <div className="text-blue-800 dark:text-blue-200">
                    Atribut: <span className="font-mono font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">{selectedServiceObj.unitAttributeName}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Období */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Období (rok) *
            </label>
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white font-medium transition-all"
              min="2020"
              max="2030"
              aria-label="Období výpočtu"
            />
          </div>

          {/* Celkový náklad */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Celkový náklad (Kč) *
            </label>
            <input
              type="number"
              value={totalCost}
              onChange={(e) => setTotalCost(parseFloat(e.target.value))}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white font-medium transition-all"
              step="0.01"
              aria-label="Celkový náklad"
            />
          </div>
        </div>

        {/* Excel přepínač (Vstupní data!B4) */}
        <div className="border border-blue-100 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4">
          <div className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
            Napodobit Excel: Vstupní data!B4 (BYT)
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={excelFileName}
              onChange={(e) => setExcelFileName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="vyuctovani2024 (20).xlsx"
            />
            <button
              type="button"
              onClick={loadExcelSelection}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Načíst výběr z Excelu
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
            Čte hodnotu buňky Vstupní data!B4 a nastaví vybranou jednotku.
          </div>
        </div>

        {/* Přepínač jednotky (po výpočtu) */}
        {results && unitsFromResults.length > 0 && (
          <div>
            <label htmlFor="unit-switch" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Jednotka (přepnout jako v Excelu)
            </label>
            <select
              id="unit-switch"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white font-medium transition-all"
            >
              <option value="">Všechny jednotky</option>
              {unitsFromResults.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tlačítko testu */}
        <button
          onClick={handleTest}
          disabled={loading || !selectedService}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Počítám...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Spustit test výpočtu
            </>
          )}
        </button>

        {/* Chyba */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-6 py-4 rounded-xl text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* Výsledky */}
        {filteredResults && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-t border-gray-100 dark:border-slate-700 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-green-500 rounded-full"></span>
                Výsledky výpočtu
              </h3>

              {/* Statistiky */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Celkový náklad</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {filteredResults.totalCost.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Rozúčtováno</div>
                  <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {filteredResults.totalDistributed.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div className={`border rounded-xl p-4 ${
                  Math.abs(filteredResults.difference) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                    Math.abs(filteredResults.difference) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    Rozdíl
                  </div>
                  <div className={`text-2xl font-bold ${
                    Math.abs(filteredResults.difference) < 0.01 ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100'
                  }`}>
                    {filteredResults.difference.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
              </div>

              {/* Detail vybrané jednotky */}
              {selectedUnit && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Vybraná jednotka</div>
                      <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-1">{selectedUnit.unitName}</div>
                      <div className="text-sm text-blue-800 dark:text-blue-200 font-mono break-all bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded border border-blue-100 dark:border-blue-800/30 inline-block">
                        {selectedUnit.formula}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Částka</div>
                      <div className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">{selectedUnit.amount.toLocaleString('cs-CZ')} Kč</div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Hodnota: <span className="font-mono font-bold">{selectedUnit.breakdown.unitValue.toFixed(2)}</span> · 
                        Cena/jedn.: <span className="font-mono font-bold">{selectedUnit.breakdown.pricePerUnit.toFixed(2)} Kč</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabulka jednotek */}
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Jednotka
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Vzorec
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Hodnota jednotky
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cena/jednotku
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Částka
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {filteredResults.results.map((result) => (
                        <tr key={result.unitId} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {result.unitName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">
                            {result.formula}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-mono">
                            {result.breakdown.unitValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-mono">
                            {result.breakdown.pricePerUnit.toFixed(2)} Kč
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-right font-mono">
                            {result.amount.toLocaleString('cs-CZ')} Kč
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">
                          Celkem
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-right font-mono">
                          {filteredResults.totalDistributed.toLocaleString('cs-CZ')} Kč
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Debug info */}
              <details className="mt-6 group">
                <summary className="cursor-pointer text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 select-none">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  🔍 Zobrazit kompletní debug informace
                </summary>
                <div className="mt-3 p-4 bg-gray-900 text-emerald-400 rounded-xl text-xs overflow-x-auto font-mono shadow-inner border border-gray-800">
                  <pre>{JSON.stringify(filteredResults, null, 2)}</pre>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
