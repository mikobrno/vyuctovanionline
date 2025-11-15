import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  const building = await prisma.building.findUnique({
    where: {
      id,
    },
    include: {
      units: {
        include: {
          ownerships: {
            where: {
              validTo: null,
            },
            include: {
              owner: true,
            },
          },
        },
        orderBy: {
          unitNumber: 'asc',
        },
      },
      services: {
        orderBy: {
          name: 'asc',
        },
      },
      _count: {
        select: {
          units: true,
          services: true,
        },
      },
    },
  })

  if (!building) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/buildings"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {building.name}
              </h1>
              <p className="mt-2 text-gray-600">
                Detail bytového domu a správa jednotek
              </p>
            </div>
            <Link
              href={`/buildings/${building.id}/edit`}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Upravit dům
            </Link>
          </div>
        </div>

        {/* Základní informace */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Základní údaje</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Název</label>
                <p className="mt-1 text-gray-900">{building.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">IČO</label>
                <p className="mt-1 text-gray-900">{building.ico || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Adresa</label>
                <p className="mt-1 text-gray-900">{building.address}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Město</label>
                <p className="mt-1 text-gray-900">{building.city}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">PSČ</label>
                <p className="mt-1 text-gray-900">{building.zip}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Číslo účtu</label>
                <p className="mt-1 text-gray-900">{building.bankAccount || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiky */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Jednotek celkem</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{building._count.units}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Služeb</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{building._count.services}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Celková výměra</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {building.units.reduce((sum: number, unit: typeof building.units[number]) => sum + unit.totalArea, 0).toFixed(1)} m²
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Seznam jednotek */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Jednotky</h2>
            <Link
              href={`/units/new?buildingId=${building.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              + Přidat jednotku
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jednotka
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vlastník
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Výměra
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Podíl
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VS
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {building.units.map((unit: typeof building.units[number]) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {unit.unitNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {unit.ownerships[0] ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {unit.ownerships[0].owner.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Bez vlastníka</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {unit.totalArea} m²
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {unit.shareNumerator}/{unit.shareDenominator}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {unit.variableSymbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/units/${unit.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Detail
                      </Link>
                      <Link
                        href={`/units/${unit.id}/edit`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Upravit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seznam služeb */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Služby</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm">
              + Přidat službu
            </button>
          </div>
          <div className="px-6 py-4">
            {building.services.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Zatím nejsou definovány žádné služby</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {building.services.map((service: typeof building.services[number]) => (
                  <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{service.name}</h3>
                    <div className="text-sm text-gray-600">
                      <p>Kód: {service.code}</p>
                      <p>Metodika: {service.methodology}</p>
                      {service.measurementUnit && <p>Jednotka: {service.measurementUnit}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
