import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const currentYear = new Date().getFullYear()

  const [costs, buildings] = await Promise.all([
    prisma.cost.findMany({
      where: { period: currentYear },
      include: {
        building: {
          select: { name: true },
        },
        service: {
          select: { name: true, code: true },
        },
      },
      orderBy: [
        { invoiceDate: 'desc' },
      ],
    }),
    prisma.building.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-900 mb-4">
              <Link href="/billing" className="hover:text-blue-600">Vyúčtování</Link>
              <span>/</span>
              <span className="text-gray-900">Náklady</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Evidence nákladů</h1>
            <p className="mt-2 text-gray-900">Zadejte všechny faktury za služby pro rok {currentYear}</p>
          </div>
          <Link
            href="/billing/expenses/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import z Excelu
          </Link>
        </div>

        <ExpensesClient initialCosts={costs} buildings={buildings} currentYear={currentYear} />
      </main>
    </div>
  )
}
