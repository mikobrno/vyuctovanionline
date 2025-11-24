'use client'

import { useState, useEffect } from 'react'

interface ServiceControl {
  id: string
  name: string
  methodology: string
  totalCost: number
  buildingUnits: number
  pricePerUnit: number
  measurementUnit?: string
}

interface BillingControlPanelProps {
  buildingId: string
  year: number
}

const METHODOLOGY_NAMES: Record<string, string> = {
  'OWNERSHIP_SHARE': 'Dle vlastnického podílu',
  'AREA': 'Dle podlahové plochy (m²)',
  'PERSON_MONTHS': 'Dle počtu osob (osobo-měsíců)',
  'METER_READING': 'Dle odečtu měřidel',
  'FIXED_PER_UNIT': 'Dle počtu jednotek (bytů)',
  'EQUAL_SPLIT': 'Rovným dílem',
  'NO_BILLING': 'Nevyúčtovávat (převod na účet)',
  'CUSTOM': 'Vlastní vzorec'
}

const UNIT_NAMES: Record<string, string> = {
  'OWNERSHIP_SHARE': '%',
  'AREA': 'm²',
  'PERSON_MONTHS': 'os-měs',
  'METER_READING': 'jedn',
  'FIXED_PER_UNIT': 'bytů',
  'EQUAL_SPLIT': 'bytů',
  'NO_BILLING': '-',
  'CUSTOM': '-'
}

export default function BillingControlPanel({ buildingId, year }: BillingControlPanelProps) {
  const [services, setServices] = useState<ServiceControl[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadControlData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, year])

  const loadControlData = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/control?year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.services)
      }
    } catch (error) {
      console.error('Chyba při načítání kontrolního panelu:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded mb-4"></div>
        <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">
          📊 Kontrolní panel vyúčtování - Přehled služeb (obdobně jako list &quot;Faktury&quot;)
        </h3>
        <p className="text-sm text-teal-100 mt-1">
          Zobrazuje způsob rozúčtování každé služby a kontrolní údaje
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Služba
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Způsob rozúčtování
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Náklad za rok
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Jednotek (dům)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Kč/jedn (dům)
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Akce
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {services.map((service) => {
              const unitName = service.measurementUnit || UNIT_NAMES[service.methodology] || 'jedn'
              const isNoBilling = service.methodology === 'NO_BILLING'
              
              return (
                <tr key={service.id} className={isNoBilling ? 'bg-gray-50 dark:bg-slate-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 dark:text-slate-400">
                      {METHODOLOGY_NAMES[service.methodology] || service.methodology}
                    </div>
                    {isNoBilling && (
                      <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                        Tato položka se nepřenáší do vyúčtování
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {service.totalCost.toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} Kč
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {isNoBilling ? (
                      <span className="text-sm text-gray-400 dark:text-slate-600">-</span>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-slate-400">
                        {service.buildingUnits.toLocaleString('cs-CZ', {
                          minimumFractionDigits: service.methodology === 'METER_READING' ? 3 : 0,
                          maximumFractionDigits: service.methodology === 'METER_READING' ? 3 : 2
                        })} {unitName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {isNoBilling ? (
                      <span className="text-sm text-gray-400 dark:text-slate-600">-</span>
                    ) : (
                      <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                        {service.pricePerUnit.toLocaleString('cs-CZ', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} Kč/{unitName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <a
                      href={`/buildings/${buildingId}/services/${service.id}/edit`}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium"
                    >
                      ⚙️ Nastavit
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-100 dark:bg-slate-900">
            <tr>
              <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                Celkem nákladů za rok:
              </td>
              <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                {services
                  .reduce((sum, s) => sum + s.totalCost, 0)
                  .toLocaleString('cs-CZ', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })} Kč
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-teal-50 dark:bg-teal-900/20 px-6 py-4 border-t border-teal-100 dark:border-teal-800">
        <div className="flex items-start gap-3">
          <div className="text-teal-600 dark:text-teal-400 text-xl">💡</div>
          <div className="text-sm text-teal-800 dark:text-teal-200">
            <p className="font-medium mb-1">Jak to funguje:</p>
            <ul className="list-disc list-inside space-y-1 text-teal-700 dark:text-teal-300">
              <li><strong>Jednotek (dům)</strong> = Celkový počet dílů, na které se náklad dělí (např. součet m³, počet bytů, součet podílů)</li>
              <li><strong>Kč/jedn (dům)</strong> = Náklad za rok ÷ Jednotek = Cena za jeden díl</li>
              <li>Pro každý byt se pak jeho náklad vypočítá: <strong>Kč/jedn × Počet dílů bytu</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
