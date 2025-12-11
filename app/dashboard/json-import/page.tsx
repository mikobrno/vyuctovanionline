'use client'

import { useState } from 'react'

export default function JsonImportPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      setMessage('Vložte JSON data z Excelu')
      setStatus('error')
      return
    }

    if (!buildingName.trim()) {
      setMessage('Zadejte název budovy')
      setStatus('error')
      return
    }

    setStatus('loading')
    setMessage('Importuji data...')

    try {
      // Parsovat JSON
      let data: unknown[]
      try {
        data = JSON.parse(jsonInput)
        if (!Array.isArray(data)) {
          throw new Error('Data musí být pole')
        }
      } catch {
        setMessage('Neplatný JSON formát. Zkontrolujte data z Excelu.')
        setStatus('error')
        return
      }

      // Odeslat na API
      const response = await fetch('/api/import/json-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingName,
          year,
          data
        })
      })

      const result = await response.json()

      if (result.success) {
        setStatus('success')
        setMessage(`✅ Import úspěšný!`)
        setResult(result)
      } else {
        setStatus('error')
        setMessage(`❌ Chyba: ${result.error}`)
      }
    } catch (error) {
      setStatus('error')
      setMessage(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setJsonInput(text)
    } catch {
      setMessage('Nepodařilo se vložit ze schránky. Vložte ručně.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Import z Excelu (JSON)
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Vložte JSON data vygenerovaná Office Scriptem z Excelu
        </p>

        {/* Konfigurace */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Nastavení</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Název budovy *
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="např. Mikšíčkova 1513"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rok vyúčtování *
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* JSON vstup */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold dark:text-white">JSON Data</h2>
            <button
              onClick={handlePaste}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-white"
            >
              📋 Vložit ze schránky
            </button>
          </div>
          
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[{"UnitName": "Byt-č.-151301", "DataType": "INFO", ...}, ...]'
            rows={12}
            className="w-full px-3 py-2 border rounded-lg font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {jsonInput ? `${jsonInput.length.toLocaleString()} znaků` : 'Vložte JSON pole z Excelu'}
          </p>
        </div>

        {/* Tlačítko */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleImport}
            disabled={status === 'loading'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? '⏳ Importuji...' : '🚀 Importovat do portálu'}
          </button>
          
          <button
            onClick={() => {
              setJsonInput('')
              setStatus('idle')
              setMessage('')
              setResult(null)
            }}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            🗑️ Vymazat
          </button>
        </div>

        {/* Status */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}>
            {message}
          </div>
        )}

        {/* Výsledek */}
        {result && status === 'success' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">📊 Výsledek importu</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {(result.stats as Record<string, number>)?.rowsReceived || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Řádků přijato</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(result.stats as Record<string, number>)?.resultsCreated || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Jednotek</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {(result.stats as Record<string, number>)?.servicesCreated || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Služeb</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {(result.stats as Record<string, number>)?.unitsCreated || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Nových jednotek</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Building ID:</strong> {result.buildingId as string}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Rok:</strong> {result.year as number}
              </p>
            </div>

            <div className="mt-4">
              <a 
                href={`/buildings/${result.buildingId}`}
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                → Zobrazit budovu
              </a>
            </div>
          </div>
        )}

        {/* Návod */}
        <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="font-semibold mb-3 dark:text-white">📖 Jak na to:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Spusť Office Script V39 v Excelu</li>
            <li>Script vytvoří záložku <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">EXPORT_FULL</code> a zkopíruje JSON do schránky</li>
            <li>Přijď sem a klikni na <strong>Vložit ze schránky</strong></li>
            <li>Vyplň název budovy a rok</li>
            <li>Klikni na <strong>Importovat do portálu</strong></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
