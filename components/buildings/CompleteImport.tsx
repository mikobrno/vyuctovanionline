'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImportSummary {
  building: {
    id: string
    name: string
    created: boolean
  }
  units: {
    created: number
    existing: number
    total: number
  }
  services: {
    created: number
    existing: number
    total: number
  }
  costs: {
    created: number
    total: number
  }
  readings: {
    created: number
    total: number
  }
  payments: {
    created: number
    total: number
  }
  costsByService?: { name: string; amount: number }[]
  advances?: { created: number; updated: number; total: number }
  errors: string[]
  warnings: string[]
}

interface ImportResult {
  message: string
  summary?: ImportSummary
  // Pro JSON auto-import
  building?: { id: string; name: string; created: boolean }
  year?: number
  advances?: { created: number; updated: number; total: number }
  logs?: string[]
}

interface CompleteImportProps {
  year?: number
  buildingId?: string
  // Už nepotřebujeme buildings - auto-detekce z JSON
}

export default function CompleteImport({
  year = new Date().getFullYear() - 1,
  buildingId,
}: CompleteImportProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [percentage, setPercentage] = useState(0)

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)
    setProgress([])
    setPercentage(0)
    setCurrentStep('Připravuji import...')
    
    try {
      const isJson = /\.json$/i.test(file.name)
      const isExcel = /\.xlsx?$/i.test(file.name)
      
      if (!isJson && !isExcel) {
        throw new Error('Podporované jsou pouze soubory XLS, XLSX nebo JSON')
      }

      setProgress(prev => [...prev, `📄 Načítám soubor: ${file.name}`])
      setCurrentStep('Nahrávám soubor na server...')

      const formData = new FormData()
      formData.append('file', file)
      if (buildingId) {
        formData.append('buildingId', buildingId)
      }
      formData.append('year', year.toString())

      setProgress(prev => [...prev, '📤 Odesílám data na server...'])
      
      if (isJson) {
        // Pro JSON soubory použijeme auto-detect endpoint
        setCurrentStep('Zpracovávám JSON soubor (automatická detekce)...')
        setProgress(prev => [...prev, '🔍 Automaticky rozpoznávám dům a rok z JSON...'])
        
        const response = await fetch('/api/import/json-auto', {
          method: 'POST',
          body: formData,
        })
        
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Import se nezdařil')
        }
        
        // Úspěšný JSON import
        setProgress(prev => [...prev, `🏢 Dům: ${data.building.name} ${data.building.created ? '(nově vytvořen)' : '(existující)'}`])
        setProgress(prev => [...prev, `📅 Rok: ${data.year}`])
        setProgress(prev => [...prev, `💰 Předpisy záloh: ${data.advances.total} záznamů (${data.advances.created} nových)`])
        
        // Info o mapování služeb
        if (data.serviceMapping) {
          if (data.serviceMapping.hasMapping) {
            setProgress(prev => [...prev, `🔗 Mapování služeb: ${data.serviceMapping.mappedServices}/${data.serviceMapping.totalServices} služeb nakonfigurováno`])
          } else if (data.serviceMapping.unmappedJsonKeys?.length > 0) {
            setProgress(prev => [...prev, `⚠️ Služby bez mapování: ${data.serviceMapping.unmappedJsonKeys.join(', ')}`])
            setProgress(prev => [...prev, `💡 Tip: Nahrajte Excel s mapováním služeb v Nastavení domu`])
          }
        }
        
        // Warnings
        if (data.warnings?.length > 0) {
          for (const warning of data.warnings) {
            setProgress(prev => [...prev, warning])
          }
        }
        
        setCurrentStep('✅ Import dokončen!')
        setResult(data)
        setPercentage(100)
        router.refresh()
        
        // Přesměrování na detail domu
        if (data.building?.id) {
          setTimeout(() => {
            router.push(`/buildings/${data.building.id}`)
          }, 1500)
        }
        return
      }
      
      // Pro Excel soubory - původní logika
      setCurrentStep('Zpracovávám Excel soubor...')
      const endpoint = '/api/import/complete'
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const contentType = response.headers.get('Content-Type')

      if (contentType && contentType.includes('application/x-ndjson')) {
        const reader = response.body?.getReader()
        if (!reader) throw new Error('Stream not supported')
        
        const decoder = new TextDecoder()
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const msg = JSON.parse(line)
              if (msg.type === 'log') {
                setProgress(prev => [...prev, msg.message])
              } else if (msg.type === 'progress') {
                if (msg.percentage) setPercentage(msg.percentage)
                if (msg.step) setCurrentStep(msg.step)
              } else if (msg.type === 'result') {
                setResult(msg.data)
                setCurrentStep('✅ Import dokončen!')
                setPercentage(100)
                router.refresh()

                const targetBuildingId = msg.data?.summary?.building?.id
                if (targetBuildingId) {
                  setTimeout(() => {
                    router.push(`/buildings/${targetBuildingId}`)
                  }, 800)
                }
              } else if (msg.type === 'error') {
                throw new Error(msg.message)
              }
            } catch (e) {
              console.error('Parse error', e)
            }
          }
        }
      } else {
        const data = await response.json()

        if (!response.ok) {
          // Vyčistit technické chyby z Turbopack/Next.js
          let cleanMessage = data.message ?? 'Import se nezdařil'
          
          // Odstranit technické detaily z chybové hlášky
          if (cleanMessage.includes('TURBOPACK') || cleanMessage.includes('__imported__module')) {
            // Extrahovat hlavní chybu z Prisma
            if (cleanMessage.includes('Unique constraint failed')) {
              if (cleanMessage.includes('unitNumber')) {
                cleanMessage = 'Import selhal: V souboru jsou duplicitní čísla jednotek. Zkontrolujte prosím, že každá jednotka má unikátní číslo (např. 318/01, 318/02).'
              } else {
                cleanMessage = 'Import selhal: Nalezena duplicitní data v databázi. Zkontrolujte prosím, že importovaná data jsou unikátní.'
              }
            } else if (cleanMessage.includes('Foreign key')) {
              cleanMessage = 'Import selhal: Chyba propojení dat v databázi. Zkontrolujte prosím, že budova existuje.'
            } else {
              cleanMessage = 'Import selhal: Chyba při zpracování dat. Zkontrolujte prosím formát Excelu a zkuste to znovu.'
            }
          }
          
          throw new Error(cleanMessage)
        }

        // Zpracovat summary a zobrazit kroky + serverové logy
        if (data.summary) {
          setProgress(prev => [...prev, `🏢 Budova: ${data.summary.building.name} ${data.summary.building.created ? '(nově vytvořena)' : '(existující)'}`])
          
          if (data.summary.units.total > 0) {
            setProgress(prev => [...prev, `🏠 Jednotky: ${data.summary.units.total} (${data.summary.units.created} nových)`])
          }
          
          if (data.summary.services.total > 0) {
            setProgress(prev => [...prev, `⚙️ Služby: ${data.summary.services.total} (${data.summary.services.created} nových)`])
          }
          
          if (data.summary.costs.total > 0) {
            setProgress(prev => [...prev, `🧾 Faktury: ${data.summary.costs.total} importováno`])
          }
          
          if (data.summary.readings.total > 0) {
            setProgress(prev => [...prev, `📊 Odečty měřidel: ${data.summary.readings.total} importováno`])
          }
          
          if (data.summary.payments.total > 0) {
            setProgress(prev => [...prev, `💳 Platby: ${data.summary.payments.total} importováno`])
          }
        }

        if (Array.isArray(data.logs) && data.logs.length) {
          setProgress(prev => [...prev, '🧪 Server logy:'])
          for (const l of data.logs.slice(0, 50)) { // limit
            setProgress(prev => [...prev, l])
          }
        }

        setCurrentStep('✅ Import dokončen!')
        setResult(data)
        setPercentage(100)
        router.refresh()

        const targetBuildingId = data?.summary?.building?.id
        if (targetBuildingId) {
          setTimeout(() => {
            router.push(`/buildings/${targetBuildingId}`)
          }, 800)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import se nezdařil')
      setCurrentStep('❌ Import selhal')
    } finally {
      setUploading(false)
      resetInput()
    }
  }, [year, router, buildingId])

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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 border border-gray-200 dark:border-slate-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
        <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">📊</span>
        Nahrát kompletní vyúčtování
      </h2>
      
      {/* Info box o automatické detekci */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Automatická detekce</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Stačí nahrát JSON soubor - systém automaticky rozpozná dům a rok z dat v souboru.
              Pokud dům neexistuje, vytvoří se automaticky.
            </p>
          </div>
        </div>
      </div>

      <div 
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
            : 'border-gray-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-gray-50 dark:hover:bg-slate-700/50'
        }`}
      >
        <input
          ref={inputRef}
          id="complete-upload"
          type="file"
              accept=".xlsx,.xls,.json"
              className="hidden"
              onChange={handleChange}
              disabled={uploading}
            />
            <label
              htmlFor="complete-upload"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`block w-full h-full ${uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <div className={`mx-auto h-16 w-16 mb-4 transition-colors ${dragActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-slate-500'}`}>
                {uploading ? (
                  <svg className="animate-spin h-16 w-16 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {uploading ? currentStep : 'Klikněte pro výběr souboru'}
              </p>
              {uploading && (
                <progress
                  value={percentage}
                  max={100}
                  className="w-full h-2.5 mb-4 max-w-md mx-auto rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700 text-teal-600"
                  aria-label="Průběh importu"
                />
              )}
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {uploading ? 'Prosím čekejte...' : 'nebo přetáhněte soubor sem'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 font-mono bg-gray-100 dark:bg-slate-900 inline-block px-2 py-1 rounded">Podporované formáty: .xlsx, .xls, .json</p>
            </label>
          </div>

          {/* Průběh importu */}
          {uploading && progress.length > 0 && (
            <div className="mt-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-teal-900 dark:text-teal-100 mb-3 flex items-center gap-2">
                📋 Průběh importu
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs bg-white dark:bg-slate-900 p-4 rounded-lg border border-teal-100 dark:border-teal-800/50">
                {progress.map((step, index) => (
                  <div key={index} className="text-teal-800 dark:text-teal-300 flex items-start">
                    <span className="mr-2 opacity-50">•</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
              <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl text-sm flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 px-6 py-4 rounded-xl text-sm flex items-center gap-3 font-bold">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {result.message}
              </div>

              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-teal-900 dark:text-teal-100 mb-6 flex items-center gap-2">
                  <span className="p-1.5 bg-teal-100 dark:bg-teal-900/40 rounded-lg">📊</span>
                  Souhrn importu
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Dům - podporuje oba formáty (summary.building nebo building) */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Dům</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white truncate" title={(result.summary?.building || result.building)?.name}>
                      {(result.summary?.building || result.building)?.name}
                    </p>
                    {(result.summary?.building || result.building)?.created && <span className="inline-block mt-1 text-[10px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">NOVÝ</span>}
                  </div>
                  
                  {/* Rok - jen pro JSON auto-import */}
                  {result.year && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Rok</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.year}</p>
                    </div>
                  )}

                  {/* Jednotky - jen pro Excel import */}
                  {result.summary?.units && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Jednotky</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.units.total}</p>
                        {result.summary.units.created > 0 && (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">
                            +{result.summary.units.created} nových
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Služby - jen pro Excel import */}
                  {result.summary?.services && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Služby</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.services.total}</p>
                        {result.summary.services.created > 0 && (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">
                            +{result.summary.services.created} nových
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Náklady - jen pro Excel import */}
                  {result.summary?.costs && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Náklady (faktury)</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.costs.total}</p>
                    </div>
                  )}

                  {/* Odečty - jen pro Excel import */}
                  {result.summary?.readings && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Odečty</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.readings.total}</p>
                    </div>
                  )}

                  {/* Platby - jen pro Excel import */}
                  {result.summary?.payments && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Platby</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.payments.total}</p>
                    </div>
                  )}

                  {/* Předpisy záloh - podporuje oba formáty */}
                  {(result.summary?.advances || result.advances) && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50 col-span-2 md:col-span-3">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Předpis záloh</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{(result.summary?.advances || result.advances)?.total}</p>
                        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                          ({(result.summary?.advances || result.advances)?.created} nových, {(result.summary?.advances || result.advances)?.updated} upraveno)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <a
                    href={`/buildings/${(result.summary?.building || result.building)?.id}`}
                    className="inline-flex items-center px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Zobrazit detail domu &rarr;
                  </a>
                </div>
              </div>

              {result.summary?.warnings && result.summary.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 bg-yellow-100 dark:bg-yellow-900/40 border-b border-yellow-200 dark:border-yellow-800">
                    <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                      ⚠️ Upozornění
                    </h3>
                  </div>
                  <div className="p-6 max-h-60 overflow-y-auto">
                    <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-2">
                      {result.summary.warnings.map((warn, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {result.summary?.errors && result.summary.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                    <h3 className="text-sm font-bold text-red-800 dark:text-red-200 flex items-center gap-2">
                      ❌ Chyby při importu
                    </h3>
                  </div>
                  <div className="p-6 max-h-60 overflow-y-auto">
                    <ul className="text-sm text-red-800 dark:text-red-300 space-y-2">
                      {result.summary.errors.map((err, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{err}</span>
                        </li>
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
