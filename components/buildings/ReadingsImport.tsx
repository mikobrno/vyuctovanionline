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
    <div className="mt-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Import odečtů z Excelu</h2>
      <p className="text-gray-600 mb-4">
        Nahrajte Excel soubor se záložkami odečtů měřidel (rok {year}). Systém načte odečty ze všech záložek: Vodoměry TUV, Vodoměry SV, Teplo, Elektroměry.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors">
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
          className={`block cursor-pointer ${dragActive ? 'text-blue-600' : ''}`}
        >
          <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            {uploading ? 'Importuji odečty...' : 'Klikněte pro výběr souboru'}
          </p>
          <p className="text-sm text-gray-600">nebo přetáhněte soubor sem</p>
          <p className="text-xs text-gray-500 mt-2">Podporované formáty: .xlsx, .xls</p>
        </label>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            ✅ {result.message}
          </div>

          {result.foundSheets && result.foundSheets.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                📑 Načtené záložky: <strong>{result.foundSheets.join(', ')}</strong>
              </p>
            </div>
          )}

          {groupedReadings && Object.keys(groupedReadings).length > 0 && (
            <div className="space-y-6">
              {Object.entries(groupedReadings).map(([meterType, readings]) => (
                <div key={meterType}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    {meterType} ({readings.length} odečtů)
                  </h3>
                  <div className="overflow-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Jednotka</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Vlastník</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Spotřeba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {readings.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 font-medium">{item.unitNumber}</td>
                            <td className="px-4 py-2 text-gray-600">{item.ownerName}</td>
                            <td className="px-4 py-2 text-right font-mono">
                              {item.consumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-4 py-2 font-semibold" colSpan={2}>Celkem</td>
                          <td className="px-4 py-2 text-right font-semibold font-mono">
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
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Chyby při importu</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <ul className="text-sm text-yellow-800 space-y-1">
                  {result.errors.map((err, index) => (
                    <li key={index}>⚠️ {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Přeskočené položky</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <ul className="text-sm text-gray-700 space-y-1">
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
