import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
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
            include: {
              owner: true
            },
            orderBy: {
              validFrom: 'desc'
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

  // Find the relevant owner for the billing year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  const activeOwner = billingResult.unit.ownerships.find(o => {
    const start = o.validFrom;
    const end = o.validTo || new Date(9999, 11, 31);
    // Check for overlap with the billing year
    return start <= yearEnd && end >= yearStart;
  }) || billingResult.unit.ownerships[0]; // Fallback to most recent

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

  // Použití JSON polí pro měsíční data (pokud existují)
  const monthlyPaymentsJson = (billingResult.monthlyPayments as number[]) || [];
  const monthlyPrescriptionsJson = (billingResult.monthlyPrescriptions as number[]) || [];

  // Pokud máme JSON data, použijeme je, jinak fallback na DB tabulku payments
  const paymentsData = monthlyPaymentsJson.length > 0 
    ? Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        prescribed: monthlyPrescriptionsJson[i] || 0,
        paid: monthlyPaymentsJson[i] || 0
      }))
    : payments.map(p => ({
        month: p.paymentDate.getMonth() + 1,
        prescribed: 0,
        paid: p.amount
      }));

  // Generování QR kódu pro nedoplatek
  let qrCodeUrl = undefined;
  if (billingResult.result < 0) {
    const amount = Math.abs(billingResult.result);
    const account = building.bankAccount;
    const vs = billingResult.unit.variableSymbol;
    
    if (account && vs) {
       const msg = `Vyuctovani ${year} - ${billingResult.unit.unitNumber}`;
       const spayString = `SPD*1.0*ACC:${account}*AM:${amount.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${msg.substring(0, 60)}`;
       try {
         qrCodeUrl = await QRCode.toDataURL(spayString);
       } catch (e) {
         console.error('Failed to generate QR code', e);
       }
    }
  }

  // Transformace dat pro komponentu BillingStatement
  const statementData = {
    building: {
      name: building.name,
      address: `${building.address}, ${building.city}`,
      accountNumber: building.bankAccount || '',
      variableSymbol: billingResult.unit.variableSymbol || '',
      managerName: building.managerName || undefined
    },
    unit: {
      name: billingResult.unit.unitNumber,
      owner: activeOwner 
        ? `${activeOwner.owner.lastName} ${activeOwner.owner.firstName}` 
        : 'Neznámý vlastník',
      share: `${billingResult.unit.shareNumerator}/${billingResult.unit.shareDenominator}`,
      address: activeOwner?.owner?.address || '',
      email: activeOwner?.owner?.email || '',
      phone: activeOwner?.owner?.phone || ''
    },
    period: {
      year: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    },
    services: billingResult.serviceCosts.map(cost => ({
      name: cost.service.name,
      unit: cost.service.measurementUnit || '',
      share: activeOwner?.sharePercent ?? 100,
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
    payments: paymentsData,
    qrCodeUrl
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
            <div className="flex-1 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Vyúčtování {billingResult.unit.unitNumber}
                </h1>
                <p className="mt-2 text-gray-900">
                  {building.name} - Rok {billingResult.billingPeriod.year}
                </p>
              </div>
              <a 
                href={`/api/buildings/${buildingId}/billing/${resultId}/pdf`}
                target="_blank"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Stáhnout PDF
              </a>
            </div>
          </div>
        </div>

        <BillingStatement data={statementData} />
      </main>
    </div>
  )
}
