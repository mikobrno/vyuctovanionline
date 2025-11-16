import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'

export default async function BillingPage() {
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
            Vyúčtování
          </h1>
          <p className="mt-2 text-gray-600">
            Výpočet a správa ročního vyúčtování služeb
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kroky vyúčtování */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Kroky k vyúčtování
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">1. Evidence nákladů</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Zadejte všechny faktury za služby (teplo, voda, správa, atd.)
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">2. Odečty měřidel</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Zaznamenejte konečné stavy všech vodoměrů a topných měřičů
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0 h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-semibold">3</span>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">3. Evidence plateb</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Importujte nebo zadejte platby záloh od vlastníků
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-semibold">4</span>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">4. Spuštění výpočtu</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Systém automaticky vypočítá vyúčtování pro všechny jednotky
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-semibold">5</span>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">5. Generování a odeslání</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Vygenerujte PDF a odešlete vyúčtování vlastníkům
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rychlé akce */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Rychlé akce
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <Link href="/billing/expenses" className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left">
                  <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Náklady</h3>
                  <p className="text-sm text-gray-600">Zadat faktury</p>
                </Link>

                <Link href="/billing/readings" className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left">
                  <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Odečty</h3>
                  <p className="text-sm text-gray-600">Zadat měření</p>
                </Link>

                <Link href="/billing/payments" className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left">
                  <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Platby</h3>
                  <p className="text-sm text-gray-600">Import výpisů</p>
                </Link>

                <Link href="/billing/calculate" className="p-4 border-2 border-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all text-left">
                  <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Spustit výpočet</h3>
                  <p className="text-sm text-gray-600">Vyúčtovat</p>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Poslední vyúčtování</h3>
              <p className="text-sm text-gray-600">
                Zatím nebylo provedeno žádné vyúčtování
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Nápověda</p>
                  <p>Pro vyúčtování potřebujete nejprve vyplnit všechna data z Excel souboru. Použijte stránku <strong>Domy</strong> pro import dat.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
