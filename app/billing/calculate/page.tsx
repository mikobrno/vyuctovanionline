import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'

export default async function CalculatePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const currentYear = new Date().getFullYear()
  
  const stats = await prisma.$transaction([
    prisma.cost.count({ where: { period: currentYear } }),
    prisma.payment.count({ where: { period: currentYear } }),
    prisma.unit.count(),
  ])

  const [costsCount, paymentsCount, unitsCount] = stats

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/billing" className="hover:text-teal-600">Vyúčtování</Link>
            <span>/</span>
            <span className="text-gray-900">Výpočet</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Spustit výpočet vyúčtování
          </h1>
          <p className="mt-2 text-gray-500">
            Automatický výpočet ročního vyúčtování služeb
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Stav dat pro rok {currentYear}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-teal-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-teal-600">{costsCount}</div>
              <div className="text-sm text-gray-500">Nákladů</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{paymentsCount}</div>
              <div className="text-sm text-gray-500">Plateb</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{unitsCount}</div>
              <div className="text-sm text-gray-500">Jednotek</div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <svg className="h-6 w-6 text-yellow-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Připravuje se</h3>
              <p className="text-sm text-yellow-800">
                Funkce automatického výpočtu vyúčtování je ve vývoji. Před spuštěním výpočtu se ujistěte, že máte kompletní data:
              </p>
              <ul className="mt-2 text-sm text-yellow-800 list-disc list-inside space-y-1">
                <li>Všechny náklady za rok</li>
                <li>Odečty všech měřidel</li>
                <li>Platby záloh od vlastníků</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/billing"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Zpět
          </Link>
          <button
            disabled
            className="px-6 py-3 bg-teal-600 text-white rounded-lg opacity-50 cursor-not-allowed"
          >
            Spustit výpočet (připravuje se)
          </button>
        </div>
      </main>
    </div>
  )
}
