import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import UnitForm from '@/components/units/UnitForm'
import { prisma } from '@/lib/prisma'

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  const [unit, buildings] = await Promise.all([
    prisma.unit.findUnique({
      where: { id },
    }),
    prisma.building.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ])

  if (!unit) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <DashboardNav session={session} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Upravit jednotku
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Aktualizace údajů jednotky {unit.unitNumber}
          </p>
        </div>

        <UnitForm unit={unit} buildings={buildings} />
      </main>
    </div>
  )
}
