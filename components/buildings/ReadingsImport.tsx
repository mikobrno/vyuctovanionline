'use client'

import { useCallback, useRef, useState } from 'react'

type ImportedReading = {
  unitNumber: string
  ownerName: string
  meterType: string
  consumption: number
  created: boolean
}

type ImportResult = {
  message: string
  imported: ImportedReading[]
  skipped: string[]
  errors: string[]
  foundSheets: string[]
}

interface ReadingsImportProps {
  buildingId: string
  year?: number
}

export default function ReadingsImport({ buildingId, year = new Date().getFullYear() }: ReadingsImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

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

      const response = await fetch('/api/import/readings', {
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
  }, [buildingId, year])

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

  // Seskupit odečty podle typu měřidla
  const groupedReadings = result?.imported.reduce((acc, reading) => {
    if (!acc[reading.meterType]) {
      acc[reading.meterType] = []
    }
    acc[reading.meterType].push(reading)
    return acc
  }, {} as Record<string, ImportedReading[]>)

  return (
    <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 border border-gray-200 dark:border-slate-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
        <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">📊</span>
        Import odečtů z Excelu
      </h2>
      <p className="text-gray-600 dark:text-slate-400 mb-6">
        Nahrajte Excel soubor se záložkami odečtů měřidel (rok {year}). Systém načte odečty ze všech záložek: Vodoměry TUV, Vodoměry SV, Teplo, Elektroměry.
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
          id="readings-upload"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />
        <label
          htmlFor="readings-upload"
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
            {uploading ? 'Importuji odečty...' : 'Klikněte pro výběr souboru'}
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

          {result.foundSheets && result.foundSheets.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
              <p className="text-sm text-teal-800 dark:text-teal-300 flex items-center gap-2">
                <span className="font-bold">📑 Načtené záložky:</span> 
                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800/50">{result.foundSheets.join(', ')}</span>
              </p>
            </div>
          )}

          {groupedReadings && Object.keys(groupedReadings).length > 0 && (
            <div className="space-y-8">
              {Object.entries(groupedReadings).map(([meterType, readings]) => (
                <div key={meterType} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      {meterType}
                    </h3>
                    <span className="text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                      {readings.length} odečtů
                    </span>
                  </div>
                  
                  <div className="overflow-auto max-h-96">
                    <table className="min-w-full text-sm relative">
                      <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Jednotka</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Vlastník</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">Spotřeba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {readings.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="px-6 py-3 font-medium text-teal-600 dark:text-teal-400">{item.unitNumber}</td>
                            <td className="px-6 py-3 text-gray-900 dark:text-slate-300">{item.ownerName}</td>
                            <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-slate-200 font-medium">
                              {item.consumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-slate-800 sticky bottom-0 z-10 border-t border-gray-200 dark:border-slate-700 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
                        <tr>
                          <td className="px-6 py-3 font-bold text-gray-900 dark:text-white" colSpan={2}>Celkem</td>
                          <td className="px-6 py-3 text-right font-bold font-mono text-teal-600 dark:text-teal-400 text-base">
                            {readings.reduce((sum, item) => sum + item.consumption, 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.errors.length > 0 && (
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

          {result.skipped.length > 0 && (
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
