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
            include: { owner: true },
            orderBy: { validFrom: 'desc' }
          },
          meters: {
            include: {
              readings: {
                orderBy: { readingDate: 'desc' },
                take: 1
              }
            }
          },
          personMonths: {
            orderBy: [
              { year: 'desc' },
              { month: 'desc' }
            ]
          },
          advancePaymentRecords: {
            include: {
              advancePayment: {
                include: {
                  service: true
                }
              }
            }
          },
          parameters: true
        },
        orderBy: { unitNumber: 'asc' },
      },
      services: {
        orderBy: { order: 'asc' },
        include: {
          advancePayments: {
            include: {
              records: {
                include: {
                  unit: true
                }
              }
            },
            orderBy: { year: 'desc' }
          }
        }
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

  const tabs = [
    { id: 'units', label: '🏠 Jednotky' },
    { id: 'overview', label: '🏢 Přehled' },
    { id: 'owners', label: `👥 Vlastníci (${uniqueOwners.length})` },
    { id: 'invoices', label: '🧾 Faktury' },
    { id: 'hot_water', label: '💧 Odečty TUV' },
    { id: 'cold_water', label: '❄️ Odečty SV' },
    { id: 'heating', label: '🔥 Teplo' },
    { id: 'payments', label: '💳 Platby' },
    { id: 'person_months', label: '👨‍👩‍👧‍👦 Počet osob' },
    { id: 'advances', label: '📅 Předpis po měsíci' },
    { id: 'parameters', label: '⚙️ Parametry' },
    { id: 'templates', label: '✉️ Šablony' },
    { id: 'billing', label: '📊 Vyúčtování' },
    { id: 'results', label: '📋 Výsledky' },
    { id: 'settings', label: '⚙️ Nastavení' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/buildings"
              className="p-2 rounded-full bg-white dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-sm hover:shadow transition-all"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {building.name}
              </h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {building.address}, {building.city}
              </p>
            </div>
            <Link
              href={`/buildings/${building.id}/edit`}
              className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Upravit dům
            </Link>
          </div>
        </div>

        {/* Statistiky - Moderní karty */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jednotek</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{building._count.units}</p>
              </div>
              <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vlastníků</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{uniqueOwners.length}</p>
              </div>
              <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Služeb</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{building._count.services}</p>
              </div>
              <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Celková výměra</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {building.units.reduce((sum: number, unit: any) => sum + unit.totalArea, 0).toFixed(1)} m²
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Záložky - Moderní Pills */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6 overflow-hidden">
          <div className="p-2">
            <nav className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <Link
                  key={t.id}
                  href={`/buildings/${building.id}?tab=${t.id}`}
                  className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
                    tab === t.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Obsah záložek */}
          <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30 min-h-[500px]">
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
