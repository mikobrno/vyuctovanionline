import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import StatsCards from '@/components/dashboard/StatsCards'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Vítejte, {session.user.name || session.user.email}
          </h1>
          <p className="mt-2 text-gray-600">
            Přehled systému pro vyúčtování služeb
          </p>
        </div>

        <StatsCards />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rychlé akce */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Rychlé akce
            </h2>
            <div className="space-y-3">
              <a
                href="/buildings"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-medium text-gray-900">Správa domů</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Přidat nebo upravit bytové domy
                </p>
              </a>
              <a
                href="/units"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-medium text-gray-900">Jednotky</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Evidence bytů a vlastníků
                </p>
              </a>
              <a
                href="/billing"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-medium text-gray-900">Vyúčtování</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Spustit výpočet vyúčtování
                </p>
              </a>
            </div>
          </div>

          {/* Poslední aktivity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Poslední aktivity
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    Systém je připraven
                  </p>
                  <p className="text-sm text-gray-600">
                    Začněte přidáním bytového domu
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
