import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getBillingPdfData(billingResultId: string) {
  // 1. Načtení hlavního výsledku s vazbami
  const result = await prisma.billingResult.findUnique({
    where: { id: billingResultId },
    include: {
      unit: {
        include: {
          // Načteme vlastníka (předpokládáme vazbu přes Ownership nebo přímo na Unit, dle vašeho schématu)
          // Zde pro jednoduchost bereme data přímo z Unit, pokud tam jsou, nebo první aktivní ownership
          ownerships: {
            where: { validTo: null },
            include: { owner: true },
            take: 1
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

  const year = result.year;
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

  return {
    result,
    advances,
    readings: processedReadings,
    building: result.billingPeriod?.building,
    unit: result.unit,
    owner: result.unit.ownerships[0]?.owner || { 
      firstName: result.unit.ownerName || '', 
      lastName: '', 
      address: '' 
    }
  };
}

export type BillingPdfData = Awaited<ReturnType<typeof getBillingPdfData>>;
