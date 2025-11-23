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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Základní údaje</h2>
      </div>

      <div className="px-6 py-4 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="buildingId" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Bytový dům *
            </label>
            <select
              id="buildingId"
              name="buildingId"
              required
              value={formData.buildingId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
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
            <label htmlFor="unitNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Číslo jednotky *
            </label>
            <input
              type="text"
              id="unitNumber"
              name="unitNumber"
              required
              value={formData.unitNumber}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="např. 318/01"
            />
          </div>

          <div>
            <label htmlFor="variableSymbol" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Variabilní symbol *
            </label>
            <input
              type="text"
              id="variableSymbol"
              name="variableSymbol"
              required
              value={formData.variableSymbol}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="např. 31801"
            />
          </div>

          <div>
            <label htmlFor="totalArea" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Celková výměra (m²) *
            </label>
            <input
              type="number"
              id="totalArea"
              name="totalArea"
              required
              step="0.1"
              min="0"
              value={formData.totalArea}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="65.5"
            />
          </div>

          <div>
            <label htmlFor="floorArea" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Podlahová plocha (m²)
            </label>
            <input
              type="number"
              id="floorArea"
              name="floorArea"
              step="0.1"
              min="0"
              value={formData.floorArea}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="55.0"
            />
          </div>

          <div>
            <label htmlFor="shareNumerator" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="764"
            />
          </div>

          <div>
            <label htmlFor="shareDenominator" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="14238"
            />
          </div>

          <div>
            <label htmlFor="residents" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Počet obyvatel
            </label>
            <input
              type="number"
              id="residents"
              name="residents"
              min="0"
              value={formData.residents}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="2"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-4">
        <Link
          href={unit ? `/units/${unit.id}` : '/units'}
          className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          Zrušit
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Ukládám...' : unit ? 'Uložit změny' : 'Vytvořit jednotku'}
        </button>
      </div>
    </form>
  )
}
