'use client'

import { useCallback, useRef, useState } from 'react'

type ImportedCost = {
  service: string
  amount: number
  newService: boolean
}

type ImportedReading = {
  unitNumber: string
  meterNumber: string
  consumption: number
  status: string
}

type ImportResult = {
  message: string
  imported: (ImportedCost | ImportedReading)[]
  skipped: string[]
  errors: string[]
  summary?: string[]
  results?: {
    invoices: { imported: ImportedCost[]; errors: string[]; skipped: string[] }
    hot_water: { imported: ImportedReading[]; errors: string[]; skipped: string[] }
    cold_water: { imported: ImportedReading[]; errors: string[]; skipped: string[] }
    heating: { imported: ImportedReading[]; errors: string[]; skipped: string[] }
    electricity: { imported: ImportedReading[]; errors: string[]; skipped: string[] }
  }
  totalImported?: number
}

type ImportType = 'all' | 'invoices' | 'hot_water' | 'cold_water' | 'heating' | 'electricity'

interface ExcelImportProps {
  buildingId: string
  year?: number
}

const IMPORT_TYPES: Record<ImportType, { label: string; description: string }> = {
  all: {
    label: '🎯 Kompletní import',
    description: 'Automaticky importuje všechna data (faktury + všechny odečty)'
  },
  invoices: { 
    label: '💰 Faktury', 
    description: 'Import nákladů z listu "Faktury"' 
  },
  hot_water: { 
    label: '🚿 Odečty TUV', 
    description: 'Import odečtů teplé vody z listu "Vodoměry TUV"' 
  },
  cold_water: { 
    label: '💧 Odečty SV', 
    description: 'Import odečtů studené vody z listu "Vodoměry SV"' 
  },
  heating: { 
    label: '🔥 Odečty tepla', 
    description: 'Import odečtů topení z listu "Teplo"' 
  },
  electricity: { 
    label: '⚡ Odečty elektřiny', 
    description: 'Import odečtů elektřiny z listu "Elektroměry"' 
  }
}

export default function ExcelImport({ buildingId, year = new Date().getFullYear() }: ExcelImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importType, setImportType] = useState<ImportType>('all')

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      if (!/\.xlsx?$/i.test(file.name)) {
        throw new Error('Podporované jsou pouze soubory XLS nebo XLSX')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('buildingId', buildingId)
      formData.append('year', year.toString())
      formData.append('importType', importType)

      const response = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? 'Import se nezdařil')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import se nezdařil')
    } finally {
      setUploading(false)
      resetInput()
    }
  }, [buildingId, year, importType])

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }
    void uploadFile(files[0])
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragActive(false)
    handleFiles(event.dataTransfer.files)
  }

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragActive(false)
  }

  return (
    <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 border border-gray-200 dark:border-slate-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
        <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">📊</span>
        Import dat z Excelu
      </h2>
      
      {/* Výběr typu importu */}
      <div className="mb-8">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Vyberte typ dat k importu
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(IMPORT_TYPES) as [ImportType, typeof IMPORT_TYPES[ImportType]][]).map(([type, info]) => (
            <button
              key={type}
              type="button"
              onClick={() => setImportType(type)}
              disabled={uploading}
              className={`p-4 text-left border-2 rounded-xl transition-all duration-200 ${
                importType === type
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-gray-50 dark:hover:bg-slate-800'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`font-bold mb-1 ${importType === type ? 'text-teal-900 dark:text-teal-100' : 'text-gray-900 dark:text-white'}`}>{info.label}</div>
              <div className={`text-xs ${importType === type ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{info.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Info box pro kompletní import */}
      {importType === 'all' && (
        <div className="mb-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl p-4 flex items-start gap-3">
          <div className="shrink-0 p-1 bg-teal-100 dark:bg-teal-900/40 rounded-lg text-teal-600 dark:text-teal-400">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-teal-900 dark:text-teal-100">Co bude importováno:</h3>
            <div className="mt-1 text-sm text-teal-700 dark:text-teal-300">
              <ul className="list-disc list-inside space-y-1">
                <li>Bytové domy a jejich údaje</li>
                <li>Jednotky (byty, garáže, sklepy)</li>
                <li>Odečty formular</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-600 dark:text-slate-400 mb-6">
        {importType === 'all'
          ? `Nahrajte Excel soubor s kompletním vyúčtováním (rok ${year}). Systém automaticky rozpozná a importuje všechna data ze všech listů.`
          : importType === 'invoices' 
          ? `Nahrajte Excel soubor se záložkou "Faktury" (rok ${year}). Systém načte náklady ze sloupce E, služby ze sloupce A a způsob rozúčtování ze sloupce C.`
          : `Nahrajte Excel soubor se záložkou "${IMPORT_TYPES[importType].description.split('"')[1]}" (rok ${year}). Systém automaticky páruje odečty podle čísla měřidla.`
        }
      </p>

      <div 
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
            : 'border-gray-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-gray-50 dark:hover:bg-slate-700/50'
        }`}
      >
        <input
          ref={inputRef}
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />
        <label
          htmlFor="excel-upload"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="block cursor-pointer w-full h-full"
        >
          <div className={`mx-auto h-16 w-16 mb-4 transition-colors ${dragActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-slate-500'}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {uploading ? 'Importuji data...' : 'Klikněte pro výběr souboru'}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">nebo přetáhněte soubor sem</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 font-mono bg-gray-100 dark:bg-slate-900 inline-block px-2 py-1 rounded">Podporované formáty: .xlsx, .xls</p>
        </label>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {result.message}
          </div>

          {/* Souhrn pro kompletní import */}
          {result.summary && result.summary.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-teal-900 dark:text-teal-100 mb-3 flex items-center gap-2">
                📋 Souhrn importu
              </h3>
              <ul className="space-y-2">
                {result.summary.map((item, index) => (
                  <li key={index} className="text-sm text-teal-800 dark:text-teal-200 flex items-center">
                    <span className="mr-2">{item.startsWith('✅') ? '✅' : '⚠️'}</span>
                    <span>{item.replace(/^[✅⚠️]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailní výsledky pro kompletní import */}
          {result.results && (
            <div className="space-y-6">
              {/* Faktury */}
              {result.results.invoices.imported.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">💰</span>
                      Importované faktury
                    </h3>
                  </div>
                  <div className="overflow-auto max-h-80">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Služba</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Částka</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {result.results.invoices.imported.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{item.service}</td>
                            <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-white font-medium">
                              {item.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                            </td>
                            <td className="px-6 py-3 text-center">
                              {item.newService ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                                  Nová služba
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                  Existující
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-slate-800 sticky bottom-0 z-10 border-t border-gray-200 dark:border-slate-700">
                        <tr>
                          <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">Celkem</td>
                          <td className="px-6 py-3 text-right font-bold font-mono text-teal-600 dark:text-teal-400 text-base">
                            {result.results.invoices.imported
                              .reduce((sum, item) => sum + item.amount, 0)
                              .toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </td>
                          <td className="px-6 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Odečty - sloučené zobrazení */}
              {(result.results.hot_water.imported.length > 0 ||
                result.results.cold_water.imported.length > 0 ||
                result.results.heating.imported.length > 0 ||
                result.results.electricity.imported.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 px-1">
                    <span className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">📊</span>
                    Importované odečty měřidel
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: 'hot_water', label: '🚿 Teplá voda (TUV)', data: result.results.hot_water, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10' },
                      { key: 'cold_water', label: '💧 Studená voda (SV)', data: result.results.cold_water, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                      { key: 'heating', label: '🔥 Teplo', data: result.results.heating, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10' },
                      { key: 'electricity', label: '⚡ Elektřina', data: result.results.electricity, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/10' }
                    ].map(({ key, label, data, color, bg }) => {
                      if (data.imported.length === 0) return null
                      return (
                        <div key={key} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          <div className={`px-4 py-3 border-b border-gray-200 dark:border-slate-700 ${bg}`}>
                            <h4 className={`text-sm font-bold ${color}`}>{label}</h4>
                          </div>
                          <div className="overflow-auto max-h-60">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Jednotka</th>
                                  <th className="px-4 py-2 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Měřidlo</th>
                                  <th className="px-4 py-2 text-right font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Spotřeba</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {data.imported.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.unitNumber}</td>
                                    <td className="px-4 py-2 font-mono text-gray-600 dark:text-slate-400">{item.meterNumber}</td>
                                    <td className="px-4 py-2 text-right font-mono font-medium text-gray-900 dark:text-white">
                                      {item.consumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Původní zobrazení pro jednotlivé importy */}
          {!result.results && result.imported.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="p-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">📋</span>
                  {importType === 'invoices' ? 'Importované faktury' : 'Importované odečty'}
                </h3>
              </div>
              <div className="overflow-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                    <tr>
                      {importType === 'invoices' ? (
                        <>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Služba</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Částka</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Jednotka</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Číslo měřidla</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Spotřeba</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                    {result.imported.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        {importType === 'invoices' && 'service' in item ? (
                          <>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{item.service}</td>
                            <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-white font-medium">{item.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</td>
                            <td className="px-6 py-3 text-center">
                              {item.newService ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                                  Nová služba
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                  Existující
                                </span>
                              )}
                            </td>
                          </>
                        ) : 'unitNumber' in item ? (
                          <>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{item.unitNumber}</td>
                            <td className="px-6 py-3 text-gray-600 dark:text-slate-400 font-mono">{item.meterNumber}</td>
                            <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-white font-medium">{item.consumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}</td>
                            <td className="px-6 py-3 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                Importováno
                              </span>
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  {importType === 'invoices' && (
                    <tfoot className="bg-gray-50 dark:bg-slate-800 sticky bottom-0 z-10 border-t border-gray-200 dark:border-slate-700">
                      <tr>
                        <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">Celkem</td>
                        <td className="px-6 py-3 text-right font-bold font-mono text-teal-600 dark:text-teal-400 text-base">
                          {result.imported
                            .filter((item): item is ImportedCost => 'amount' in item)
                            .reduce((sum, item) => sum + item.amount, 0)
                            .toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                        </td>
                        <td className="px-6 py-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Chyby */}
          {result.errors && result.errors.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-yellow-100 dark:bg-yellow-900/40 border-b border-yellow-200 dark:border-yellow-800">
                <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  ⚠️ Chyby při importu
                </h3>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-2">
                  {result.errors.map((err, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Přeskočené položky */}
          {result.skipped && result.skipped.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 flex items-center gap-2">
                  ⏭️ Přeskočené položky
                </h3>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1 font-mono">
                  {result.skipped.map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
