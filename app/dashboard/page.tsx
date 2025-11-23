import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import AppLayout from '@/components/layout/AppLayout'
import StatsCards from '@/components/dashboard/StatsCards'
import CompleteImport from '@/components/buildings/CompleteImport'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage({
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
  
  let buildingName = ''
  if (buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true }
    })
    if (building) {
      buildingName = building.name
    }
  }

  return (
    <AppLayout user={session.user}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">KONTROLNÍ PANEL</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Vítejte, {session.user.name || session.user.email}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Přehled systému pro vyúčtování služeb{buildingName ? ` - ${buildingName}` : ''}. Stav k {new Date().toLocaleDateString('cs-CZ')}.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <StatsCards buildingId={buildingId} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        {/* Rychlý import */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Rychlý import dat</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nahrajte Excel soubor pro hromadné zpracování.</p>
            </div>
          </div>
          <CompleteImport buildingId={buildingId} />
        </div>

        {/* Rychlé akce */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Rychlé akce</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Časté operace v systému.</p>

          <div className="space-y-3">
            <Link
              href="/buildings/new"
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-100 dark:hover:border-teal-800 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">Přidat dům</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 group-hover:text-teal-500 dark:group-hover:text-teal-400">→</span>
            </Link>

            <Link
              href="/units"
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-100 dark:hover:border-teal-800 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">Správa jednotek</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 group-hover:text-teal-500 dark:group-hover:text-teal-400">→</span>
            </Link>

            <Link
              href="/billing"
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-100 dark:hover:border-teal-800 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">Nové vyúčtování</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 group-hover:text-teal-500 dark:group-hover:text-teal-400">→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Poslední aktivity */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Poslední aktivity</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Historie akcí v systému.</p>
          
          <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-slate-700">
            <div className="relative pl-8">
              <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-teal-500 border-4 border-white dark:border-slate-800 shadow-sm"></div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Systém připraven</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Právě teď • System</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Aplikace je připravena k použití. Začněte importem dat nebo přidáním domu.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
