'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Cost = {
  id: string
  amount: number
  description: string
  invoiceDate: Date
  invoiceNumber: string | null
  period: number
  service: {
    name: string
    code: string
  }
  building: {
    name: string
  }
}

type Building = {
  id: string
  name: string
}

type Props = {
  initialCosts: Cost[]
  buildings: Building[]
  currentYear: number
}

export default function ExpensesClient({ initialCosts, buildings, currentYear }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [services, setServices] = useState<Array<{id: string, name: string}>>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    buildingId: buildings[0]?.id || '',
    serviceId: '',
    amount: '',
    description: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    period: currentYear.toString(),
  })

  const loadServices = async (buildingId: string) => {
    try {
      const res = await fetch(`/api/buildings/${buildingId}`)
      const data = await res.json()
      setServices(data.services || [])
      if (data.services && data.services.length > 0) {
        setFormData(prev => ({ ...prev, serviceId: data.services[0].id }))
      }
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const handleBuildingChange = (buildingId: string) => {
    setFormData({ ...formData, buildingId })
    loadServices(buildingId)
  }

  const handleShowForm = () => {
    setShowForm(true)
    if (buildings.length > 0 && !formData.buildingId) {
      setFormData(prev => ({ ...prev, buildingId: buildings[0].id }))
      loadServices(buildings[0].id)
    } else if (formData.buildingId && services.length === 0) {
      loadServices(formData.buildingId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowForm(false)
        setFormData({
          buildingId: formData.buildingId,
          serviceId: formData.serviceId,
          amount: '',
          description: '',
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          period: currentYear.toString(),
        })
        router.refresh()
      } else {
        alert('Chyba při ukládání nákladu')
      }
    } catch (error) {
      console.error('Error creating cost:', error)
      alert('Chyba při ukládání nákladu')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tento náklad?')) return
    try {
      const res = await fetch(`/api/costs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting cost:', error)
    }
  }

  return (
    <>
      <div className="mb-6">
        <button
          onClick={handleShowForm}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700"
        >
          + Přidat náklad
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nový náklad</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Dům</label>
              <select
                value={formData.buildingId}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Služba</label>
              <select
                value={formData.serviceId}
                onChange={(e) => setFormData({...formData, serviceId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                {services.length === 0 && <option value="">Načítání...</option>}
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Částka (Kč)</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Datum faktury</label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Číslo faktury</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Např. 2024001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Období (rok)</label>
              <input
                type="number"
                value={formData.period}
                onChange={(e) => setFormData({...formData, period: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-1">Popis</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={2}
                placeholder="Např. Teplo - roční vyúčtování"
                required
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? 'Ukládání...' : 'Uložit'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50"
              >
                Zrušit
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dům</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Služba</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Popis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Částka</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faktura</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akce</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {initialCosts.map((cost) => (
              <tr key={cost.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{cost.building.name}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{cost.service.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{cost.description}</td>
                <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                  {cost.amount.toLocaleString('cs-CZ')} Kč
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(cost.invoiceDate).toLocaleDateString('cs-CZ')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {cost.invoiceNumber || '-'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => handleDelete(cost.id)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
            {initialCosts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-1">Zatím nejsou zadány žádné náklady</p>
                    <p className="text-sm text-gray-500">Začněte přidáním první faktury za služby</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {initialCosts.length > 0 && (
        <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-teal-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-teal-800">
              <p className="font-medium">Celkem {initialCosts.length} nákladů pro rok {currentYear}</p>
              <p className="mt-1">
                Celková částka: <strong>
                  {initialCosts.reduce((sum, cost) => sum + cost.amount, 0).toLocaleString('cs-CZ')} Kč
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
