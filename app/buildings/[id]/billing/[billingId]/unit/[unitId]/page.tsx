import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/dashboard/DashboardNav'
import BillingUnitDetail from '@/components/billing/BillingUnitDetail'

export default async function BillingUnitPage({ 
  params 
}: { 
  params: Promise<{ id: string; billingId: string; unitId: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id, billingId, unitId } = await params

  const billingPeriod = await prisma.billingPeriod.findUnique({
    where: { id: billingId },
    include: {
      building: true,
    },
  })

  if (!billingPeriod || billingPeriod.buildingId !== id) {
    notFound()
  }

  const billingResult = await prisma.billingResult.findUnique({
    where: {
      billingPeriodId_unitId: {
        billingPeriodId: billingId,
        unitId: unitId,
      },
    },
    include: {
      unit: {
        include: {
          ownerships: {
            where: { validTo: null },
            include: { owner: true },
          },
        },
      },
      serviceCosts: {
        include: {
          service: true,
        },
        orderBy: {
          service: {
            order: 'asc',
          },
        },
      },
    },
  })

  if (!billingResult) {
    notFound()
  }

  // Získat platby pro jednotku
  const payments = await prisma.payment.findMany({
    where: {
      unitId: unitId,
      period: billingPeriod.year,
    },
    orderBy: {
      paymentDate: 'asc',
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BillingUnitDetail 
          buildingId={id}
          billingPeriod={billingPeriod}
          billingResult={billingResult}
          payments={payments}
        />
      </main>
    </div>
  )
}
