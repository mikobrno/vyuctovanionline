import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import BuildingDetailTabs from '@/components/buildings/BuildingDetailTabs'
import { prisma } from '@/lib/prisma'

export default async function BuildingDetailPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const { tab = 'units' } = await searchParams

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      units: {
        include: {
          ownerships: {
            where: { validTo: null },
            include: { owner: true },
          },
          meters: {
            include: {
              readings: {
                orderBy: { readingDate: 'desc' },
                take: 1
              }
            }
          }
        },
        orderBy: { unitNumber: 'asc' },
      },
      services: {
        orderBy: { name: 'asc' },
      },
      costs: {
        include: {
          service: true
        },
        orderBy: { invoiceDate: 'desc' }
      },
      _count: {
        select: {
          units: true,
          services: true,
          costs: true,
        },
      },
    },
  })

  if (!building) {
    notFound()
  }

  // Získat unikátní vlastníky z jednotek
  const uniqueOwners = Array.from(
    new Map(
      building.units
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((unit: any) => unit.ownerships.map((o: any) => o.owner))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((owner: any) => [owner.id, owner])
    ).values()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[]

  // Získat platby pro všechny jednotky v domě
  const payments = await prisma.payment.findMany({
    where: {
      unit: {
        buildingId: id
      }
    },
    include: {
      unit: true
    },
    orderBy: {
      paymentDate: 'desc'
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/buildings"
              className="text-gray-400 hover:text-gray-900"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {building.name}
              </h1>
              <p className="mt-2 text-gray-900">
                {building.address}, {building.city}
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

        {/* Statistiky */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Jednotek</p>
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
                <p className="text-sm font-medium text-gray-900">Vlastníků</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{uniqueOwners.length}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Služeb</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{building._count.services}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Celková výměra</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {building.units.reduce((sum: number, unit: any) => sum + unit.totalArea, 0).toFixed(1)} m²
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Záložky */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              <Link
                href={`/buildings/${building.id}?tab=units`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'units'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                🏠 Jednotky
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=owners`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'owners'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                👥 Vlastníci ({uniqueOwners.length})
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=invoices`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'invoices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                🧾 Faktury
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=hot_water`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'hot_water'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                💧 Odečty TUV
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=cold_water`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'cold_water'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ❄️ Odečty SV
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=heating`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'heating'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                🔥 Teplo
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=payments`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                💳 Platby
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=advances`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'advances'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                📅 Předpis po měsíci
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=parameters`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'parameters'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ⚙️ Parametry
              </Link>
              <Link
                href={`/buildings/${building.id}?tab=billing`}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === 'billing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                📊 Vyúčtování
              </Link>
            </nav>
          </div>

          {/* Obsah záložek */}
          <div className="p-6">
            <BuildingDetailTabs 
              building={building}
              uniqueOwners={uniqueOwners}
              payments={payments}
              tab={tab}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
