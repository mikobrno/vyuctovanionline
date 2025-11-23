import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type MeterType = 'HOT_WATER' | 'COLD_WATER' | 'HEATING' | 'ELECTRICITY'

const METER_TYPE_LABELS: Record<MeterType, { label: string; icon: string }> = {
  HOT_WATER: { label: 'Teplá voda (TUV)', icon: '🚿' },
  COLD_WATER: { label: 'Studená voda (SV)', icon: '💧' },
  HEATING: { label: 'Teplo', icon: '🔥' },
  ELECTRICITY: { label: 'Elektřina', icon: '⚡' }
}

export default async function ReadingsPage() {
  const currentYear = new Date().getFullYear()

  // Načíst všechny budovy
  const buildings = await prisma.building.findMany({
    orderBy: { name: 'asc' }
  })

  // Pro každou budovu načíst jednotky s měřidly a odečty
  const buildingsWithReadings = await Promise.all(
    buildings.map(async (building) => {
      const units = await prisma.unit.findMany({
        where: { buildingId: building.id },
        include: {
          meters: {
            where: { isActive: true },
            include: {
              readings: {
                where: { period: currentYear },
                orderBy: { readingDate: 'desc' },
                take: 1
              }
            },
            orderBy: { type: 'asc' }
          },
          ownerships: {
            where: {
              OR: [
                { validTo: null },
                { validTo: { gte: new Date() } }
              ]
            },
            include: {
              owner: true
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      })

      return { building, units }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📊 Přehled odečtů měřidel</h1>
          <p className="mt-2 text-gray-900 dark:text-gray-400">
            Zadání a správa odečtů energií pro všechny jednotky (rok {currentYear})
          </p>
        </div>

        {buildingsWithReadings.map(({ building, units }) => (
          <div key={building.id} className="bg-white dark:bg-slate-800 rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                🏢 {building.name}
              </h2>
              <p className="text-sm text-gray-900 dark:text-gray-400">{building.address}, {building.city}</p>
            </div>

            {/* Rozdělení podle typu měřidla */}
            {(['HOT_WATER', 'COLD_WATER', 'HEATING', 'ELECTRICITY'] as MeterType[]).map((meterType) => {
              const unitsWithMeterType = units.filter((unit) =>
                unit.meters.some((meter) => meter.type === meterType)
              )

              if (unitsWithMeterType.length === 0) return null

              return (
                <div key={meterType} className="p-6 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {METER_TYPE_LABELS[meterType].icon} {METER_TYPE_LABELS[meterType].label}
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">
                            Jednotka
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">
                            Vlastník
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">
                            Číslo měřidla
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                            Počáteční stav
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                            Konečný stav
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                            Spotřeba
                          </th>
                          <th className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">
                            Datum odečtu
                          </th>
                          <th className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {unitsWithMeterType.map((unit) => {
                          const meters = unit.meters.filter((m) => m.type === meterType)
                          const currentOwner = unit.ownerships[0]?.owner

                          return meters.map((meter) => {
                            const latestReading = meter.readings[0]

                            return (
                              <tr key={meter.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                  <Link
                                    href={`/units/${unit.id}`}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  >
                                    {unit.unitNumber}
                                  </Link>
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-300">
                                  {currentOwner
                                    ? `${currentOwner.firstName} ${currentOwner.lastName}`
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-300">
                                  {meter.serialNumber}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-gray-300">
                                  {meter.initialReading.toLocaleString('cs-CZ', {
                                    minimumFractionDigits: 2
                                  })}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-gray-300 font-medium">
                                  {latestReading
                                    ? latestReading.value.toLocaleString('cs-CZ', {
                                        minimumFractionDigits: 2
                                      })
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                                  {latestReading?.consumption
                                    ? latestReading.consumption.toLocaleString('cs-CZ', {
                                        minimumFractionDigits: 2
                                      })
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-900 dark:text-gray-300">
                                  {latestReading
                                    ? new Date(latestReading.readingDate).toLocaleDateString(
                                        'cs-CZ'
                                      )
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {latestReading ? (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      ✓ Odečteno
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                      ⚠ Chybí odečet
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700">
              <Link
                href={`/buildings/${building.id}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
              >
                → Přejít na detail budovy a import odečtů
              </Link>
            </div>
          </div>
        ))}

        {buildingsWithReadings.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-900 dark:text-white">Zatím nejsou evidovány žádné budovy.</p>
            <Link
              href="/buildings/new"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Přidat první budovu
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
