import { CalculationMethod } from '@prisma/client';
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

// Helper pro parsování dataSourceName formátu "HOT_WATER:TUV1,TUV2+COLD_WATER:SV1"
// Vrací mapu: { HOT_WATER: ['TUV1', 'TUV2'], COLD_WATER: ['SV1'] }
function parseDataSourceName(dataSourceName: string | null | undefined): Map<string, string[] | null> {
  const result = new Map<string, string[] | null>();
  if (!dataSourceName) return result;
  
  const parts = dataSourceName.split('+');
  for (const part of parts) {
    if (part.includes(':')) {
      const [meterType, variantsStr] = part.split(':');
      const variants = variantsStr.split(',').map(v => v.trim()).filter(v => v);
      result.set(meterType.trim(), variants.length > 0 ? variants : null);
    } else {
      // Jen typ bez variant (např. "HEATING")
      result.set(part.trim(), null);
    }
  }
  return result;
}

const VARIANT_FALLBACK_ORDER: Record<string, string[]> = {
  HOT_WATER: ['TUV1', 'TUV2', 'TUV3', 'TUV4'],
  COLD_WATER: ['SV1', 'SV2', 'SV3', 'SV4']
};

function shouldIncludeReading(
  meterType: string | null | undefined,
  meterVariant: string | null | undefined,
  readingIndex: number,
  allowedVariants: string[] | null | undefined
): boolean {
  if (!meterType) return false;
  if (!allowedVariants) return true; // null -> všechny varianty
  if (allowedVariants.length === 0) return true;
  if (meterVariant) return allowedVariants.includes(meterVariant);

  const fallback = VARIANT_FALLBACK_ORDER[meterType] || [];
  const derivedVariant = fallback[readingIndex];
  if (!derivedVariant) return false;
  return allowedVariants.includes(derivedVariant);
}

function readingValue(reading: { consumption?: number | null; value?: number | null; precalculatedCost?: number | null }, useCost: boolean): number {
  if (useCost) return safeNumber(reading.precalculatedCost);
  return safeNumber(reading.consumption ?? reading.value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectReadingsByDataSource(meters: any[], dataSourceConfig: Map<string, string[] | null>) {
  const result: Array<{ meter: any; reading: any; readingIndex: number }> = [];
  if (dataSourceConfig.size === 0) return result;

  for (const meter of meters) {
    const variants = dataSourceConfig.get(meter.type);
    if (variants === undefined) continue;
    const readings = meter.readings || [];
    for (let idx = 0; idx < readings.length; idx++) {
      const reading = readings[idx];
      if (!reading) continue;
      if (shouldIncludeReading(meter.type, meter.variant, idx, variants)) {
        result.push({ meter, reading, readingIndex: idx });
      }
    }
  }

  return result;
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
            orderBy: [
              { readingDate: 'asc' },
              { createdAt: 'asc' },
              { id: 'asc' }
            ]
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
      
      // Parsování dataSourceName pro typ měřidla a varianty (např. "HOT_WATER:TUV1,TUV2+COLD_WATER")
      const dataSourceConfig = parseDataSourceName(service.dataSourceName);
      
      // Fallback na staré chování pokud není dataSourceName
      let targetMeterTypes: string[] = [];
      const useNewFiltering = dataSourceConfig.size > 0;
      
      if (!useNewFiltering) {
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
        if (useNewFiltering) {
          const readingContexts = collectReadingsByDataSource(u.meters, dataSourceConfig);
          for (const ctx of readingContexts) {
            totalCons += readingValue(ctx.reading, false);
          }
        } else {
          const uMeters = u.meters.filter((m: any) => targetMeterTypes.includes(m.type));
          for (const m of uMeters) {
            const r = m.readings[0];
            if (r) {
              totalCons += safeNumber(r.consumption ?? r.value);
            }
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

      // --- LOGIKA: EXTERNÍ NÁKLAD (pouze pokud je služba nastavena na použití nákladu) ---
      // Použijeme precalculatedCost pouze pokud dataSourceColumn === 'precalculatedCost'
      const usePrecalculatedCost = service.dataSourceColumn === 'precalculatedCost';
      
      // Najít relevantní odečty pro tuto službu a jednotku
      const unitReadings = unit.meters
        .filter(m => m.serviceId === service.id || (service.name.includes('Teplo') && m.type === 'HEATING')) 
        .flatMap(m => m.readings);

      // Pokud je nastaveno použití externího nákladu a existuje odečet s předvypočítaným nákladem
      const externalReading = unitReadings.find(r => r.precalculatedCost !== null && r.precalculatedCost > 0);

      if (usePrecalculatedCost && externalReading && externalReading.precalculatedCost !== null) {
        calculatedCost = externalReading.precalculatedCost;
        basisText = "Převzato z externího rozúčtování (Náklad)";
        
        if (externalReading.consumption !== null) {
          unitConsumption = externalReading.consumption;
          if (unitConsumption > 0) {
            pricePerUnit = calculatedCost / unitConsumption;
          }
        }
      } else {
      switch (service.methodology) {
        
        case 'OWNERSHIP_SHARE': { // Podle podílu
          const ownershipMonths = unitMonthsMap.get(unit.id) ?? 12;
          // Vážený podíl = podíl * (měsíce / 12)
          const weightedShare = safeNumber(unit.shareNumerator) * (ownershipMonths / 12);
          // Celkový vážený podíl pro všechny jednotky
          const totalWeightedShare = units.reduce((sum, u) => {
            const uMonths = unitMonthsMap.get(u.id) ?? 12;
            return sum + safeNumber(u.shareNumerator) * (uMonths / 12);
          }, 0);
          
          buildingConsumption = totalWeightedShare;
          unitConsumption = weightedShare;
          
          if (totalWeightedShare > 0) {
            pricePerUnit = serviceBuildingCost / totalWeightedShare;
            calculatedCost = safeNumber(serviceBuildingCost * (weightedShare / totalWeightedShare));
            if (ownershipMonths < 12) {
              basisText = `Podíl ${safeNumber(unit.shareNumerator).toFixed(4)} * (${ownershipMonths}/12 měs.) / ${totalWeightedShare.toFixed(4)}`;
            } else {
              basisText = `Podíl ${safeNumber(unit.shareNumerator).toFixed(4)} / ${totalWeightedShare.toFixed(4)}`;
            }
          } else {
            basisText = "Chyba: Celkový podíl je 0";
          }
          break;
        }

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

        case 'AREA': { // Podle plochy
          const areaMonths = unitMonthsMap.get(unit.id) ?? 12;
          const usesChargeableArea = service.areaSource === 'CHARGEABLE_AREA';
          const unitArea = usesChargeableArea
            ? (unit.floorArea ?? unit.totalArea ?? 0)
            : (unit.totalArea || 0);
          
          // Vážená plocha = plocha * (měsíce / 12)
          const weightedArea = unitArea * (areaMonths / 12);
          // Celková vážená plocha
          const totalWeightedArea = units.reduce((sum, u) => {
            const uMonths = unitMonthsMap.get(u.id) ?? 12;
            const uArea = usesChargeableArea
              ? (u.floorArea ?? u.totalArea ?? 0)
              : (u.totalArea || 0);
            return sum + uArea * (uMonths / 12);
          }, 0);

          buildingConsumption = totalWeightedArea;
          unitConsumption = weightedArea;

          if (totalWeightedArea > 0) {
            pricePerUnit = serviceBuildingCost / totalWeightedArea;
            calculatedCost = safeNumber(serviceBuildingCost * (weightedArea / totalWeightedArea));
            if (areaMonths < 12) {
              basisText = `${usesChargeableArea ? 'Započ.' : 'Celk.'} plocha: ${unitArea.toFixed(2)} m² * (${areaMonths}/12 měs.)`;
            } else {
              basisText = `${usesChargeableArea ? 'Započitatelná' : 'Celková'} plocha: ${unitArea.toFixed(2)} m² / ${totalWeightedArea.toFixed(2)} m²`;
            }
          } else {
            basisText = 'Chybí data o ploše';
          }
          break;
        }

        case 'PERSON_MONTHS': // Na osoby - počítá se ze skutečných dat personMonths
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
              const customDataSourceConfig = parseDataSourceName(service.dataSourceName);
              const customReadings: Array<{ meter: any; reading: any; readingIndex?: number }> = [];
              if (customDataSourceConfig.size > 0) {
                customReadings.push(...collectReadingsByDataSource(unit.meters, customDataSourceConfig));
              } else {
                const isWater = service.name.toLowerCase().includes('vod') || service.name.includes('SV') || service.name.includes('TUV');
                if (isWater) {
                  const fallbackMeters = unit.meters.filter(m => (m.type === 'COLD_WATER' || m.type === 'HOT_WATER'));
                  for (const m of fallbackMeters) {
                    const r = m.readings[0];
                    if (r) customReadings.push({ meter: m, reading: r, readingIndex: 0 });
                  }
                }
              }
              for (const ctx of customReadings) {
                variables.UNIT_CONSUMPTION += readingValue(ctx.reading, false);
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

        case 'UNIT_PARAMETER': {
          const paramName = service.unitAttributeName;
          if (paramName) {
             const paramMonths = unitMonthsMap.get(unit.id) ?? 12;
             
             // Vážený parametr = hodnota * (měsíce / 12)
             const unitParam = unit.parameters?.find(p => p.name === paramName);
             const unitValue = unitParam ? unitParam.value : 0;
             const weightedValue = unitValue * (paramMonths / 12);
             
             // Celkový vážený parametr
             const totalWeightedParam = units.reduce((sum, u) => {
                const uMonths = unitMonthsMap.get(u.id) ?? 12;
                const p = u.parameters?.find(p => p.name === paramName);
                return sum + (p ? p.value : 0) * (uMonths / 12);
             }, 0);
             
             buildingConsumption = totalWeightedParam;
             unitConsumption = weightedValue;

             if (totalWeightedParam > 0) {
               pricePerUnit = serviceBuildingCost / totalWeightedParam;
               calculatedCost = safeNumber(serviceBuildingCost * (weightedValue / totalWeightedParam));
               if (paramMonths < 12) {
                 basisText = `${paramName}: ${unitValue} * (${paramMonths}/12 měs.) / ${totalWeightedParam.toFixed(2)}`;
               } else {
                 basisText = `${paramName}: ${unitValue} / ${totalWeightedParam.toFixed(0)}`;
               }
             } else {
               basisText = `Chyba: Celková hodnota parametru ${paramName} je 0`;
             }
          } else {
             basisText = "Chyba: Není vybrán parametr";
          }
          break;
        }

        case 'METER_READING': // Voda
          const totalServiceCons = safeNumber(serviceTotalConsumptions.get(service.id));
          buildingConsumption = totalServiceCons;
          
          // Spotřeba jednotky - parsování dataSourceName pro typ měřidla a varianty
          const meterDataSourceConfig = parseDataSourceName(service.dataSourceName);
          
          const selectedReadings: Array<{ meter: any; reading: any; readingIndex: number }> = [];
          if (meterDataSourceConfig.size > 0) {
            selectedReadings.push(...collectReadingsByDataSource(unit.meters, meterDataSourceConfig));
          } else {
            // Fallback na staré chování
            let targetMeterTypes: string[] = [];
            const nameLower = service.name.toLowerCase();
            const isWater = nameLower.includes('vod') || 
                           (service.name.includes('SV') && !service.name.includes('SVJ')) || 
                           service.name.includes('TUV');
            
            if (isWater) targetMeterTypes = ['COLD_WATER', 'HOT_WATER'];
            if (nameLower.includes('teplo')) targetMeterTypes.push('HEATING');
            if (nameLower.includes('elek')) targetMeterTypes.push('ELECTRICITY');
            
            const fallbackMeters = unit.meters.filter((m: any) => targetMeterTypes.includes(m.type));
            for (const m of fallbackMeters) {
              const r = m.readings[0];
              if (r) selectedReadings.push({ meter: m, reading: r, readingIndex: 0 });
            }
          }
          
          // Popisek pro basis
          const meterTypesDescription = Array.from(meterDataSourceConfig.entries())
            .map(([type, variants]) => variants ? `${type}:${variants.join(',')}` : type)
            .join('+') || 'auto';
          
           if (service.dataSourceColumn === 'precalculatedCost') {
             let totalCost = 0;
             for (const ctx of selectedReadings) {
               totalCost += readingValue(ctx.reading, true);
             }
             calculatedCost = totalCost;
             basisText = `Součet nákladů z měřidel (${meterTypesDescription})`;
          } else {
             for (const ctx of selectedReadings) {
              unitConsumption += readingValue(ctx.reading, false);
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