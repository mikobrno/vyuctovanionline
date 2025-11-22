import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getBillingPdfData(billingResultId: string) {
  // 1. Načtení hlavního výsledku s vazbami
  const result = await prisma.billingResult.findUnique({
    where: { id: billingResultId },
    include: {
      unit: {
        include: {
          // Načteme všechny vlastníky pro nalezení toho správného pro daný rok
          ownerships: {
            include: { owner: true },
            orderBy: { validFrom: 'desc' }
          }
        }
      },
      billingPeriod: {
        include: {
          building: true // Potřebujeme číslo účtu budovy
        }
      },
      serviceCosts: {
        include: {
          service: true
        }
      }
    }
  });

  if (!result) throw new Error("Billing result not found");

  const year = result.billingPeriod.year;
  const unitId = result.unitId;

  // 2. Načtení historie záloh (pro tabulku měsíců)
  // Použijeme AdvanceMonthly pokud existuje, jinak bychom museli dopočítat z AdvancePaymentRecord
  const advances = await prisma.advanceMonthly.findMany({
    where: {
      unitId: unitId,
      year: year
    },
    orderBy: { month: 'asc' }
  });

  // 2b. Načtení historie plateb
  const payments = await prisma.payment.findMany({
    where: {
      unitId: unitId,
      period: year
    },
    orderBy: { paymentDate: 'asc' }
  });

  // 3. Načtení náměrů (pro sekci Měřené služby)
  // Hledáme měřidla jednotky a jejich odečty v daném roce
  const metersWithReadings = await prisma.meter.findMany({
    where: { unitId: unitId, isActive: true },
    include: {
      readings: {
        where: {
          OR: [
            { dateEnd: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
            // Fallback pro starší strukturu
            { readingDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }
          ],
        },
        orderBy: { readingDate: 'desc' },
        take: 2 // Potřebujeme ideálně počátek a konec, nebo jen konec a consumption
      },
      service: true // Abychom věděli, k čemu měřidlo patří
    }
  });

  // Zpracování náměrů do ploché struktury pro PDF
  const processedReadings = metersWithReadings.map(m => {
    const endReading = m.readings[0]; // Nejnovější
    // Pokud máme consumption přímo, použijeme ho. Jinak null.
    // Pro účely PDF předpokládáme, že importér uložil stavy.
    return {
      meterSerial: m.serialNumber,
      serviceName: m.service?.name || m.type,
      startValue: endReading?.startValue ?? (endReading ? (endReading.value - (endReading.consumption || 0)) : 0),
      endValue: endReading?.endValue ?? endReading?.value ?? 0,
      consumption: endReading?.consumption ?? 0,
      unit: m.service?.measurementUnit || 'm3' // Default
    };
  }).filter(r => r.consumption > 0 || r.endValue > 0); // Skrýt prázdné

  // Find the relevant owner for the billing year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  const activeOwner = result.unit.ownerships.find(o => {
    const start = o.validFrom;
    const end = o.validTo || new Date(9999, 11, 31);
    // Check for overlap with the billing year
    return start <= yearEnd && end >= yearStart;
  })?.owner || result.unit.ownerships[0]?.owner;

  return {
    result,
    advances,
    payments,
    readings: processedReadings,
    building: result.billingPeriod?.building,
    unit: result.unit,
    owner: activeOwner || { 
      id: 'unknown',
      firstName: 'Neznámý', 
      lastName: 'Vlastník', 
      address: '',
      email: null,
      phone: null,
      bankAccount: null,
      salutation: null,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };
}

export type BillingPdfData = Awaited<ReturnType<typeof getBillingPdfData>>;
