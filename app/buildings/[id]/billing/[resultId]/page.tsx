import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import BillingStatement from '@/components/buildings/BillingStatement'
import { prisma } from '@/lib/prisma'

export default async function BillingResultDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string; resultId: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id: buildingId, resultId } = await params

  // Načíst vyúčtování s detaily
  const billingResult = await prisma.billingResult.findUnique({
    where: { id: resultId },
    include: {
      billingPeriod: {
        include: {
          building: true
        }
      },
      unit: {
        include: {
          ownerships: {
            where: { validTo: null },
            include: {
              owner: true
            }
          }
        }
      },
      serviceCosts: {
        include: {
          service: true
        },
        orderBy: {
          service: {
            order: 'asc'
          }
        }
      }
    }
  })

  if (!billingResult) {
    notFound()
  }

  const building = billingResult.billingPeriod.building

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href={`/buildings/${buildingId}?tab=results`}
              className="text-gray-400 hover:text-gray-900"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                Vyúčtování {billingResult.unit.name}
              </h1>
              <p className="mt-2 text-gray-900">
                {building.name} - Rok {billingResult.billingPeriod.year}
              </p>
            </div>
          </div>
        </div>

        <BillingStatement
          billingResult={billingResult}
          period={billingResult.billingPeriod.year}
          buildingName={building.name}
          buildingAddress={`${building.address}, ${building.city}`}
          buildingId={buildingId}
        />
      </main>
    </div>
  )
}
