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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          🧪 Test dynamického výpočetního enginu
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Vyzkoušejte, jak engine rozúčtuje náklady na jednotky podle nastavené konfigurace
        </p>
      </div>

      <div className="space-y-4">
        {/* Výběr služby */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Služba *
          </label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <div className="font-semibold text-blue-900">Konfigurace:</div>
              <div className="text-blue-800 mt-1">
                Typ: <span className="font-mono">{selectedServiceObj.dataSourceType || 'Stará metodologie'}</span>
              </div>
              {selectedServiceObj.dataSourceName && (
                <div className="text-blue-800">
                  Zdroj: <span className="font-mono">{selectedServiceObj.dataSourceName}</span>
                </div>
              )}
              {selectedServiceObj.unitAttributeName && (
                <div className="text-blue-800">
                  Atribut: <span className="font-mono">{selectedServiceObj.unitAttributeName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Období */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Období (rok) *
          </label>
          <input
            type="number"
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            min="2020"
            max="2030"
            aria-label="Období výpočtu"
          />
        </div>

        {/* Excel přepínač (Vstupní data!B4) */}
        <div className="border border-blue-200 bg-blue-50 rounded p-3">
          <div className="text-sm font-medium text-gray-900 mb-2">Napodobit Excel: Vstupní data!B4 (BYT)</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={excelFileName}
              onChange={(e) => setExcelFileName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="vyuctovani2024 (20).xlsx"
            />
            <button
              type="button"
              onClick={loadExcelSelection}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Načíst výběr z Excelu
            </button>
          </div>
          <div className="text-xs text-gray-700 mt-1">Čte hodnotu buňky Vstupní data!B4 a nastaví vybranou jednotku.</div>
        </div>

        {/* Celkový náklad */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Celkový náklad (Kč) *
          </label>
          <input
            type="number"
            value={totalCost}
            onChange={(e) => setTotalCost(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            step="0.01"
            aria-label="Celkový náklad"
          />
        </div>

        {/* Přepínač jednotky (po výpočtu) */}
        {results && unitsFromResults.length > 0 && (
          <div>
            <label htmlFor="unit-switch" className="block text-sm font-medium text-gray-900 mb-2">
              Jednotka (přepnout jako v Excelu)
            </label>
            <select
              id="unit-switch"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Počítám...' : '▶️ Spustit test výpočtu'}
        </button>

        {/* Chyba */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Výsledky */}
        {filteredResults && (
          <div className="mt-6 space-y-4">
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Výsledky výpočtu</h3>

              {/* Statistiky */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="text-xs text-blue-600 uppercase">Celkový náklad</div>
                  <div className="text-xl font-bold text-blue-900">
                    {filteredResults.totalCost.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="text-xs text-green-600 uppercase">Rozúčtováno</div>
                  <div className="text-xl font-bold text-green-900">
                    {filteredResults.totalDistributed.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div className={`border rounded p-3 ${
                  Math.abs(filteredResults.difference) < 0.01
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className={`text-xs uppercase ${
                    Math.abs(filteredResults.difference) < 0.01 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    Rozdíl
                  </div>
                  <div className={`text-xl font-bold ${
                    Math.abs(filteredResults.difference) < 0.01 ? 'text-green-900' : 'text-yellow-900'
                  }`}>
                    {filteredResults.difference.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
              </div>

              {/* Detail vybrané jednotky */}
              {selectedUnit && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-blue-700 uppercase">Vybraná jednotka</div>
                      <div className="text-lg font-bold text-blue-900">{selectedUnit.unitName}</div>
                      <div className="text-sm text-blue-800 font-mono break-all">{selectedUnit.formula}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-700 uppercase">Částka</div>
                      <div className="text-2xl font-extrabold text-blue-900">{selectedUnit.amount.toLocaleString('cs-CZ')} Kč</div>
                      <div className="text-xs text-blue-700">Hodnota: {selectedUnit.breakdown.unitValue.toFixed(2)} · Cena/jedn.: {selectedUnit.breakdown.pricePerUnit.toFixed(2)} Kč</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabulka jednotek */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Jednotka
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Vzorec
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Hodnota jednotky
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Cena/jednotku
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Částka
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResults.results.map((result) => (
                      <tr key={result.unitId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {result.unitName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {result.formula}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {result.breakdown.unitValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {result.breakdown.pricePerUnit.toFixed(2)} Kč
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          {result.amount.toLocaleString('cs-CZ')} Kč
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900">
                        Celkem
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {filteredResults.totalDistributed.toLocaleString('cs-CZ')} Kč
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Debug info */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                  🔍 Zobrazit kompletní debug informace
                </summary>
                <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto">
                  {JSON.stringify(filteredResults, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
