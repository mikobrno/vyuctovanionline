import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const currentYear = new Date().getFullYear()

  // Načíst všechny budovy
  const buildings = await prisma.building.findMany({
    orderBy: { name: 'asc' }
  })

  // Pro každou budovu načíst jednotky a platby
  const buildingsWithPayments = await Promise.all(
    buildings.map(async (building) => {
      const units = await prisma.unit.findMany({
        where: { buildingId: building.id },
        include: {
          payments: {
            where: { period: currentYear },
            orderBy: { paymentDate: 'asc' }
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">💳 Přehled úhrad záloh</h1>
          <p className="mt-2 text-gray-900">
            Matice zobrazující zaplacené zálohy podle jednotek a měsíců (rok {currentYear})
          </p>
        </div>

        {buildingsWithPayments.map(({ building, units }) => (
          <div key={building.id} className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                🏢 {building.name}
              </h2>
              <p className="text-sm text-gray-900">{building.address}, {building.city}</p>
            </div>

            <div className="p-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium text-gray-900 sticky left-0 bg-gray-50">
                      Jednotka
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-900">
                      Vlastník
                    </th>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i} className="px-3 py-2 text-right font-medium text-gray-900 min-w-20">
                        {new Date(currentYear, i, 1).toLocaleDateString('cs-CZ', { month: 'short' })}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right font-medium text-gray-900 bg-gray-100 sticky right-0">
                      Celkem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {units.map((unit) => {
                    // Seskupit platby podle měsíců
                    const paymentsByMonth: Record<number, number> = {}
                    let total = 0

                    unit.payments.forEach((payment) => {
                      const month = new Date(payment.paymentDate).getMonth() + 1
                      paymentsByMonth[month] = (paymentsByMonth[month] || 0) + payment.amount
                      total += payment.amount
                    })

                    const currentOwner = unit.ownerships[0]?.owner

                    return (
                      <tr key={unit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                          <Link
                            href={`/units/${unit.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {unit.unitNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {currentOwner ? `${currentOwner.firstName} ${currentOwner.lastName}` : '-'}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = i + 1
                          const amount = paymentsByMonth[month]
                          return (
                            <td
                              key={i}
                              className={`px-3 py-2 text-right font-mono text-sm ${
                                amount
                                  ? 'text-green-700 bg-green-50'
                                  : 'text-gray-400'
                              }`}
                            >
                              {amount
                                ? amount.toLocaleString('cs-CZ', { minimumFractionDigits: 0 })
                                : '-'}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right font-semibold font-mono bg-gray-50 sticky right-0">
                          {total.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-gray-900">
                      Celkem za budovu
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1
                      const monthTotal = units.reduce((sum, unit) => {
                        const monthPayments = unit.payments
                          .filter((p) => new Date(p.paymentDate).getMonth() + 1 === month)
                          .reduce((s, p) => s + p.amount, 0)
                        return sum + monthPayments
                      }, 0)

                      return (
                        <td key={i} className="px-3 py-3 text-right font-mono">
                          {monthTotal > 0
                            ? monthTotal.toLocaleString('cs-CZ', { minimumFractionDigits: 0 })
                            : '-'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right font-mono sticky right-0 bg-gray-100">
                      {units
                        .reduce((sum, unit) => {
                          return sum + unit.payments.reduce((s, p) => s + p.amount, 0)
                        }, 0)
                        .toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}{' '}
                      Kč
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Link
                href={`/buildings/${building.id}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                → Přejít na detail budovy a import plateb
              </Link>
            </div>
          </div>
        ))}

        {buildingsWithPayments.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-900">Zatím nejsou evidovány žádné budovy.</p>
            <Link
              href="/buildings/new"
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 font-medium"
            >
              Přidat první budovu
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
