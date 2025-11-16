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
  errors: string[]
  warnings: string[]
}

interface ImportResult {
  message: string
  summary: ImportSummary
}

interface CompleteImportProps {
  year?: number
}

export default function CompleteImport({ year = new Date().getFullYear() }: CompleteImportProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [buildingName, setBuildingName] = useState('')
  const [progress, setProgress] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState('')

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
    setCurrentStep('Připravuji import...')
    
    try {
      if (!/\.xlsx?$/i.test(file.name)) {
        throw new Error('Podporované jsou pouze soubory XLS nebo XLSX')
      }

      setProgress(prev => [...prev, `📄 Načítám soubor: ${file.name}`])
      setCurrentStep('Nahrávám soubor na server...')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('buildingName', buildingName)
      formData.append('year', year.toString())

      setProgress(prev => [...prev, '📤 Odesílám data na server...'])
      setCurrentStep('Zpracovávám Excel soubor...')

      const response = await fetch('/api/import/complete', {
        method: 'POST',
        body: formData,
      })

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

      // Zpracovat summary a zobrazit kroky
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

      setCurrentStep('✅ Import dokončen!')
      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import se nezdařil')
      setCurrentStep('❌ Import selhal')
    } finally {
      setUploading(false)
      resetInput()
    }
  }, [buildingName, year, router])

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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Nahrát kompletní vyúčtování</h2>
      
      <div className="mb-6">
        <label htmlFor="buildingName" className="block text-sm font-medium text-gray-900 mb-2">
          Název domu (volitelné)
        </label>
        <input
          type="text"
          id="buildingName"
          value={buildingName}
          onChange={(e) => setBuildingName(e.target.value)}
          placeholder="Např. Bytový dům č.p. 318, Brno"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
        />
        <p className="mt-1 text-sm text-gray-900">
          Pokud dům s tímto názvem už existuje, použije se. Jinak se vytvoří nový. Pokud necháte prázdné, vytvoří se &quot;Importovaná budova&quot;.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Rok vyúčtování: <strong>{year}</strong>
        </label>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors">
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
          className={`block ${uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${dragActive ? 'text-blue-600' : ''}`}
        >
          <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
            {uploading ? (
              <svg className="animate-spin h-16 w-16 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            {uploading ? currentStep : 'Klikněte pro výběr souboru'}
          </p>
          <p className="text-sm text-gray-900">
            {uploading ? 'Prosím čekejte...' : 'nebo přetáhněte soubor sem'}
          </p>
          <p className="text-xs text-gray-900 mt-2">Podporované formáty: .xlsx, .xls</p>
        </label>
      </div>

      {/* Průběh importu */}
      {uploading && progress.length > 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Průběh importu</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {progress.map((step, index) => (
              <div key={index} className="text-sm text-blue-800 flex items-start">
                <span className="mr-2">•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Souhrn importu</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-blue-700">Dům</p>
                <p className="text-lg font-semibold text-blue-900">
                  {result.summary.building.name}
                  {result.summary.building.created && <span className="ml-2 text-xs text-blue-600">(nový)</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Jednotky</p>
                <p className="text-lg font-semibold text-blue-900">
                  {result.summary.units.total}
                  <span className="ml-2 text-xs text-blue-600">
                    (+{result.summary.units.created} nových)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Služby</p>
                <p className="text-lg font-semibold text-blue-900">
                  {result.summary.services.total}
                  <span className="ml-2 text-xs text-blue-600">
                    (+{result.summary.services.created} nových)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Náklady (faktury)</p>
                <p className="text-lg font-semibold text-blue-900">{result.summary.costs.total}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Odečty</p>
                <p className="text-lg font-semibold text-blue-900">{result.summary.readings.total}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Platby</p>
                <p className="text-lg font-semibold text-blue-900">{result.summary.payments.total}</p>
              </div>
            </div>
            <div className="mt-4">
              <a
                href={`/buildings/${result.summary.building.id}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Zobrazit detail domu
              </a>
            </div>
          </div>

          {result.summary.warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Upozornění</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <ul className="text-sm text-yellow-800 space-y-1">
                  {result.summary.warnings.map((warn, index) => (
                    <li key={index}>⚠️ {warn}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.summary.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Chyby při importu</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-800 space-y-1">
                  {result.summary.errors.map((err, index) => (
                    <li key={index}>❌ {err}</li>
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
