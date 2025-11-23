import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import AppLayout from '@/components/layout/AppLayout'
import { prisma } from '@/lib/prisma'

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  const buildingId = typeof resolvedSearchParams.buildingId === 'string' ? resolvedSearchParams.buildingId : undefined

  const units = await prisma.unit.findMany({
    where: buildingId ? { buildingId } : undefined,
    include: {
      building: true,
      ownerships: {
        include: {
          owner: true,
        },
        orderBy: {
          validFrom: 'desc',
        },
      },
      _count: {
        select: {
          meters: true,
          payments: true,
        },
      },
    },
    orderBy: {
      unitNumber: 'asc',
    },
  })

  return (
    <AppLayout user={session.user}>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Jednotky {buildingId && units.length > 0 ? `- ${units[0].building.name}` : ''}
          </h1>
          <p className="mt-2 text-gray-900 dark:text-gray-300">
            Správa bytů, garáží a nebytových prostorů
          </p>
        </div>
        <Link
          href="/units/new"
          className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
        >
          + Přidat jednotku
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Jednotka
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Vlastník
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Výměra
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Podíl
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                VS
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Akce
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {units.map((unit: (typeof units)[number]) => (
              <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 shrink-0 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                      <svg className="h-5 w-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {unit.unitNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {unit.building.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {unit.ownerships[0] ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {unit.ownerships[0].owner.email}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">Bez vlastníka</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {unit.totalArea} m²
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {unit.shareNumerator}/{unit.shareDenominator}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {unit.variableSymbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/units/${unit.id}`}
                    className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-200 mr-4"
                  >
                    Detail
                  </Link>
                  <Link
                    href={`/units/${unit.id}/edit`}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    Upravit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
