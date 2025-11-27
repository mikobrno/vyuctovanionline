'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  summary: ImportSummary
  logs?: string[]
}

type BuildingSelectOption = {
  id: string
  name: string
}

interface CompleteImportProps {
  year?: number
  buildingId?: string
  buildings?: BuildingSelectOption[]
}

export default function CompleteImport({
  year = new Date().getFullYear() - 1,
  buildingId,
  buildings = [],
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
  const [localBuildingId, setLocalBuildingId] = useState(buildingId ?? '')
  const [searchTerm, setSearchTerm] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLocalBuildingId(buildingId ?? '')
  }, [buildingId])

  const normalizedBuildings = useMemo(() => buildings ?? [], [buildings])

  const filteredBuildings = useMemo(() => {
    if (!searchTerm.trim()) {
      return normalizedBuildings
    }
    const normalizedQuery = searchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return normalizedBuildings.filter((building) =>
      building.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [normalizedBuildings, searchTerm])

  const resolvedBuildingId = buildingId ?? localBuildingId ?? ''

  const selectedBuilding = useMemo(
    () => normalizedBuildings.find((building) => building.id === resolvedBuildingId) || null,
    [normalizedBuildings, resolvedBuildingId]
  )

  const canPickBuilding = !resolvedBuildingId && normalizedBuildings.length > 0

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!selectedBuilding) {
      return
    }
    setSearchTerm(selectedBuilding.name)
  }, [selectedBuilding])

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadFile = useCallback(async (file: File, targetBuildingId?: string) => {
    setUploading(true)
    setError(null)
    setResult(null)
    setProgress([])
    setPercentage(0)
    setCurrentStep('Připravuji import...')
    
    try {
      if (!/\.xlsx?$/i.test(file.name)) {
        throw new Error('Podporované jsou pouze soubory XLS nebo XLSX')
      }

      setProgress(prev => [...prev, `📄 Načítám soubor: ${file.name}`])
      setCurrentStep('Nahrávám soubor na server...')

      const formData = new FormData()
      formData.append('file', file)
      if (targetBuildingId) {
        formData.append('buildingId', targetBuildingId)
      }
      formData.append('year', year.toString())

      setProgress(prev => [...prev, '📤 Odesílám data na server...'])
      setCurrentStep('Zpracovávám Excel soubor...')

      const response = await fetch('/api/import/complete', {
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
  }, [year, router])

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    if (!resolvedBuildingId) {
      setError('Vyberte prosím dům, pro který chcete import provést.')
      return
    }

    void uploadFile(files[0], resolvedBuildingId)
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
      
      {!resolvedBuildingId ? (
        canPickBuilding ? (
          <div className="mb-6 bg-gray-50 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Vyberte dům pro import</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Klikněte do pole níže, začněte psát název domu a rovnou jej vyberte – stejné chování jako v horním přepínači.
            </p>
            <div className="mt-4" ref={pickerRef}>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Vyberte dům
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    if (localBuildingId) {
                      setLocalBuildingId('')
                    }
                    setPickerOpen(true)
                  }}
                  onFocus={() => setPickerOpen(true)}
                  placeholder="Začněte psát název domu..."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  autoComplete="off"
                />
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>

                {pickerOpen && (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {filteredBuildings.length > 0 ? (
                      filteredBuildings.map((option) => {
                        const isActive = option.id === localBuildingId
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                              isActive
                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-slate-800'
                            }`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setLocalBuildingId(option.id)
                              setSearchTerm(option.name)
                              setPickerOpen(false)
                              setError(null)
                            }}
                          >
                            <span className="truncate">{option.name}</span>
                            {isActive && (
                              <svg className="h-4 w-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )
                      })
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">
                        Žádný dům neodpovídá hledanému výrazu.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Po výběru domu se zobrazí importní formulář níže.
            </p>
          </div>
        ) : (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-6 rounded-xl flex items-start gap-3">
            <div className="shrink-0 p-1 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg text-yellow-600 dark:text-yellow-400">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">Není k dispozici žádný dům</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Nejdříve prosím vytvořte alespoň jeden dům. Poté jej budete moct vybrat přímo zde a spustit import.
              </p>
              <div className="mt-4">
                <Link href="/buildings" className="inline-flex items-center px-4 py-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors">
                  Přejít na seznam domů &rarr;
                </Link>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          {selectedBuilding && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900/40 dark:bg-teal-900/10 dark:text-teal-200">
              <span className="font-semibold uppercase tracking-wide text-xs text-teal-700 dark:text-teal-200">Vybraný dům:</span>
              <span className="text-base font-bold text-gray-900 dark:text-white">{selectedBuilding.name}</span>
            </div>
          )}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Rok vyúčtování
            </label>
            <div className="text-lg font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-900 px-4 py-2 rounded-xl inline-block border border-gray-200 dark:border-slate-700">
              {year}
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
              accept=".xlsx,.xls"
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
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 font-mono bg-gray-100 dark:bg-slate-900 inline-block px-2 py-1 rounded">Podporované formáty: .xlsx, .xls</p>
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
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Dům</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white truncate" title={result.summary.building.name}>
                      {result.summary.building.name}
                    </p>
                    {result.summary.building.created && <span className="inline-block mt-1 text-[10px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">NOVÝ</span>}
                  </div>
                  
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

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Náklady (faktury)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.costs.total}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Odečty</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.readings.total}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Platby</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.payments.total}</p>
                  </div>

                  {result.summary.advances && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-100 dark:border-teal-800/50 col-span-2 md:col-span-3">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Předpis záloh</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.summary.advances.total}</p>
                        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                          ({result.summary.advances.created} nových, {result.summary.advances.updated} upraveno)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <a
                    href={`/buildings/${result.summary.building.id}`}
                    className="inline-flex items-center px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Zobrazit detail domu &rarr;
                  </a>
                </div>
              </div>

              {result.summary.warnings.length > 0 && (
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

              {result.summary.errors.length > 0 && (
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
        </>
      )}
    </div>
  )
}
