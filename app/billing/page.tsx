import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import AppLayout from '@/components/layout/AppLayout'
import { prisma } from '@/lib/prisma'
import { BillingPeriod, BillingStatus } from '@prisma/client'

type BillingPeriodWithCount = BillingPeriod & {
  _count: {
    results: number
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  const buildingId = typeof resolvedSearchParams.buildingId === 'string' ? resolvedSearchParams.buildingId : null

  let billingPeriods: BillingPeriodWithCount[] = []
  let buildingName = ''

  if (buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true }
    })
    if (building) {
      buildingName = building.name
      billingPeriods = await prisma.billingPeriod.findMany({
        where: { buildingId },
        orderBy: { year: 'desc' },
        include: {
          _count: {
            select: { results: true }
          }
        }
      })
    }
  }

  return (
    <AppLayout user={session.user}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Vyúčtování {buildingName ? `- ${buildingName}` : ''}
        </h1>
        <p className="mt-2 text-gray-500">
          Přehled vyúčtování pro vybraný dům
        </p>
      </div>

      {!buildingId ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Vyberte dům</h3>
          <p className="mt-2 text-gray-500">
            Pro zobrazení vyúčtování vyberte dům v horním menu.
          </p>
        </div>
      ) : billingPeriods.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">Žádná vyúčtování</h3>
          <p className="mt-2 text-gray-500">
            Pro tento dům zatím nebylo vytvořeno žádné vyúčtování.
          </p>
          <div className="mt-6">
             <Link href={`/billing/new?buildingId=${buildingId}`} className="text-teal-600 hover:text-teal-700 font-medium">
                + Vytvořit nové vyúčtování
             </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rok
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stav
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Počet jednotek
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vytvořeno
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Akce</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {billingPeriods.map((period) => (
                <tr key={period.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {period.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${period.status === BillingStatus.DRAFT ? 'bg-yellow-100 text-yellow-800' : 
                        period.status === BillingStatus.CALCULATED ? 'bg-blue-100 text-blue-800' : 
                        period.status === BillingStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {period.status === BillingStatus.DRAFT ? 'Návrh' :
                       period.status === BillingStatus.CALCULATED ? 'Vypočteno' :
                       period.status === BillingStatus.APPROVED ? 'Schváleno' : 
                       period.status === BillingStatus.SENT ? 'Odesláno' : period.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {period._count.results}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(period.createdAt).toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/buildings/${period.buildingId}/billing?year=${period.year}`} className="text-teal-600 hover:text-teal-900">
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
