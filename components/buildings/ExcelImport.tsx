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
    <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📊 Import dat z Excelu</h2>
      
      {/* Výběr typu importu */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Vyberte typ dat k importu
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(IMPORT_TYPES) as [ImportType, typeof IMPORT_TYPES[ImportType]][]).map(([type, info]) => (
            <button
              key={type}
              type="button"
              onClick={() => setImportType(type)}
              disabled={uploading}
              className={`p-4 text-left border-2 rounded-lg transition-colors ${
                importType === type
                  ? 'border-primary bg-teal-50 dark:bg-teal-900/20 text-teal-900 dark:text-teal-100'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-900 dark:text-white'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-medium mb-1">{info.label}</div>
              <div className="text-xs text-gray-900 dark:text-gray-300">{info.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Info box pro kompletní import */}
      {importType === 'all' && (
        <div className="mb-4 bg-teal-50 dark:bg-teal-900/20 border-l-4 border-primary p-4">
          <div className="flex items-start">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-teal-800 dark:text-teal-200">Co bude importováno:</h3>
              <div className="mt-2 text-sm text-teal-700 dark:text-teal-300">
                <ul className="list-disc list-inside space-y-1">
                  <li>Bytové domy a jejich údaje</li>
                  <li>Jednotky (byty, garáže, sklepy)</li>
                  <li>Odečty formular</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-900 dark:text-white mb-4">
        {importType === 'all'
          ? `Nahrajte Excel soubor s kompletním vyúčtováním (rok ${year}). Systém automaticky rozpozná a importuje všechna data ze všech listů.`
          : importType === 'invoices' 
          ? `Nahrajte Excel soubor se záložkou "Faktury" (rok ${year}). Systém načte náklady ze sloupce E, služby ze sloupce A a způsob rozúčtování ze sloupce C.`
          : `Nahrajte Excel soubor se záložkou "${IMPORT_TYPES[importType].description.split('"')[1]}" (rok ${year}). Systém automaticky páruje odečty podle čísla měřidla.`
        }
      </p>

      <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center transition-colors">
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
          className={`block cursor-pointer ${dragActive ? 'text-primary' : ''}`}
        >
          <div className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {uploading ? 'Importuji faktury...' : 'Klikněte pro výběr souboru'}
          </p>
          <p className="text-sm text-gray-900 dark:text-gray-300">nebo přetáhněte soubor sem</p>
          <p className="text-xs text-gray-900 dark:text-gray-400 mt-2">Podporované formáty: .xlsx, .xls</p>
        </label>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg text-sm">
            ✅ {result.message}
          </div>

          {/* Souhrn pro kompletní import */}
          {result.summary && result.summary.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">📋 Souhrn importu</h3>
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
            <div className="space-y-4">
              {/* Faktury */}
              {result.results.invoices.imported.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">💰 Importované faktury</h3>
                  <div className="overflow-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">Služba</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">Částka</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {result.results.invoices.imported.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.service}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">
                              {item.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                            </td>
                            <td className="px-4 py-2 text-center">
                              {item.newService ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                                  Nová služba
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                                  Existující
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-slate-700/50">
                        <tr>
                          <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">Celkem</td>
                          <td className="px-4 py-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                            {result.results.invoices.imported
                              .reduce((sum, item) => sum + item.amount, 0)
                              .toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </td>
                          <td className="px-4 py-2"></td>
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
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📊 Importované odečty měřidel</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'hot_water', label: '🚿 Teplá voda (TUV)', data: result.results.hot_water },
                      { key: 'cold_water', label: '💧 Studená voda (SV)', data: result.results.cold_water },
                      { key: 'heating', label: '🔥 Teplo', data: result.results.heating },
                      { key: 'electricity', label: '⚡ Elektřina', data: result.results.electricity }
                    ].map(({ key, label, data }) => {
                      if (data.imported.length === 0) return null
                      return (
                        <div key={key} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">{label}</h4>
                          <div className="overflow-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-50 dark:bg-slate-700/50">
                                <tr>
                                  <th className="px-3 py-1 text-left font-medium text-gray-900 dark:text-white">Jednotka</th>
                                  <th className="px-3 py-1 text-left font-medium text-gray-900 dark:text-white">Měřidlo</th>
                                  <th className="px-3 py-1 text-right font-medium text-gray-900 dark:text-white">Spotřeba</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {data.imported.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-1 text-gray-900 dark:text-white">{item.unitNumber}</td>
                                    <td className="px-3 py-1 font-mono text-gray-900 dark:text-white">{item.meterNumber}</td>
                                    <td className="px-3 py-1 text-right font-mono text-gray-900 dark:text-white">
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
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {importType === 'invoices' ? 'Importované faktury' : 'Importované odečty'}
              </h3>
              <div className="overflow-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      {importType === 'invoices' ? (
                        <>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">Služba</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">Částka</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">Jednotka</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">Číslo měřidla</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">Spotřeba</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {result.imported.map((item, index) => (
                      <tr key={index}>
                        {importType === 'invoices' && 'service' in item ? (
                          <>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.service}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">{item.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</td>
                            <td className="px-4 py-2 text-center">
                              {item.newService ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                                  Nová služba
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                                  Existující
                                </span>
                              )}
                            </td>
                          </>
                        ) : 'unitNumber' in item ? (
                          <>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.unitNumber}</td>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.meterNumber}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">{item.consumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                Importováno
                              </span>
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  {importType === 'invoices' && (
                    <tfoot className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">Celkem</td>
                        <td className="px-4 py-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                          {result.imported
                            .filter((item): item is ImportedCost => 'amount' in item)
                            .reduce((sum, item) => sum + item.amount, 0)
                            .toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                        </td>
                        <td className="px-4 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Chyby */}
          {result.errors && result.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Chyby při importu</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                  {result.errors.map((err, index) => (
                    <li key={index}>⚠️ {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Přeskočené položky */}
          {result.skipped && result.skipped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Přeskočené položky</h3>
              <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                <ul className="text-sm text-gray-900 dark:text-white space-y-1">
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
