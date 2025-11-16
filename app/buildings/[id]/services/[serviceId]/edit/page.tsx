import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ServiceConfigForm from '@/components/buildings/ServiceConfigForm'

export default async function EditServicePage({ 
  params 
}: { 
  params: Promise<{ id: string; serviceId: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id, serviceId } = await params

  const building = await prisma.building.findUnique({
    where: { id },
  })

  if (!building) {
    notFound()
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  })

  if (!service || service.buildingId !== id) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Nastavení služby: {service.name}
          </h1>
          <p className="mt-2 text-gray-900">
            {building.name}
          </p>
        </div>

        <ServiceConfigForm 
          buildingId={id} 
          service={service} 
        />
      </main>
    </div>
  )
}
