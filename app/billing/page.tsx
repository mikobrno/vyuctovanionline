import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import AppLayout from '@/components/layout/AppLayout'
import BillingPeriodActions from '@/components/billing/BillingPeriodActions'
import { prisma } from '@/lib/prisma'
import { BillingPeriod, BillingStatus } from '@prisma/client'

type BillingPeriodWithCount = BillingPeriod & {
  _count: {
    results: number
  }
  building: {
    name: string
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
          },
          building: {
            select: { name: true }
          }
        }
      })
    }
  } else {
    billingPeriods = await prisma.billingPeriod.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { results: true }
        },
        building: {
          select: { name: true }
        }
      }
    })
  }

  return (
    <AppLayout user={session.user}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Vyúčtování {buildingName ? `- ${buildingName}` : ''}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          {buildingId ? 'Přehled vyúčtování pro vybraný dům' : 'Přehled všech vyúčtování'}
        </p>
      </div>

      {billingPeriods.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Žádná vyúčtování</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {buildingId 
              ? 'Pro tento dům zatím nebylo vytvořeno žádné vyúčtování.' 
              : 'V systému zatím nejsou žádná vyúčtování.'}
          </p>
          {buildingId && (
            <div className="mt-6">
               <Link href={`/billing/new?buildingId=${buildingId}`} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium">
                  + Vytvořit nové vyúčtování
               </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                {!buildingId && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bytový dům
                  </th>
                )}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rok
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stav
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Počet jednotek
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Vytvořeno
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {billingPeriods.map((period) => (
                <tr key={period.id}>
                  {!buildingId && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      <Link href={`/buildings/${period.buildingId}/billing?year=${period.year}`} className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-200 hover:underline">
                        {period.building.name}
                      </Link>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {buildingId ? (
                      <Link href={`/buildings/${period.buildingId}/billing?year=${period.year}`} className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-200 hover:underline">
                        {period.year}
                      </Link>
                    ) : (
                      period.year
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${period.status === BillingStatus.DRAFT ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
                        period.status === BillingStatus.CALCULATED ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                        period.status === BillingStatus.APPROVED ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {period.status === BillingStatus.DRAFT ? 'Návrh' :
                       period.status === BillingStatus.CALCULATED ? 'Vypočteno' :
                       period.status === BillingStatus.APPROVED ? 'Schváleno' : 
                       period.status === BillingStatus.SENT ? 'Odesláno' : period.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {period._count.results}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(period.createdAt).toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                    <BillingPeriodActions
                      billingPeriodId={period.id}
                      year={period.year}
                      buildingName={period.building.name}
                      resultsCount={period._count.results}
                    />
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
