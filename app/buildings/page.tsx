import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ExcelImport from '@/components/buildings/ExcelImport'
import { prisma } from '@/lib/prisma'

export default async function BuildingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const buildings = await prisma.building.findMany({
    include: {
      _count: {
        select: {
          units: true,
          services: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Bytové domy
            </h1>
            <p className="mt-2 text-gray-600">
              Správa bytových domů a jejich jednotek
            </p>
          </div>
          <Link
            href="/buildings/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            + Přidat dům
          </Link>
        </div>

        {buildings.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Zatím žádné domy
            </h3>
            <p className="text-gray-600 mb-6">
              Začněte přidáním prvního bytového domu
            </p>
            <Link
              href="/buildings/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              + Přidat první dům
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildings.map((building: (typeof buildings)[number]) => (
              <div
                key={building.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {building.name}
                </h3>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {building.address}, {building.city}
                  </div>
                  {building.ico && (
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      IČO: {building.ico}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    {building._count.units} jednotek
                  </div>
                  <div className="flex items-center text-gray-600">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {building._count.services} služeb
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <Link
                    href={`/buildings/${building.id}`}
                    className="flex-1 text-center text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Detail
                  </Link>
                  <Link
                    href={`/buildings/${building.id}/edit`}
                    className="flex-1 text-center text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Upravit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import z Excelu sekce */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📊 Import dat z Excelu
          </h2>
          <p className="text-gray-600 mb-4">
            Nahrajte svůj Excel soubor (vyuctovani2024.xlsx) a systém automaticky načte všechna data
          </p>
          
          <ExcelImport />

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-blue-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Co bude importováno:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Bytové domy a jejich údaje</li>
                  <li>Jednotky (byty, garáže, sklepy)</li>
                  <li>Vlastníci a jejich kontaktní údaje</li>
                  <li>Služby a metodiky rozúčtování</li>
                  <li>Měřidla a jejich odečty</li>
                  <li>Náklady (faktury) na služby</li>
                  <li>Předpisy záloh</li>
                  <li>Platby vlastníků</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
