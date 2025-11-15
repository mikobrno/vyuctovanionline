'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Building {
  id: string
  name: string
  address: string
  city: string
  zip: string
  ico: string | null
  bankAccount: string | null
}

interface BuildingFormProps {
  building?: Building
}

export default function BuildingForm({ building }: BuildingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: building?.name || '',
    address: building?.address || '',
    city: building?.city || '',
    zip: building?.zip || '',
    ico: building?.ico || '',
    bankAccount: building?.bankAccount || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = building 
        ? `/api/buildings/${building.id}`
        : '/api/buildings'
      
      const method = building ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Chyba při ukládání')
      }

      const data = await response.json()
      router.push(`/buildings/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Základní údaje</h2>
      </div>

      <div className="px-6 py-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Název domu *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="např. Společenství vlastníků pro dům Neptun"
            />
          </div>

          <div>
            <label htmlFor="ico" className="block text-sm font-medium text-gray-700 mb-2">
              IČO
            </label>
            <input
              type="text"
              id="ico"
              name="ico"
              value={formData.ico}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="12345678"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Adresa *
            </label>
            <input
              type="text"
              id="address"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Neptunova 123"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
              Město *
            </label>
            <input
              type="text"
              id="city"
              name="city"
              required
              value={formData.city}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Praha"
            />
          </div>

          <div>
            <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
              PSČ *
            </label>
            <input
              type="text"
              id="zip"
              name="zip"
              required
              value={formData.zip}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="11000"
            />
          </div>

          <div>
            <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700 mb-2">
              Číslo účtu
            </label>
            <input
              type="text"
              id="bankAccount"
              name="bankAccount"
              value={formData.bankAccount}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123456789/0100"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-4">
        <Link
          href={building ? `/buildings/${building.id}` : '/buildings'}
          className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Zrušit
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Ukládám...' : building ? 'Uložit změny' : 'Vytvořit dům'}
        </button>
      </div>
    </form>
  )
}
