'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Unit {
  id: string
  buildingId: string
  unitNumber: string
  variableSymbol: string | null
  totalArea: number
  floorArea: number | null
  shareNumerator: number
  shareDenominator: number
  residents: number | null
}

interface Building {
  id: string
  name: string
}

interface UnitFormProps {
  unit?: Unit
  buildings: Building[]
  preselectedBuildingId?: string
}

export default function UnitForm({ unit, buildings, preselectedBuildingId }: UnitFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    buildingId: unit?.buildingId || preselectedBuildingId || '',
    unitNumber: unit?.unitNumber || '',
    variableSymbol: unit?.variableSymbol || '',
    totalArea: unit?.totalArea.toString() || '',
    floorArea: unit?.floorArea?.toString() || '',
    shareNumerator: unit?.shareNumerator.toString() || '',
    shareDenominator: unit?.shareDenominator.toString() || '',
    residents: unit?.residents?.toString() || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = unit 
        ? `/api/units/${unit.id}`
        : '/api/units'
      
      const method = unit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingId: formData.buildingId,
          unitNumber: formData.unitNumber,
          variableSymbol: formData.variableSymbol,
          totalArea: parseFloat(formData.totalArea),
          floorArea: formData.floorArea ? parseFloat(formData.floorArea) : null,
          shareNumerator: parseInt(formData.shareNumerator),
          shareDenominator: parseInt(formData.shareDenominator),
          residents: formData.residents ? parseInt(formData.residents) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Chyba při ukládání')
      }

      const data = await response.json()
      router.push(`/units/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          Základní údaje
        </h2>
      </div>

      <div className="px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-2">
            <label htmlFor="buildingId" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Bytový dům *
            </label>
            <select
              id="buildingId"
              name="buildingId"
              required
              value={formData.buildingId}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
            >
              <option value="">Vyberte dům...</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="unitNumber" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Číslo jednotky *
            </label>
            <input
              type="text"
              id="unitNumber"
              name="unitNumber"
              required
              value={formData.unitNumber}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="např. 318/01"
            />
          </div>

          <div>
            <label htmlFor="variableSymbol" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Variabilní symbol *
            </label>
            <input
              type="text"
              id="variableSymbol"
              name="variableSymbol"
              required
              value={formData.variableSymbol}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="např. 31801"
            />
          </div>

          <div>
            <label htmlFor="totalArea" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Celková výměra (m²) *
            </label>
            <input
              type="number"
              id="totalArea"
              name="totalArea"
              required
              step="0.01"
              min="0"
              value={formData.totalArea}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="65.50"
            />
          </div>

          <div>
            <label htmlFor="floorArea" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Podlahová plocha (m²)
            </label>
            <input
              type="number"
              id="floorArea"
              name="floorArea"
              step="0.01"
              min="0"
              value={formData.floorArea}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="55.00"
            />
          </div>

          <div>
            <label htmlFor="shareNumerator" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Podíl - čitatel *
            </label>
            <input
              type="number"
              id="shareNumerator"
              name="shareNumerator"
              required
              min="1"
              value={formData.shareNumerator}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="764"
            />
          </div>

          <div>
            <label htmlFor="shareDenominator" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Podíl - jmenovatel *
            </label>
            <input
              type="number"
              id="shareDenominator"
              name="shareDenominator"
              required
              min="1"
              value={formData.shareDenominator}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="14238"
            />
          </div>

          <div>
            <label htmlFor="residents" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Počet obyvatel
            </label>
            <input
              type="number"
              id="residents"
              name="residents"
              min="0"
              value={formData.residents}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="2"
            />
          </div>
        </div>
      </div>

      <div className="px-8 py-6 bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-4 rounded-b-2xl">
        <Link
          href={unit ? `/units/${unit.id}` : '/units'}
          className="px-6 py-3 border border-gray-200 dark:border-slate-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
        >
          Zrušit
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Ukládám...
            </>
          ) : (
            <>
              {unit ? 'Uložit změny' : 'Vytvořit jednotku'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
