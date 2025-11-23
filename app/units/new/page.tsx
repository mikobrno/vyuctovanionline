import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import UnitForm from '@/components/units/UnitForm'
import { prisma } from '@/lib/prisma'

export default async function NewUnitPage({ 
  searchParams 
}: { 
  searchParams: { buildingId?: string } 
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Pokud je buildingId v URL, předvyplníme ho
  const preselectedBuildingId = searchParams.buildingId

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <DashboardNav session={session} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Přidat novou jednotku
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Vytvořte novou jednotku (byt, garáž, sklep)
          </p>
        </div>

        <UnitForm buildings={buildings} preselectedBuildingId={preselectedBuildingId} />
      </main>
    </div>
  )
}
