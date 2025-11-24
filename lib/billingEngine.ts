import { PrismaClient, CalculationMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface ServiceCalculationResult {
  serviceId: string;
  serviceName: string;
  method: CalculationMethod;
  totalBuildingCost: number; // Celkový náklad za dům
  buildingConsumption?: number; // Celková spotřeba/počet jednotek domu
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

  // Načtení budovy pro globální parametry
  const building = await prisma.building.findUnique({
    where: { id: buildingId }
  });

  if (!building) throw new Error(`Building ${buildingId} not found`);

  // B. Načtení jednotek včetně měřidel a náměrů
  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: {
      ownerships: true,
      parameters: true,
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

  // Pre-kalkulace měsíců v evidenci pro každou jednotku
  const unitMonthsMap = new Map<string, number>();
  let totalUnitMonths = 0;

  for (const unit of units) {
    let months = 0;
    const relevantOwnerships = unit.ownerships.filter(o => {
       const start = o.validFrom;
       const end = o.validTo || new Date('2100-01-01');
       const yearStart = new Date(year, 0, 1);
       const yearEnd = new Date(year, 11, 31);
       return start <= yearEnd && end >= yearStart;
    });

    if (relevantOwnerships.length === 0) {
      months = 12; // Default plný rok, pokud není záznam
    } else {
      const coveredMonths = new Set<number>();
      for (const o of relevantOwnerships) {
        const start = o.validFrom < new Date(year, 0, 1) ? new Date(year, 0, 1) : o.validFrom;
        const end = (!o.validTo || o.validTo > new Date(year, 11, 31)) ? new Date(year, 11, 31) : o.validTo;
        
        if (start > end) continue;

        const startMonth = start.getMonth();
        const endMonth = end.getMonth();
        
        for (let m = startMonth; m <= endMonth; m++) {
          coveredMonths.add(m);
        }
      }
      months = coveredMonths.size;
    }
    unitMonthsMap.set(unit.id, months);
    totalUnitMonths += months;
  }

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
  const totalShare = safeNumber(units.reduce((sum, u) => sum + (u.shareNumerator || 0), 0));
  const totalUnitsCount = building.unitCountOverride || units.length;
  
  // Počet osob - priorita: 1. Globální nastavení budovy, 2. Součet osob v jednotkách, 3. Počet jednotek (fallback)
  const totalPeople = building.totalPeople || units.reduce((sum, u) => sum + (u.residents || 0), 0) || units.length; 

  // Plochy
  const totalArea = building.totalArea || units.reduce((sum, u) => sum + (u.totalArea || 0), 0);
  const totalChargeableArea = building.chargeableArea || units.reduce((sum, u) => sum + (u.floorArea || 0), 0); 

  // F. PŘEDVÝPOČET SPOTŘEB (Pro BY_METER a CUSTOM)
  // Musíme znát celkovou spotřebu domu PRO KAŽDOU SLUŽBU, abychom spočítali cenu za jednotku.
  const serviceTotalConsumptions = new Map<string, number>();

  for (const service of services) {
    if (service.methodology === 'METER_READING' || service.methodology === 'CUSTOM') {
      let totalCons = 0;
      
      // Pokud je explicitně určen typ měřidla (dataSourceName), použijeme ho.
      // Jinak fallback na hádání podle názvu.
      let targetMeterTypes: string[] = [];
      
      if (service.dataSourceName) {
        targetMeterTypes = [service.dataSourceName];
      } else {
        const nameLower = service.name.toLowerCase();
        // Přísnější detekce pro vodu - vyloučit SVJ
        const isWater = nameLower.includes('vod') || 
                       (service.name.includes('SV') && !service.name.includes('SVJ')) || 
                       service.name.includes('TUV');
                       
        if (isWater) targetMeterTypes = ['COLD_WATER', 'HOT_WATER'];
        if (nameLower.includes('teplo')) targetMeterTypes.push('HEATING');
        if (nameLower.includes('elek')) targetMeterTypes.push('ELECTRICITY');
      }
      
      for (const u of units) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const uMeters = u.meters.filter((m: any) => targetMeterTypes.includes(m.type));
         for (const m of uMeters) {
           const r = m.readings[0];
           if (r) {
             // Pokud máme consumption (rozdíl), použijeme. Jinak value (pokud je to roční spotřeba).
             totalCons += safeNumber(r.consumption ?? r.value);
           }
        }
      }
      serviceTotalConsumptions.set(service.id, safeNumber(totalCons));
      if (totalCons > 0) {
        console.log(`💧 Celková spotřeba pro službu ${service.name}: ${totalCons}`);
      }
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
      let buildingConsumption = 0;
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
          unitConsumption = externalReading.consumption;
          if (unitConsumption > 0) {
            pricePerUnit = calculatedCost / unitConsumption;
          }
        }
      } else {
      switch (service.methodology) {
        
        case 'OWNERSHIP_SHARE': // Podle podílu
          buildingConsumption = totalShare;
          unitConsumption = safeNumber(unit.shareNumerator);
          if (totalShare > 0) {
            pricePerUnit = serviceBuildingCost / totalShare;
            calculatedCost = safeNumber(serviceBuildingCost * (safeNumber(unit.shareNumerator) / totalShare));
            basisText = `Podíl ${safeNumber(unit.shareNumerator).toFixed(4)} / ${totalShare.toFixed(4)}`;
          } else {
            basisText = "Chyba: Celkový podíl je 0";
          }
          break;

        case 'FIXED_PER_UNIT': // Na byt
          const monthsInEvidence = unitMonthsMap.get(unit.id) ?? 12;
          unitConsumption = monthsInEvidence;
          
          if (service.fixedAmountPerUnit) {
            // Fixní částka * (měsíce / 12)
            buildingConsumption = 0; // Není relevantní pro fixní částku
            pricePerUnit = service.fixedAmountPerUnit;
            calculatedCost = service.fixedAmountPerUnit * (monthsInEvidence / 12);
            basisText = `Fixní částka ${service.fixedAmountPerUnit} Kč * (${monthsInEvidence}/12 měs.)`;
          } else if (totalUnitMonths > 0) {
            // Rozpočítání celkového nákladu podle měsíců (aby se rozdělilo 100%)
            buildingConsumption = totalUnitMonths;
            pricePerUnit = serviceBuildingCost / totalUnitMonths;
            calculatedCost = safeNumber(serviceBuildingCost * (monthsInEvidence / totalUnitMonths));
            basisText = `Podíl měsíců: ${monthsInEvidence} / ${totalUnitMonths} (z celku)`;
          } else if (totalUnitsCount > 0) {
            buildingConsumption = totalUnitsCount;
            unitConsumption = 1;
            pricePerUnit = serviceBuildingCost / totalUnitsCount;
            calculatedCost = safeNumber(serviceBuildingCost / totalUnitsCount);
            basisText = `1 / ${totalUnitsCount} jednotek`;
          }
          break;

        case 'EQUAL_SPLIT':    // Rovným dílem
          const uMonths = unitMonthsMap.get(unit.id) ?? 12;
          const divisor = service.divisor || totalUnitsCount;
          
          if (service.divisor) {
            // Pokud je zadán ruční dělitel: (Náklad / Dělitel) * (Měsíce / 12)
            buildingConsumption = divisor;
            unitConsumption = uMonths / 12; // Přepočtená jednotka
            pricePerUnit = serviceBuildingCost / divisor;
            
            const costPerUnitFullYear = serviceBuildingCost / divisor;
            calculatedCost = safeNumber(costPerUnitFullYear * (uMonths / 12));
            basisText = `(Náklad / ${divisor}) * (${uMonths}/12 měs.)`;
          } else if (totalUnitMonths > 0) {
            // Pokud není dělitel, rozpočítáme podle měsíců (jako FIXED_PER_UNIT)
            buildingConsumption = totalUnitMonths;
            unitConsumption = uMonths;
            pricePerUnit = serviceBuildingCost / totalUnitMonths;
            
            calculatedCost = safeNumber(serviceBuildingCost * (uMonths / totalUnitMonths));
            basisText = `Podíl měsíců: ${uMonths} / ${totalUnitMonths}`;
          } else {
            basisText = "Chyba: Žádné měsíce v evidenci";
          }
          break;

        case 'AREA': // Podle plochy
          const unitArea = unit.totalArea || 0;
          buildingConsumption = totalArea;
          unitConsumption = unitArea;
          
          if (totalArea > 0) {
            pricePerUnit = serviceBuildingCost / totalArea;
            calculatedCost = safeNumber(serviceBuildingCost * (unitArea / totalArea));
            basisText = `${unitArea.toFixed(2)} m² / ${totalArea.toFixed(2)} m²`;
          }
          break;

        case 'PERSON_MONTHS': // Na osoby
          const unitPeople = unit.residents || 0;
          buildingConsumption = totalPeople;
          unitConsumption = unitPeople;
          
          if (totalPeople > 0) {
            pricePerUnit = serviceBuildingCost / totalPeople;
            calculatedCost = safeNumber(serviceBuildingCost * (unitPeople / totalPeople));
            basisText = `${unitPeople} / ${totalPeople} osob`;
          }
          break;

        case 'CUSTOM': // Vlastní vzorec
          if (service.customFormula) {
            try {
              // Proměnné pro vzorec
              const variables = {
                TOTAL_COST: serviceBuildingCost,
                UNIT_SHARE: unit.shareDenominator ? (unit.shareNumerator / unit.shareDenominator) : 0,
                UNIT_AREA: unit.totalArea || 0,
                UNIT_PEOPLE: unit.residents || 0,
                UNIT_CONSUMPTION: 0, // Bude doplněno níže pokud existuje
                TOTAL_CONSUMPTION: safeNumber(serviceTotalConsumptions.get(service.id))
              };

              // Pokus o získání spotřeby pro vzorec
              const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV');
              if (isWater) {
                const unitMeters = unit.meters.filter(m => (m.type === 'COLD_WATER' || m.type === 'HOT_WATER'));
                for (const m of unitMeters) {
                  const r = m.readings[0];
                  if (r) variables.UNIT_CONSUMPTION += safeNumber(r.consumption ?? r.value);
                }
              }
              
              unitConsumption = variables.UNIT_CONSUMPTION;
              buildingConsumption = variables.TOTAL_CONSUMPTION;
              if (buildingConsumption > 0) {
                 pricePerUnit = serviceBuildingCost / buildingConsumption;
              }

              // Vyhodnocení vzorce
              // Nahrazení proměnných hodnotami
              let formula = service.customFormula;
              Object.entries(variables).forEach(([key, val]) => {
                formula = formula.replace(new RegExp(key, 'g'), String(val));
              });
              
              // Bezpečnější eval
              calculatedCost = safeNumber(new Function('return ' + formula)());
              basisText = `Vzorec: ${service.customFormula}`;
            } catch (e) {
              calculatedCost = 0;
              basisText = `Chyba vzorce: ${e instanceof Error ? e.message : 'Unknown'}`;
            }
          } else {
            // Pokud není vzorec, a nezafungovala "Nová logika" nahoře (protože není spárovaný měřák),
            // tak je náklad 0. Stará logika brala jakýkoliv měřák, což způsobovalo chyby.
            calculatedCost = 0;
            basisText = "Vlastní metoda bez vzorce";
          }
          break;

        case 'UNIT_PARAMETER':
          const paramName = service.unitAttributeName;
          if (paramName) {
             // Calculate total for this parameter across all units
             const totalParamValue = units.reduce((sum, u) => {
                const p = u.parameters?.find(p => p.name === paramName);
                return sum + (p ? p.value : 0);
             }, 0);

             const unitParam = unit.parameters?.find(p => p.name === paramName);
             const unitValue = unitParam ? unitParam.value : 0;
             
             buildingConsumption = totalParamValue;
             unitConsumption = unitValue;

             if (totalParamValue > 0) {
               pricePerUnit = serviceBuildingCost / totalParamValue;
               calculatedCost = safeNumber(serviceBuildingCost * (unitValue / totalParamValue));
               basisText = `${paramName}: ${unitValue} / ${totalParamValue}`;
             } else {
               basisText = `Chyba: Celková hodnota parametru ${paramName} je 0`;
             }
          } else {
             basisText = "Chyba: Není vybrán parametr";
          }
          break;

        case 'METER_READING': // Voda
          const totalServiceCons = safeNumber(serviceTotalConsumptions.get(service.id));
          buildingConsumption = totalServiceCons;
          
          // Spotřeba jednotky
          let targetMeterTypes: string[] = [];
          if (service.dataSourceName) {
            targetMeterTypes = [service.dataSourceName];
          } else {
            const nameLower = service.name.toLowerCase();
            const isWater = nameLower.includes('vod') || 
                           (service.name.includes('SV') && !service.name.includes('SVJ')) || 
                           service.name.includes('TUV');
                           
            if (isWater) targetMeterTypes = ['COLD_WATER', 'HOT_WATER'];
            if (nameLower.includes('teplo')) targetMeterTypes.push('HEATING');
            if (nameLower.includes('elek')) targetMeterTypes.push('ELECTRICITY');
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unitMeters = unit.meters.filter((m: any) => targetMeterTypes.includes(m.type));
          
          if (service.dataSourceType === 'FIXED_AMOUNT') {
             // Varianta "Náklad" - sčítáme precalculatedCost z měřidel
             let totalCost = 0;
             for (const m of unitMeters) {
                const r = m.readings[0];
                if (r && r.precalculatedCost) {
                   totalCost += safeNumber(r.precalculatedCost);
                }
             }
             calculatedCost = totalCost;
             basisText = `Součet nákladů z měřidel (${targetMeterTypes.join(', ')})`;
          } else {
             // Varianta "Náměr" - sčítáme spotřebu a násobíme cenou
             for (const m of unitMeters) {
               const r = m.readings[0];
               if (r) unitConsumption += safeNumber(r.consumption ?? r.value);
             }

             if (service.unitPrice) {
               // Pokud je zadána jednotková cena, použijeme ji prioritně
               pricePerUnit = service.unitPrice;
               calculatedCost = safeNumber(unitConsumption * pricePerUnit);
               basisText = `${unitConsumption.toFixed(2)} m3 * ${pricePerUnit.toFixed(2)} Kč/m3 (fixní cena)`;
             } else if (totalServiceCons > 0) {
               // Jinak dopočítáme z celkového nákladu
               pricePerUnit = safeNumber(serviceBuildingCost / totalServiceCons);
               calculatedCost = safeNumber(unitConsumption * pricePerUnit);
               basisText = `${unitConsumption.toFixed(2)} m3 * ${pricePerUnit.toFixed(2)} Kč/m3`;
             } else {
                basisText = "Žádná celková spotřeba ani fixní cena";
             }
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
        method: service.methodology,
        totalBuildingCost: serviceBuildingCost,
        buildingConsumption: buildingConsumption > 0 ? buildingConsumption : undefined,
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

    // Výpočet měsíčních předpisů pro uložení do JSON
    const monthlyPrescriptions = new Array(12).fill(0);
    const unitAdvances = advances.filter(a => a.unitId === unit.id);
    
    for (const adv of unitAdvances) {
       if (adv.month >= 1 && adv.month <= 12) {
          monthlyPrescriptions[adv.month - 1] += adv.amount;
       }
    }

    // Fallback pro stará data (pokud existují jen záznamy s month=0)
    const sumMonthly = monthlyPrescriptions.reduce((a, b) => a + b, 0);
    if (sumMonthly === 0 && unitTotalAdvance > 0) {
       const monthlyAvg = unitTotalAdvance / 12;
       for (let i = 0; i < 12; i++) monthlyPrescriptions[i] = monthlyAvg;
    }

    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        totalCost: safeNumber(unitTotalCost),
        totalAdvancePrescribed: safeNumber(unitTotalAdvance),
        totalAdvancePaid: safeNumber(unitTotalAdvance),
        result: finalBalance,
        monthlyPrescriptions: monthlyPrescriptions,
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
          buildingConsumption: res.buildingConsumption, // Uložení celkové spotřeby/jednotek domu
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