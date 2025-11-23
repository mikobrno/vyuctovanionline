import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'

export default async function OwnersPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const owners = await prisma.owner.findMany({
    include: {
      ownerships: {
        where: {
          validTo: null,
        },
        include: {
          unit: {
            include: {
              building: true,
            },
          },
        },
      },
    },
    orderBy: {
      lastName: 'asc',
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Vlastníci
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Správa vlastníků jednotek
            </p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            + Přidat vlastníka
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {owners.map((owner: (typeof owners)[number]) => (
            <div
              key={owner.id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {owner.firstName} {owner.lastName}
              </h3>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                {owner.email && (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {owner.email}
                  </div>
                )}
                {owner.phone && (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {owner.phone}
                  </div>
                )}
              </div>

              {owner.ownerships.length > 0 && (
                <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Vlastní jednotky:</p>
                  <div className="space-y-1">
                    {owner.ownerships.map((ownership: (typeof owner.ownerships)[number]) => (
                      <div key={ownership.id} className="text-sm text-gray-900 dark:text-white">
                        {ownership.unit.unitNumber} ({ownership.unit.building.name})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
                <button className="flex-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Detail
                </button>
                <button className="flex-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Upravit
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
