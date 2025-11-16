import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/dashboard/DashboardNav'
import BillingCalculateForm from '@/components/billing/BillingCalculateForm'
import BillingControlPanel from '@/components/billing/BillingControlPanel'

export default async function BillingCalculatePage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const { year = new Date().getFullYear().toString() } = await searchParams

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      services: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      },
      costs: {
        where: { period: parseInt(year) },
        include: { service: true },
      },
      units: {
        include: {
          meters: {
            include: {
              readings: {
                where: { period: parseInt(year) },
              },
            },
          },
        },
      },
    },
  })

  if (!building) {
    notFound()
  }

  // Získat existující vyúčtování pro daný rok
  const billingPeriod = await prisma.billingPeriod.findUnique({
    where: {
      buildingId_year: {
        buildingId: id,
        year: parseInt(year),
      },
    },
    include: {
      results: {
        include: {
          unit: true,
          serviceCosts: {
            include: {
              service: true,
            },
          },
        },
        orderBy: {
          unit: {
            unitNumber: 'asc',
          },
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Vyúčtování {year}
          </h1>
          <p className="mt-2 text-gray-900">
            {building.name}
          </p>
        </div>

        {/* Kontrolní panel - přehled metodik a kontrolních údajů */}
        <div className="mb-8">
          <BillingControlPanel buildingId={id} year={parseInt(year)} />
        </div>

        {/* Formulář pro spuštění výpočtu a zobrazení výsledků */}
        <BillingCalculateForm 
          buildingId={id}
          year={parseInt(year)}
          building={building}
          billingPeriod={billingPeriod}
        />
      </main>
    </div>
  )
}
