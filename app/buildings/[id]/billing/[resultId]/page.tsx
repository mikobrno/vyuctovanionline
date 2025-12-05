import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { BillingStatement } from '@/components/buildings/BillingStatement'
import { BillingDetailActions } from '@/components/billing/BillingDetailActions'
import { prisma } from '@/lib/prisma'
import { generateBillingQRCode } from '@/lib/qrGenerator'

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

  // Načíst předpisy záloh (AdvanceMonthly) pro případ, že nejsou v JSONu
  const advanceMonthlies = await prisma.advanceMonthly.findMany({
    where: {
      unitId: billingResult.unitId,
      year: year
    },
    include: {
      service: true
    }
  });

  // Agregace záloh podle služby pro doplnění do tabulky služeb
  const advanceByService = new Map<string, number>();
  advanceMonthlies.forEach(a => {
    const current = advanceByService.get(a.serviceId) || 0;
    advanceByService.set(a.serviceId, current + a.amount);
  });

  // Helper pro popis metodiky (sloupec Jednotka)
  const getMethodologyLabel = (service: any) => {
    switch (service.methodology) {
      case 'OWNERSHIP_SHARE': return 'vlastnický podíl';
      case 'AREA': return 'm2 plochy';
      case 'PERSON_MONTHS': return 'osobo-měsíce';
      case 'METER_READING': return service.measurementUnit === 'kWh' ? 'odečet tepla' : `odečet ${service.measurementUnit || ''}`.trim();
      case 'FIXED_PER_UNIT': return 'na byt';
      case 'EQUAL_SPLIT': return 'rovným dílem';
      case 'UNIT_PARAMETER': return 'dle parametru';
      default: return service.measurementUnit || '';
    }
  };

  const parseDistributionShare = (value?: string | null) => {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value
      .toString()
      .replace(/%/g, '')
      .replace(',', '.')
      .trim();

    if (!normalized) {
      return null;
    }

    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : value.toString().trim();
  };

  // 1. Příprava předpisů (Prescriptions)
  let prescriptions = (billingResult.monthlyPrescriptions as number[]) || [];
  
  // Fallback: Pokud je prescriptions prázdné, zkusíme monthlyPayments
  if (prescriptions.length === 0 || prescriptions.every(v => v === 0)) {
     if (billingResult.monthlyPayments && Array.isArray(billingResult.monthlyPayments)) {
        const payments = billingResult.monthlyPayments as number[];
        if (payments.some(v => v > 0)) {
           prescriptions = payments;
        }
     }
  }

  // Pokud stále nejsou předpisy, zkusíme je spočítat z DB
  if (prescriptions.length === 0 || prescriptions.every(v => v === 0)) {
      const calculatedPrescriptions = Array(12).fill(0);
      
      // Zkusíme najít "Celková záloha" nebo "TOTAL_ADVANCE"
      const totalAdvanceRecords = advanceMonthlies.filter(a => 
        a.service.code === 'TOTAL_ADVANCE' || a.service.name === 'Celková záloha'
      );
      
      if (totalAdvanceRecords.length > 0) {
        totalAdvanceRecords.forEach(rec => {
          if (rec.month >= 1 && rec.month <= 12) {
            calculatedPrescriptions[rec.month - 1] = rec.amount;
          }
        });
      } else {
        // Pokud není celková záloha, sečteme všechny zálohy
        advanceMonthlies.forEach(rec => {
          if (rec.month >= 1 && rec.month <= 12) {
            calculatedPrescriptions[rec.month - 1] += rec.amount;
          }
        });
      }
      
      if (calculatedPrescriptions.some(v => v > 0)) {
          prescriptions = calculatedPrescriptions;
      }
  }
  
  // Zajistit délku 12
  if (prescriptions.length < 12) {
      prescriptions = [...prescriptions, ...Array(12 - prescriptions.length).fill(0)];
  }

  // 2. Příprava plateb (Payments)
  let paid = (billingResult.monthlyPayments as number[]) || [];

  // Fallback: Pokud je paid prázdné, zkusíme monthlyPrescriptions
  if (paid.length === 0 || paid.every(v => v === 0)) {
     if (billingResult.monthlyPrescriptions && Array.isArray(billingResult.monthlyPrescriptions)) {
        const presc = billingResult.monthlyPrescriptions as number[];
        if (presc.some(v => v > 0)) {
           paid = presc;
        }
     }
  }

  // Pokud stále nejsou platby, zkusíme je spočítat z DB
  if (paid.length === 0 || paid.every(v => v === 0)) {
      const calculatedPaid = Array(12).fill(0);
      payments.forEach(p => {
          const m = p.paymentDate.getMonth(); // 0-11
          if (m >= 0 && m < 12) {
              calculatedPaid[m] += p.amount;
          }
      });
      
      if (calculatedPaid.some(v => v > 0)) {
          paid = calculatedPaid;
      }
  }
  
  // Zajistit délku 12
  if (paid.length < 12) {
      paid = [...paid, ...Array(12 - paid.length).fill(0)];
  }

  // 3. Kombinace do výsledného pole
  const paymentsData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    prescribed: prescriptions[i] || 0,
    paid: paid[i] || 0
  }));

  // Generování QR kódu pro nedoplatek
  const qrCodeUrl = await generateBillingQRCode({
    balance: billingResult.result,
    year: year,
    unitNumber: billingResult.unit.unitNumber,
    variableSymbol: billingResult.unit.variableSymbol,
    bankAccount: building.bankAccount || null
  });

  // Transformace dat pro komponentu BillingStatement
  // Pokud jsou data z EXPORT_FULL (meterReadings v serviceCosts), použijeme je
  // jinak fallback na stará data z meters
  
  // Extrahujeme měřidla z BillingServiceCost.meterReadings (JSON string)
  const readingsFromSnapshot: Array<{
    service: string;
    meterId: string;
    startValue: number;
    endValue: number;
    consumption: number;
  }> = [];
  
  billingResult.serviceCosts.forEach(cost => {
    if (cost.meterReadings) {
      try {
        const parsed = JSON.parse(cost.meterReadings as string) as Array<{
          serial: string;
          start: number;
          end: number;
          consumption: number;
        }>;
        parsed.forEach(m => {
          readingsFromSnapshot.push({
            service: cost.service.name,
            meterId: m.serial,
            startValue: m.start,
            endValue: m.end,
            consumption: m.consumption
          });
        });
      } catch (e) {
        console.error('Error parsing meterReadings:', e);
      }
    }
  });
  
  // Použijeme data ze snapshot pokud existují, jinak fallback na meters z DB
  const finalReadings = readingsFromSnapshot.length > 0 
    ? readingsFromSnapshot 
    : meters.flatMap(m => m.readings.map(r => ({
        service: m.service?.name || m.type,
        meterId: m.serialNumber,
        startValue: r.startValue || 0,
        endValue: r.endValue || r.value,
        consumption: r.consumption || (r.value - (r.startValue || 0))
      })));

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
        ? `${activeOwner.owner.firstName} ${activeOwner.owner.lastName}`.trim()
        : 'Neznámý vlastník',
      share: `${billingResult.unit.shareNumerator}/${billingResult.unit.shareDenominator}`,
      address: activeOwner?.owner?.address || '',
      email: activeOwner?.owner?.email || '',
      phone: activeOwner?.owner?.phone || '',
      bankAccount: activeOwner?.owner?.bankAccount || ''
    },
    period: {
      year: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    },
    services: billingResult.serviceCosts.map(cost => {
      const distributionShare = parseDistributionShare(cost.distributionShare);
      return ({
        name: cost.service.name,
        unit: cost.distributionBase || cost.calculationBasis || getMethodologyLabel(cost.service),
        share: distributionShare ?? (activeOwner?.sharePercent ?? 100),
        buildingCost: cost.buildingTotalCost,
        buildingUnits: cost.buildingConsumption || 0,
        pricePerUnit: cost.unitPricePerUnit || 0,
        userUnits: cost.unitConsumption || 0,
        userCost: cost.unitCost,
        advance: cost.unitAdvance || advanceByService.get(cost.serviceId) || 0,
        result: cost.unitBalance
      });
    }),
    totals: {
      cost: billingResult.totalCost,
      advance: billingResult.totalAdvancePrescribed,
      result: billingResult.result
    },
    readings: finalReadings,
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
              <BillingDetailActions buildingId={buildingId} resultId={resultId} />
            </div>
          </div>
        </div>

        <BillingStatement data={statementData} />
      </main>
    </div>
  )
}
