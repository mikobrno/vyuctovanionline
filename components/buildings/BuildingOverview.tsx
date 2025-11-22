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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            🏢 Přehled a nastavení domu
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Globální parametry budovy používané pro výpočty a reporty.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Základní informace */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Název domu
              </label>
              <input
                type="text"
                disabled
                value={building.name}
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm text-gray-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Adresa
              </label>
              <input
                type="text"
                disabled
                value={`${building.address}, ${building.city}`}
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm text-gray-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">
              ⚙️ Parametry pro výpočty
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="totalArea" className="block text-sm font-medium text-gray-700">
                  Užitná plocha domu - celková (m²)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="totalArea"
                    id="totalArea"
                    step="0.01"
                    defaultValue={building.totalArea ?? ''}
                    className="focus:ring-primary focus:border-primary block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">m²</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Používá se pro kontrolní výpočty a statistiky.
                </p>
              </div>

              <div>
                <label htmlFor="chargeableArea" className="block text-sm font-medium text-gray-700">
                  Užitná plocha domu - započitatelná (m²)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="chargeableArea"
                    id="chargeableArea"
                    step="0.01"
                    defaultValue={building.chargeableArea ?? ''}
                    className="focus:ring-primary focus:border-primary block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">m²</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Může být použita jako základna pro rozúčtování některých služeb.
                </p>
              </div>

              <div>
                <label htmlFor="unitCountOverride" className="block text-sm font-medium text-gray-700">
                  Počet jednotek (pro výpočet)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    name="unitCountOverride"
                    id="unitCountOverride"
                    defaultValue={building.unitCountOverride ?? ''}
                    className="focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder={building.units.length.toString()}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Pokud není vyplněno, použije se skutečný počet jednotek v databázi ({building.units.length}).
                </p>
              </div>

              <div>
                <label htmlFor="totalPeople" className="block text-sm font-medium text-gray-700">
                  Počet osob (celkem/výtah)
                </label>
                <input
                  type="number"
                  name="totalPeople"
                  id="totalPeople"
                  defaultValue={building.totalPeople ?? ''}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="chimneysCount" className="block text-sm font-medium text-gray-700">
                  Počet komínů
                </label>
                <input
                  type="number"
                  name="chimneysCount"
                  id="chimneysCount"
                  defaultValue={building.chimneysCount ?? ''}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">
              🏦 Bankovní spojení a správa
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700">
                  Číslo účtu společenství
                </label>
                <input
                  type="text"
                  name="bankAccount"
                  id="bankAccount"
                  defaultValue={building.bankAccount ?? ''}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="123456789/0100"
                />
              </div>

              <div>
                <label htmlFor="managerName" className="block text-sm font-medium text-gray-700">
                  Správce nemovitosti
                </label>
                <input
                  type="text"
                  name="managerName"
                  id="managerName"
                  defaultValue={building.managerName ?? ''}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Akce */}
          <div className="pt-4 flex items-center justify-end gap-4">
            {error && (
              <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                {error}
              </span>
            )}
            {success && (
              <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded animate-fade-in">
                ✅ Uloženo
              </span>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? 'Ukládám...' : 'Uložit změny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
