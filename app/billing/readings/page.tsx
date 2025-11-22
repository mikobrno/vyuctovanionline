import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'

export default async function ReadingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link href="/billing" className="hover:text-teal-600">Vyúčtování</Link>
              <span>/</span>
              <span className="text-gray-900">Odečty</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Odečty měřidel
            </h1>
            <p className="mt-2 text-gray-500">
              Zaznamenejte konečné stavy všech vodoměrů a topných měřičů
            </p>
          </div>
          <Link
            href="/billing/readings/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import z Excelu
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 mb-4">
            Pro zadávání odečtů nejdříve vytvořte měřidla u jednotek nebo použijte import z Excelu.
          </p>
          <div className="flex gap-4">
            <Link
              href="/units"
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Přejít na jednotky
            </Link>
            <Link
              href="/billing/readings/import"
              className="inline-flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Importovat odečty z Excelu
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
