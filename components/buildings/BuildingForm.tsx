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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
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
          <div className="space-y-2">
            <label htmlFor="name" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Název domu *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="např. Společenství vlastníků pro dům Neptun"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ico" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              IČO
            </label>
            <input
              type="text"
              id="ico"
              name="ico"
              value={formData.ico}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="12345678"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Adresa *
            </label>
            <input
              type="text"
              id="address"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="Neptunova 123"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="city" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Město *
            </label>
            <input
              type="text"
              id="city"
              name="city"
              required
              value={formData.city}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="Praha"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="zip" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              PSČ *
            </label>
            <input
              type="text"
              id="zip"
              name="zip"
              required
              value={formData.zip}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="11000"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bankAccount" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Číslo účtu
            </label>
            <input
              type="text"
              id="bankAccount"
              name="bankAccount"
              value={formData.bankAccount}
              onChange={handleChange}
              className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="123456789/0100"
            />
          </div>
        </div>
      </div>

      <div className="px-8 py-6 bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-4 rounded-b-2xl">
        <Link
          href={building ? `/buildings/${building.id}` : '/buildings'}
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
              {building ? 'Uložit změny' : 'Vytvořit dům'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
