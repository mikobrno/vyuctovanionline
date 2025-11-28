'use client'

import { useState } from 'react'

interface ServiceInfo {
  id: string
  name: string
  code: string
  excelColumn?: string | null
  advancePaymentColumn?: string | null
  isActive?: boolean
}

interface ServiceMappingUploaderProps {
  buildingId: string
  buildingName?: string
  hasMapping?: boolean
  services?: ServiceInfo[]
  onSuccess?: () => void
}

interface MappingResult {
  name: string
  excelCode: string | null
  jsonKey: string | null
  action: string
}

export default function ServiceMappingUploader({ 
  buildingId, 
  hasMapping = false,
  services = [],
  onSuccess 
}: ServiceMappingUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    updated: number
    skipped: number
    services: MappingResult[]
  } | null>(null)
  const [isExpanded, setIsExpanded] = useState(!hasMapping)

  // Počet služeb s mapováním
  const mappedServicesCount = services.filter(s => s.advancePaymentColumn || s.excelColumn).length

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/import/service-mapping?buildingId=${buildingId}`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Chyba při nahrávání')
      }

      setResult(data.results)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setIsUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${hasMapping ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100 dark:bg-yellow-900'}`}>
            {hasMapping ? (
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Mapování služeb
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasMapping 
                ? `${mappedServicesCount} z ${services.length} služeb má nakonfigurované mapování` 
                : 'Je potřeba nahrát Excel s konfigurací služeb'}
            </p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mt-4 space-y-4">
            
            {/* Aktuální mapování služeb */}
            {services.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Aktuální mapování ({services.length} služeb)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">Služba</th>
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">Excel kód</th>
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">JSON klíč</th>
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">Stav</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc) => (
                        <tr key={svc.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 text-gray-900 dark:text-gray-100">{svc.name}</td>
                          <td className="py-2">
                            {svc.excelColumn ? (
                              <span className="font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                {svc.excelColumn}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2">
                            {svc.advancePaymentColumn ? (
                              <span className="font-mono bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                                {svc.advancePaymentColumn}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2">
                            {svc.advancePaymentColumn ? (
                              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Bez mapování
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Jak funguje mapování služeb?
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Nahrajte Excel se seznamem služeb (obvykle list &quot;vstupní data&quot;)</li>
                <li>Systém načte služby a jejich kódy předpisů (sloupec M/N)</li>
                <li>Kódy se použijí pro správné přiřazení předpisů z JSON</li>
                <li>Mapování stačí nahrát jednou, pak se použije pro všechny roky</li>
              </ul>
            </div>

            {/* Upload area */}
            <div className="relative">
              <label htmlFor="service-mapping-upload" className="sr-only">
                Nahrát Excel s mapováním služeb
              </label>
              <input
                id="service-mapping-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                aria-label="Nahrát Excel s mapováním služeb"
              />
              <div className={`
                border-2 border-dashed rounded-lg p-6 text-center
                ${isUploading 
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'}
                transition-colors
              `}>
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-blue-600 dark:text-blue-400">Nahrávám...</span>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-blue-600 dark:text-blue-400">Klikněte pro výběr</span>
                      {' '}nebo přetáhněte Excel soubor
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      .xlsx nebo .xls
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              </div>
            )}

            {/* Success result */}
            {result && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    Mapování úspěšně nahráno
                  </span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                  <p>✓ Vytvořeno: {result.created} služeb</p>
                  <p>✓ Aktualizováno: {result.updated} služeb</p>
                  {result.skipped > 0 && <p>○ Přeskočeno: {result.skipped}</p>}
                </div>
                
                {result.services.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-green-700 dark:text-green-300 hover:underline">
                      Zobrazit detail ({result.services.length} služeb)
                    </summary>
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left border-b border-green-200 dark:border-green-700">
                            <th className="pb-1">Služba</th>
                            <th className="pb-1">Kód</th>
                            <th className="pb-1">JSON klíč</th>
                            <th className="pb-1">Akce</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.services.map((svc, i) => (
                            <tr key={i} className="border-b border-green-100 dark:border-green-800">
                              <td className="py-1">{svc.name}</td>
                              <td className="py-1 font-mono">{svc.excelCode || '-'}</td>
                              <td className="py-1 font-mono">{svc.jsonKey || '-'}</td>
                              <td className="py-1">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  svc.action === 'created' 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {svc.action === 'created' ? 'nová' : 'aktualizováno'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
