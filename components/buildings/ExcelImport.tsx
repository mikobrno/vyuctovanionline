'use client'

import { useCallback, useRef, useState } from 'react'

type UploadSummary = {
  message: string
  sheets: { name: string; rowCount: number }[]
  preview: (string | number | null)[][]
}

export default function ExcelImport() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<UploadSummary | null>(null)

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setSummary(null)
    try {
      if (!/\.xlsx?$/i.test(file.name)) {
        throw new Error('Podporované jsou pouze soubory XLS nebo XLSX')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? 'Nahrání se nezdařilo')
      }

      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání se nezdařilo')
    } finally {
      setUploading(false)
      resetInput()
    }
  }, [])

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
    <div className="mt-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Import dat z Excelu</h2>
      <p className="text-gray-600 mb-4">
        Nahrajte svůj Excel soubor (např. vyuctovani2024.xlsx) a systém automaticky připraví data k importu.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors">
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
          className={`block cursor-pointer ${dragActive ? 'text-blue-600' : ''}`}
        >
          <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            {uploading ? 'Nahrávám...' : 'Klikněte pro výběr souboru'}
          </p>
          <p className="text-sm text-gray-600">nebo přetáhněte soubor sem</p>
          <p className="text-xs text-gray-500 mt-2">Podporované formáty: .xlsx, .xls</p>
        </label>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {summary.message}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detaily listů</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {summary.sheets.map((sheet) => (
                <div key={sheet.name} className="p-3 border border-gray-200 rounded-lg text-sm flex justify-between">
                  <span className="font-medium text-gray-900">{sheet.name}</span>
                  <span className="text-gray-600">{sheet.rowCount} řádků</span>
                </div>
              ))}
            </div>
          </div>

          {summary.preview.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Náhled prvních řádků</h3>
              <div className="overflow-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <tbody>
                    {summary.preview.map((row, rowIndex) => (
                      <tr key={`preview-${rowIndex}`} className={rowIndex === 0 ? 'bg-gray-50 font-semibold' : ''}>
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 border border-gray-100">
                            {cell ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
