import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import BuildingForm from '@/components/buildings/BuildingForm'

export default async function NewBuildingPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Přidat nový dům
          </h1>
          <p className="mt-2 text-gray-600">
            Vytvořte nový bytový dům v systému
          </p>
        </div>

        <BuildingForm />
      </main>
    </div>
  )
}
