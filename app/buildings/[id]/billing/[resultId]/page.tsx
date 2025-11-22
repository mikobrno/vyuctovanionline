import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { BillingStatement } from '@/components/buildings/BillingStatement'
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
  const year = billingResult.billingPeriod.year

  // Načíst další data pro zobrazení (měřidla, platby)
  // Poznámka: V "Black Box" režimu zatím tato data nemusí být v DB kompletní,
  // ale připravíme strukturu pro BillingStatement.
  
  const meters = await prisma.meter.findMany({
    where: { unitId: billingResult.unitId },
    include: {
      readings: { where: { period: year } },
      service: true
    }
  });

  const payments = await prisma.payment.findMany({
    where: { unitId: billingResult.unitId, period: year },
    orderBy: { paymentDate: 'asc' }
  });

  // Transformace dat pro komponentu BillingStatement
  const statementData = {
    building: {
      name: building.name,
      address: `${building.address}, ${building.city}`,
      accountNumber: building.bankAccount || '',
      variableSymbol: billingResult.unit.variableSymbol || ''
    },
    unit: {
      name: billingResult.unit.unitNumber,
      owner: billingResult.unit.ownerships[0]?.owner 
        ? `${billingResult.unit.ownerships[0].owner.lastName} ${billingResult.unit.ownerships[0].owner.firstName}` 
        : 'Neznámý vlastník',
      share: `${billingResult.unit.shareNumerator}/${billingResult.unit.shareDenominator}`
    },
    period: {
      year: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    },
    services: billingResult.serviceCosts.map(cost => ({
      name: cost.service.name,
      unit: cost.service.measurementUnit || '',
      share: 0, // TODO: Dopočítat podíl pokud je potřeba
      buildingCost: cost.buildingTotalCost,
      buildingUnits: cost.buildingConsumption || 0,
      pricePerUnit: cost.unitPricePerUnit || 0,
      userUnits: cost.unitConsumption || 0,
      userCost: cost.unitCost,
      advance: cost.unitAdvance,
      result: cost.unitBalance
    })),
    totals: {
      cost: billingResult.totalCost,
      advance: billingResult.totalAdvancePrescribed,
      result: billingResult.result
    },
    readings: meters.flatMap(m => m.readings.map(r => ({
      service: m.service?.name || m.type,
      meterId: m.serialNumber,
      startValue: r.startValue || 0,
      endValue: r.endValue || r.value,
      consumption: r.consumption || (r.value - (r.startValue || 0))
    }))),
    payments: payments.map(p => ({
      month: p.paymentDate.getMonth() + 1,
      prescribed: 0, // TODO: Načíst předpis
      paid: p.amount
    }))
  };

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

        <BillingStatement data={statementData} />
      </main>
    </div>
  )
}
