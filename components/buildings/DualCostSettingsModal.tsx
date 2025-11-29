'use client'

import { useState, useEffect, useCallback } from 'react'

interface UnitSetting {
  unitId: string
  unitNumber: string
  hasMeter: boolean
}

interface DualCostSettingsModalProps {
  serviceId: string
  serviceName: string
  year: number
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function DualCostSettingsModal({
  serviceId,
  serviceName,
  year,
  isOpen,
  onClose,
  onSave
}: DualCostSettingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Nastavení
  const [useDualCost, setUseDualCost] = useState(false)
  const [costWithMeter, setCostWithMeter] = useState<string>('')
  const [costWithoutMeter, setCostWithoutMeter] = useState<string>('')
  const [guidanceNumber, setGuidanceNumber] = useState<string>('35')
  const [unitSettings, setUnitSettings] = useState<UnitSetting[]>([])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/services/${serviceId}/dual-cost?year=${year}`)
      if (!response.ok) throw new Error('Nepodařilo se načíst nastavení')
      
      const data = await response.json()
      setUseDualCost(data.useDualCost || false)
      setCostWithMeter(data.costWithMeter?.toString() || '')
      setCostWithoutMeter(data.costWithoutMeter?.toString() || '')
      setGuidanceNumber(data.guidanceNumber?.toString() || '35')
      setUnitSettings(data.unitSettings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setLoading(false)
    }
  }, [serviceId, year])

  // Načtení nastavení při otevření modalu
  useEffect(() => {
    if (isOpen && serviceId) {
      loadSettings()
    }
  }, [isOpen, serviceId, loadSettings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/services/${serviceId}/dual-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          useDualCost,
          costWithMeter: costWithMeter ? parseFloat(costWithMeter) : null,
          costWithoutMeter: costWithoutMeter ? parseFloat(costWithoutMeter) : null,
          guidanceNumber: guidanceNumber ? parseFloat(guidanceNumber) : 35,
          unitSettings
        })
      })
      
      if (!response.ok) throw new Error('Nepodařilo se uložit nastavení')
      
      // Zobrazit úspěšnou zprávu
      setSuccessMessage('✅ Nastavení bylo úspěšně uloženo!')
      setTimeout(() => {
        setSuccessMessage(null)
        onSave()
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setSaving(false)
    }
  }

  const toggleUnitMeter = (unitId: string) => {
    setUnitSettings(prev => prev.map(u => 
      u.unitId === unitId ? { ...u, hasMeter: !u.hasMeter } : u
    ))
  }

  const setAllMeters = (hasMeter: boolean) => {
    setUnitSettings(prev => prev.map(u => ({ ...u, hasMeter })))
  }

  // Statistiky
  const unitsWithMeter = unitSettings.filter(u => u.hasMeter).length
  const unitsWithoutMeter = unitSettings.filter(u => !u.hasMeter).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">⚙️ Nastavení duálních nákladů</h2>
              <p className="text-blue-100 text-sm mt-1">{serviceName} • <span className="font-semibold">Rok {year}</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              title="Zavřít"
              aria-label="Zavřít modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : successMessage ? (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-green-700 dark:text-green-300 font-medium text-lg">{successMessage}</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Aktivace duálních nákladů */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <input
                  type="checkbox"
                  id="useDualCost"
                  checked={useDualCost}
                  onChange={(e) => setUseDualCost(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useDualCost" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                  Použít duální náklady (s vodoměrem / směrné číslo)
                </label>
              </div>

              {useDualCost && (
                <>
                  {/* Náklady */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                        💧 Náklad A - S vodoměrem
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={costWithMeter}
                          onChange={(e) => setCostWithMeter(e.target.value)}
                          placeholder="13181.67"
                          className="w-full px-4 py-2 pr-12 border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">Kč</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Pro {unitsWithMeter} jednotek s měřidlem
                      </p>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                        📊 Náklad B - Směrné číslo
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={costWithoutMeter}
                          onChange={(e) => setCostWithoutMeter(e.target.value)}
                          placeholder="75347.33"
                          className="w-full px-4 py-2 pr-12 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">Kč</span>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Pro {unitsWithoutMeter} jednotek bez měřidla
                      </p>
                    </div>
                  </div>

                  {/* Směrné číslo */}
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <label htmlFor="guidanceNumber" className="block text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                      📐 Směrné číslo
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="guidanceNumber"
                        type="number"
                        value={guidanceNumber}
                        onChange={(e) => setGuidanceNumber(e.target.value)}
                        className="w-32 px-4 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                        placeholder="35"
                        aria-label="Směrné číslo v m³ na osobu za rok"
                      />
                      <span className="text-purple-600 dark:text-purple-400">m³/osoba/rok</span>
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                      Vzorec: osobo_měsíce ÷ 12 × {guidanceNumber || 35} m³
                    </p>
                  </div>

                  {/* Seznam jednotek */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        📋 Nastavení jednotek
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAllMeters(true)}
                          className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          Vše s vodoměrem
                        </button>
                        <button
                          onClick={() => setAllMeters(false)}
                          className="text-xs px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                        >
                          Vše směrné číslo
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Jednotka</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Má vodoměr</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Rozúčtování</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                          {unitSettings.map((unit) => (
                            <tr key={unit.unitId} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                {unit.unitNumber}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleUnitMeter(unit.unitId)}
                                  className={`
                                    relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer 
                                    rounded-full border-2 border-transparent 
                                    transition-colors duration-300 ease-in-out
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    ${unit.hasMeter 
                                      ? 'bg-green-500 hover:bg-green-600' 
                                      : 'bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
                                    }
                                  `}
                                  role="switch"
                                  aria-checked={unit.hasMeter}
                                  title={unit.hasMeter ? 'Má vodoměr - kliknutím změníte' : 'Bez vodoměru - kliknutím změníte'}
                                  aria-label={`Jednotka ${unit.unitNumber}: ${unit.hasMeter ? 'má vodoměr' : 'bez vodoměru'}`}
                                >
                                  <span 
                                    className="pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out"
                                    style={{ transform: unit.hasMeter ? 'translateX(28px)' : 'translateX(0px)' }}
                                  />
                                </button>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  unit.hasMeter
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {unit.hasMeter ? '💧 Měřidlo' : '📊 Směrné číslo'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Kontrolní součet */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-700 dark:text-blue-300">Celkem náklad:</span>
                      <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        {((parseFloat(costWithMeter) || 0) + (parseFloat(costWithoutMeter) || 0)).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Ukládám...
              </>
            ) : (
              <>✓ Uložit nastavení</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
