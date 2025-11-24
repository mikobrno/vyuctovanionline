'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BuildingOverviewProps {
  building: any
}

export default function BuildingOverview({ building }: BuildingOverviewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const data = {
      totalArea: formData.get('totalArea') ? parseFloat(formData.get('totalArea') as string) : null,
      chargeableArea: formData.get('chargeableArea') ? parseFloat(formData.get('chargeableArea') as string) : null,
      chimneysCount: formData.get('chimneysCount') ? parseInt(formData.get('chimneysCount') as string) : null,
      totalPeople: formData.get('totalPeople') ? parseInt(formData.get('totalPeople') as string) : null,
      unitCountOverride: formData.get('unitCountOverride') ? parseInt(formData.get('unitCountOverride') as string) : null,
      bankAccount: formData.get('bankAccount') as string,
      managerName: formData.get('managerName') as string,
    }

    try {
      const res = await fetch(`/api/buildings/${building.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        throw new Error('Nepodařilo se uložit změny')
      }

      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{building.name}</h1>
            <div className="flex items-center gap-2 text-blue-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-lg">{building.address}, {building.city}</span>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
            <div className="text-xs uppercase tracking-wider font-semibold text-blue-100 mb-1">Počet jednotek</div>
            <div className="text-3xl font-bold">{building.units.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Areas */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plochy domu</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="totalArea" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Celková plocha
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="totalArea"
                    id="totalArea"
                    step="0.01"
                    defaultValue={building.totalArea ?? ''}
                    className="block w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 font-medium">m²</span>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="chargeableArea" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Započitatelná plocha
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="chargeableArea"
                    id="chargeableArea"
                    step="0.01"
                    defaultValue={building.chargeableArea ?? ''}
                    className="block w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 font-medium">m²</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: People & Units */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Osoby a jednotky</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="totalPeople" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Počet osob (celkem)
                </label>
                <input
                  type="number"
                  name="totalPeople"
                  id="totalPeople"
                  defaultValue={building.totalPeople ?? ''}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                />
              </div>

              <div>
                <label htmlFor="unitCountOverride" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Počet jednotek (override)
                </label>
                <input
                  type="number"
                  name="unitCountOverride"
                  id="unitCountOverride"
                  defaultValue={building.unitCountOverride ?? ''}
                  placeholder={building.units.length.toString()}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Nechte prázdné pro použití automatického počtu ({building.units.length}).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Technical & Admin */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Správa a technické</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="chimneysCount" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Počet komínů
                </label>
                <input
                  type="number"
                  name="chimneysCount"
                  id="chimneysCount"
                  defaultValue={building.chimneysCount ?? ''}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                />
              </div>

              <div>
                <label htmlFor="bankAccount" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Číslo účtu
                </label>
                <input
                  type="text"
                  name="bankAccount"
                  id="bankAccount"
                  defaultValue={building.bankAccount ?? ''}
                  placeholder="123456789/0100"
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                />
              </div>

              <div>
                <label htmlFor="managerName" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Správce
                </label>
                <input
                  type="text"
                  name="managerName"
                  id="managerName"
                  defaultValue={building.managerName ?? ''}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-semibold transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-4 pt-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl animate-fade-in">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-medium">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl animate-fade-in">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            <span className="font-bold">Uloženo úspěšně</span>
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 disabled:opacity-50 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-3"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Ukládám...
            </>
          ) : (
            <>
              <span>Uložit změny</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
