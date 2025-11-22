import { PrismaClient, CalculationMethod } from '@prisma/client';

const prisma = new PrismaClient();

interface ServiceCalculationResult {
  serviceId: string;
  serviceName: string;
  method: CalculationMethod;
  totalBuildingCost: number; // Celkový náklad za dům
  unitCost: number;          // Vypočítaný náklad na jednotku
  unitConsumption?: number;  // Spotřeba (pokud existuje)
  pricePerUnit?: number;     // Cena za měrnou jednotku
  advancePaid: number;       // Zaplacené zálohy na tuto službu
  balance: number;           // Přeplatek/Nedoplatek za tuto službu
  calculationBasis: string;  // Textový popis pro kontrolu (např. "Podíl 50/1000 * 10000 Kč")
}

// Pomocná funkce pro bezpečné číslo
function safeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value)) return 0; // Zachytí Infinity a NaN
  if (Number.isNaN(value)) return 0;
  return value;
}

export async function calculateBillingForBuilding(buildingId: string, year: number) {
  console.log(`🚀 Spouštím výpočet vyúčtování pro budovu ${buildingId}, rok ${year}`);

  // 1. PŘÍPRAVA DAT
  // ---------------------------------------------------------
  
  // A. Získání nebo vytvoření BillingPeriod
  const billingPeriod = await prisma.billingPeriod.upsert({
    where: { buildingId_year: { buildingId, year } },
    update: {},
    create: { buildingId, year }
  });

  // B. Načtení jednotek včetně měřidel a náměrů
  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: {
      meters: {
        where: { isActive: true },
        include: {
          readings: {
            where: {
              OR: [
                { dateEnd: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
                { readingDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }
              ]
            },
            orderBy: { readingDate: 'desc' },
            take: 1 
          }
        }
      }
    }
  });

  // C. Načtení služeb a nákladů
  const services = await prisma.service.findMany({
    where: { buildingId },
    include: {
      costs: {
        where: { period: year }
      }
    }
  });

  // D. Načtení záloh
  const advances = await prisma.advanceMonthly.findMany({
    where: { 
      unit: { buildingId },
      year: year
    }
  });

  // E. Globální sumy pro rozpočítání
  const totalShare = safeNumber(units.reduce((sum, u) => sum + (u.share || 0), 0));
  const totalUnitsCount = units.length;
  // TODO: Zde by se měl načíst reálný počet osob, pokud je v DB.
  const totalPeople = units.length; 

  // F. PŘEDVÝPOČET SPOTŘEB (Pro BY_METER)
  // Musíme znát celkovou spotřebu domu PRO KAŽDOU SLUŽBU, abychom spočítali cenu za jednotku.
  const serviceTotalConsumptions = new Map<string, number>();

  for (const service of services) {
    if (service.calculationMethod === 'BY_METER') {
      let totalCons = 0;
      
      // Najdeme typ měřidla pro tuto službu
      const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV');
      
      for (const u of units) {
         const uMeters = u.meters.filter(m => isWater && (m.type === 'COLD_WATER' || m.type === 'HOT_WATER'));
         for (const m of uMeters) {
           const r = m.readings[0];
           if (r) {
             // Pokud máme consumption (rozdíl), použijeme. Jinak value (pokud je to roční spotřeba).
             totalCons += safeNumber(r.consumption ?? r.value);
           }
        }
      }
      serviceTotalConsumptions.set(service.id, safeNumber(totalCons));
      console.log(`💧 Celková spotřeba pro službu ${service.name}: ${totalCons}`);
    }
  }

  // Smazání starých výsledků
  await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } });
  await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } });

  // 2. HLAVNÍ SMYČKA (Iterace přes jednotky)
  // ---------------------------------------------------------

  for (const unit of units) {
    let unitTotalCost = 0;
    let unitTotalAdvance = 0;
    const serviceResults: ServiceCalculationResult[] = [];

    for (const service of services) {
      const serviceBuildingCost = safeNumber(service.costs.reduce((sum, c) => sum + c.amount, 0));
      
      let calculatedCost = 0;
      let unitConsumption = 0;
      let pricePerUnit = 0;
      let basisText = "";

      // --- NOVÁ LOGIKA: PRIORITA EXTERNÍHO NÁKLADU ---
      // 1. Najít relevantní odečty pro tuto službu a jednotku
      const unitReadings = unit.meters
        .filter(m => m.serviceId === service.id || (service.name.includes('Teplo') && m.type === 'HEATING')) 
        .flatMap(m => m.readings);

      // Pokud existuje odečet s předvypočítaným nákladem (z Excelu), použijeme ho přímo
      const externalReading = unitReadings.find(r => r.precalculatedCost !== null && r.precalculatedCost > 0);

      if (externalReading && externalReading.precalculatedCost !== null) {
        calculatedCost = externalReading.precalculatedCost;
        basisText = "Převzato z externího rozúčtování";
        
        if (externalReading.consumption !== null) {
          consumption = externalReading.consumption;
          assignedUnits = consumption;
          if (consumption > 0) {
            unitPrice = calculatedCost / consumption;
          }
        }
      } else {
      switch (service.methodology) {
        
        case 'BY_SHARE': // Podle podílu
          if (totalShare > 0) {
            calculatedCost = safeNumber(serviceBuildingCost * (safeNumber(unit.share) / totalShare));
            basisText = `Podíl ${safeNumber(unit.share).toFixed(4)} / ${totalShare.toFixed(4)}`;
          } else {
            basisText = "Chyba: Celkový podíl je 0";
          }
          break;

        case 'BY_UNIT': // Na byt
          if (totalUnitsCount > 0) {
            calculatedCost = safeNumber(serviceBuildingCost / totalUnitsCount);
            basisText = `1 / ${totalUnitsCount} jednotek`;
          }
          break;

        case 'BY_PEOPLE': // Na osoby
          const unitPeople = 1; // Placeholder
          if (totalPeople > 0) {
            calculatedCost = safeNumber(serviceBuildingCost * (unitPeople / totalPeople));
            basisText = `${unitPeople} / ${totalPeople} osob`;
          }
          break;

        case 'EXTERNAL': // Externí (Teplo)
          // Najdeme náklad přímo u měřidla
          const externalReading = unit.meters
            .flatMap(m => m.readings)
            .find(r => r.precalculatedCost !== null && r.precalculatedCost > 0);

          if (externalReading && externalReading.precalculatedCost) {
            calculatedCost = safeNumber(externalReading.precalculatedCost);
            basisText = "Externí náklad (převzato)";
          }
          break;

        case 'BY_METER': // Voda
          const totalServiceCons = safeNumber(serviceTotalConsumptions.get(service.id));
          
          // Spotřeba jednotky
          const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV');
          const unitMeters = unit.meters.filter(m => isWater && (m.type === 'COLD_WATER' || m.type === 'HOT_WATER'));
          
          for (const m of unitMeters) {
            const r = m.readings[0];
            if (r) unitConsumption += safeNumber(r.consumption ?? r.value);
          }

          if (totalServiceCons > 0) {
            pricePerUnit = safeNumber(serviceBuildingCost / totalServiceCons);
            calculatedCost = safeNumber(unitConsumption * pricePerUnit);
            basisText = `${unitConsumption.toFixed(2)} m3 * ${pricePerUnit.toFixed(2)} Kč/m3`;
          } else {
             basisText = "Žádná celková spotřeba";
          }
          break;
          
        default:
          calculatedCost = 0;
          basisText = "Ruční/Neznámá metoda";
          break;
      }
      } // End of else block

      // 3. ZÁLOHY
      const serviceAdvances = safeNumber(advances
        .filter(a => a.unitId === unit.id && a.serviceId === service.id)
        .reduce((sum, a) => sum + a.amount, 0));

      const serviceBalance = safeNumber(serviceAdvances - calculatedCost);

      unitTotalCost += calculatedCost;
      unitTotalAdvance += serviceAdvances;

      serviceResults.push({
        serviceId: service.id,
        serviceName: service.name,
        method: service.calculationMethod,
        totalBuildingCost: serviceBuildingCost,
        unitCost: calculatedCost,
        unitConsumption: unitConsumption > 0 ? unitConsumption : undefined,
        pricePerUnit: pricePerUnit > 0 ? pricePerUnit : undefined,
        advancePaid: serviceAdvances,
        balance: serviceBalance,
        calculationBasis: basisText
      });
    }

    // 4. ULOŽENÍ VÝSLEDKU
    // ---------------------------------------------------------
    
    // Finální zaokrouhlení na celé Kč (jako v PDF)
    const finalBalance = Math.round(safeNumber(unitTotalAdvance - unitTotalCost));

    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        year: year,
        totalCost: safeNumber(unitTotalCost),
        totalAdvance: safeNumber(unitTotalAdvance),
        balance: finalBalance,
      }
    });

    // Uložení detailů (řádků vyúčtování)
    for (const res of serviceResults) {
      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: billingPeriod.id,
          billingResultId: billingResult.id,
          serviceId: res.serviceId,
          unitId: unit.id,
          
          buildingTotalCost: res.totalBuildingCost,
          unitCost: res.unitCost,
          unitAdvance: res.advancePaid,
          unitBalance: res.balance,
          
          unitConsumption: res.unitConsumption,
          unitPricePerUnit: res.pricePerUnit,
          
          calculationBasis: res.calculationBasis
        }
      });
    }
  }

  console.log(`✅ Výpočet dokončen pro ${units.length} jednotek.`);
  return { 
    success: true, 
    processedUnits: units.length,
    billingPeriod: billingPeriod
  };
}