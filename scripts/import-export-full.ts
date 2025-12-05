/**
 * import-export-full.ts
 * 
 * Importér "Master Export" souboru EXPORT_FULL.csv z Office Scripts
 * Tento skript konvertuje denormalizovaný CSV export do strukturovaných dat pro PDF vyúčtování
 * 
 * Použití:
 *   npx tsx scripts/import-export-full.ts <cesta-k-csv> <název-budovy> <rok>
 *   npx tsx scripts/import-export-full.ts ./EXPORT_FULL.csv "Kníničky 318" 2024
 * 
 * Struktura CSV:
 *   - UnitName: ID jednotky
 *   - DataType: INFO | COST | METER | PAYMENT_MONTHLY | ADVANCE_MONTHLY | FIXED_PAYMENT
 *   - Key: Název položky/služby
 *   - Val1-Val13: Hodnoty (čísla, texty, nebo #N/A)
 *   - SourceRow: Odkaz na řádek v Excelu (pro debugging)
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// TYPY
// ============================================================================

interface CsvRow {
  UnitName: string;
  DataType: 'INFO' | 'COST' | 'METER' | 'PAYMENT_MONTHLY' | 'ADVANCE_MONTHLY' | 'FIXED_PAYMENT';
  Key: string;
  Val1: string;
  Val2: string;
  Val3: string;
  Val4: string;
  Val5: string;
  Val6: string;
  Val7: string;
  Val8: string;
  Val9: string;
  Val10: string;
  Val11: string;
  Val12: string;
  Val13: string;
  SourceRow: string;
}

interface UnitInfo {
  owner: string;
  variableSymbol: string;
  email: string;
  totalResult: number;
  bankAccount: string;
}

interface BillingService {
  name: string;
  buildingTotalCost: number;
  unitCost: number;
  unitAdvance: number;
  unitBalance: number;
  distributionShare: string;
  details: {
    unit: string;              // Val5 - Jednotka (m², m³, os)
    buildingUnits: string;     // Val6 - Počet jednotek za dům
    unitPrice: string;         // Val7 - Cena za jednotku
    unitUnits: string;         // Val8 - Spotřeba/podíl bytu
    calculationMethod: string; // Val9 - Metodika
  };
  meters: MeterReading[];
}

interface MeterReading {
  serial: string;
  start: number;
  end: number;
  consumption: number;
}

interface MonthlyData {
  payments: number[];      // 12 měsíců úhrad
  advances: number[];      // 12 měsíců předpisů
}

interface UnitBillingData {
  unitName: string;
  info: UnitInfo;
  services: BillingService[];
  fixedPayments: Array<{ name: string; amount: number }>;
  monthlyData: MonthlyData;
}

// ============================================================================
// POMOCNÉ FUNKCE - ČIŠTĚNÍ DAT
// ============================================================================

/**
 * Vyčistí a parsuje české číslo z Excel exportu
 * Vstup: "1 250,50 Kč", "-500", "#N/A", null, ""
 * Výstup: number nebo 0
 */
function parseCzechNumber(value: string | null | undefined): number {
  if (!value) return 0;
  
  const str = value.toString().trim();
  
  // Excel chyby - všechny varianty
  if (
    str === '' ||
    str === '-' ||
    str === '—' ||
    str.startsWith('#') ||
    str.toUpperCase().includes('NENÍ_K_DISPOZICI') ||
    str.toUpperCase().includes('NENI_K_DISPOZICI') ||
    str.toUpperCase() === 'N/A' ||
    str.toUpperCase().includes('ERROR') ||
    str.toUpperCase().includes('CHYBA')
  ) {
    return 0;
  }
  
  // Odstranění měny, jednotek a mezer
  let cleaned = str
    .replace(/\s*Kč\s*/gi, '')
    .replace(/\s*m[²³]?\s*/gi, '')
    .replace(/\s*kWh\s*/gi, '')
    .replace(/\s*GJ\s*/gi, '')
    .replace(/\s*os\s*/gi, '')
    .replace(/\s/g, '');  // všechny mezery
  
  // České číslo: "1250,50" → "1250.50"
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Vyčistí textovou hodnotu, ale zachová formátování (pro Val6-Val9)
 * Nekonvertuje na číslo - vrací string
 */
function cleanTextValue(value: string | null | undefined): string {
  if (!value) return '';
  
  const str = value.toString().trim();
  
  // Excel chyby
  if (
    str === '' ||
    str === '-' ||
    str.startsWith('#') ||
    str.toUpperCase().includes('NENÍ_K_DISPOZICI') ||
    str.toUpperCase() === 'N/A'
  ) {
    return '';
  }
  
  return str;
}

/**
 * Normalizuje název služby na kód (pro hledání v DB)
 */
function normalizeServiceCode(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

// ============================================================================
// AGREGACE DAT - Seskupení podle jednotek
// ============================================================================

/**
 * Hlavní agregační funkce - převede plochý CSV na Map<UnitName, UnitBillingData>
 */
function aggregateUnitData(rows: CsvRow[]): Map<string, UnitBillingData> {
  const unitsMap = new Map<string, UnitBillingData>();
  
  for (const row of rows) {
    const unitName = row.UnitName;
    if (!unitName || unitName === '0') continue;
    
    // Inicializace jednotky, pokud ještě neexistuje
    if (!unitsMap.has(unitName)) {
      unitsMap.set(unitName, {
        unitName,
        info: {
          owner: '',
          variableSymbol: '',
          email: '',
          totalResult: 0,
          bankAccount: ''
        },
        services: [],
        fixedPayments: [],
        monthlyData: {
          payments: Array(12).fill(0),
          advances: Array(12).fill(0)
        }
      });
    }
    
    const unitData = unitsMap.get(unitName)!;
    
    // Zpracování podle DataType
    switch (row.DataType) {
      case 'INFO':
        processInfoRow(row, unitData);
        break;
      
      case 'COST':
        processCostRow(row, unitData);
        break;
      
      case 'METER':
        processMeterRow(row, unitData);
        break;
      
      case 'PAYMENT_MONTHLY':
        processPaymentMonthlyRow(row, unitData);
        break;
      
      case 'ADVANCE_MONTHLY':
        processAdvanceMonthlyRow(row, unitData);
        break;
      
      case 'FIXED_PAYMENT':
        processFixedPaymentRow(row, unitData);
        break;
    }
  }
  
  return unitsMap;
}

/**
 * Zpracování řádku INFO (základní údaje o jednotce)
 */
function processInfoRow(row: CsvRow, unitData: UnitBillingData): void {
  unitData.info = {
    owner: cleanTextValue(row.Val1),
    variableSymbol: cleanTextValue(row.Val2),
    email: cleanTextValue(row.Val3),
    totalResult: parseCzechNumber(row.Val4),
    bankAccount: cleanTextValue(row.Val5)
  };
}

/**
 * Zpracování řádku COST (náklady služby)
 * Mapování:
 *   Val1 = DistributionShare (Podíl %)
 *   Val2 = UnitUnits (Jednotky - počet osob, jednotky apod.)
 *   Val3 = UnitCost (Náklad byt Kč)
 *   Val4 = UnitAdvance (Záloha byt Kč)
 *   Val5 = (volné)
 *   Val6 = BuildingTotalCost (Náklad dům Kč)
 *   Val7 = BuildingUnits (Počet jednotek za dům)
 *   Val8 = UnitPrice (Cena za jednotku)
 *   Val9 = CalculationMethod (Metodika)
 */
function processCostRow(row: CsvRow, unitData: UnitBillingData): void {
  const serviceName = cleanTextValue(row.Key);
  if (!serviceName) return;
  
  const service: BillingService = {
    name: serviceName,
    buildingTotalCost: parseCzechNumber(row.Val6),
    unitCost: parseCzechNumber(row.Val3),
    unitAdvance: parseCzechNumber(row.Val4),
    unitBalance: parseCzechNumber(row.Val3) - parseCzechNumber(row.Val4),
    distributionShare: cleanTextValue(row.Val1), // Podíl %
    details: {
      unit: cleanTextValue(row.Val9),
      buildingUnits: cleanTextValue(row.Val7),
      unitPrice: cleanTextValue(row.Val8),
      unitUnits: cleanTextValue(row.Val2),
      calculationMethod: cleanTextValue(row.Val9)
    },
    meters: []
  };
  
  unitData.services.push(service);
}

/**
 * Zpracování řádku METER (odečty měřidel)
 * Přiřazení k odpovídající službě podle Key (název služby)
 */
function processMeterRow(row: CsvRow, unitData: UnitBillingData): void {
  const serviceName = cleanTextValue(row.Key);
  if (!serviceName) return;
  
  const meter: MeterReading = {
    serial: cleanTextValue(row.Val1),
    start: parseCzechNumber(row.Val2),
    end: parseCzechNumber(row.Val3),
    consumption: parseCzechNumber(row.Val4)
  };
  
  // Najít odpovídající službu a přidat měřidlo
  const service = unitData.services.find(s => 
    s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
    serviceName.toLowerCase().includes(s.name.toLowerCase())
  );
  
  if (service) {
    service.meters.push(meter);
  } else {
    console.warn(`⚠️  Měřidlo "${serviceName}" nemá odpovídající službu pro ${unitData.unitName}`);
  }
}

/**
 * Zpracování PAYMENT_MONTHLY (měsíční úhrady)
 * Val1-Val12 = měsíce 1-12
 */
function processPaymentMonthlyRow(row: CsvRow, unitData: UnitBillingData): void {
  unitData.monthlyData.payments = [
    parseCzechNumber(row.Val1),
    parseCzechNumber(row.Val2),
    parseCzechNumber(row.Val3),
    parseCzechNumber(row.Val4),
    parseCzechNumber(row.Val5),
    parseCzechNumber(row.Val6),
    parseCzechNumber(row.Val7),
    parseCzechNumber(row.Val8),
    parseCzechNumber(row.Val9),
    parseCzechNumber(row.Val10),
    parseCzechNumber(row.Val11),
    parseCzechNumber(row.Val12)
  ];
}

/**
 * Zpracování ADVANCE_MONTHLY (měsíční předpisy)
 * Val1-Val12 = měsíce 1-12
 */
function processAdvanceMonthlyRow(row: CsvRow, unitData: UnitBillingData): void {
  unitData.monthlyData.advances = [
    parseCzechNumber(row.Val1),
    parseCzechNumber(row.Val2),
    parseCzechNumber(row.Val3),
    parseCzechNumber(row.Val4),
    parseCzechNumber(row.Val5),
    parseCzechNumber(row.Val6),
    parseCzechNumber(row.Val7),
    parseCzechNumber(row.Val8),
    parseCzechNumber(row.Val9),
    parseCzechNumber(row.Val10),
    parseCzechNumber(row.Val11),
    parseCzechNumber(row.Val12)
  ];
}

/**
 * Zpracování FIXED_PAYMENT (pevné platby / fond oprav)
 * Val1 = částka
 */
function processFixedPaymentRow(row: CsvRow, unitData: UnitBillingData): void {
  const name = cleanTextValue(row.Key);
  const amount = parseCzechNumber(row.Val1);
  
  if (name && amount !== 0) {
    unitData.fixedPayments.push({ name, amount });
  }
}

// ============================================================================
// IMPORT DO DATABÁZE
// ============================================================================

/**
 * Hlavní import funkce - uloží agregovaná data do databáze
 */
async function importToDatabase(
  unitsData: Map<string, UnitBillingData>,
  buildingName: string,
  year: number
) {
  console.log(`\n📊 Začínám import pro budovu "${buildingName}", rok ${year}`);
  
  // 1) Najít nebo vytvořit budovu
  let building = await prisma.building.findFirst({
    where: { name: buildingName }
  });
  
  if (!building) {
    console.log(`🏗️  Vytvářím novou budovu: ${buildingName}`);
    building = await prisma.building.create({
      data: {
        name: buildingName,
        address: '',
        city: '',
        zip: ''
      }
    });
  }
  
  console.log(`✅ Budova: ${building.name} (ID: ${building.id})`);
  
  // 2) Najít nebo vytvořit vyúčtovací období
  let billingPeriod = await prisma.billingPeriod.findFirst({
    where: {
      buildingId: building.id,
      year
    }
  });
  
  if (!billingPeriod) {
    console.log(`📅 Vytvářím vyúčtovací období pro rok ${year}`);
    billingPeriod = await prisma.billingPeriod.create({
      data: {
        buildingId: building.id,
        year,
        startDate: new Date(`${year}-01-01`),
        endDate: new Date(`${year}-12-31`),
        name: `Vyúčtování ${year}`
      }
    });
  }
  
  console.log(`✅ Vyúčtovací období: ${billingPeriod.name} (ID: ${billingPeriod.id})`);
  
  // 3) Import jednotek a dat
  let importedCount = 0;
  let errorCount = 0;
  
  for (const [unitName, unitData] of unitsData) {
    try {
      await importUnitData(building.id, billingPeriod.id, unitName, unitData, year);
      importedCount++;
      
      if (importedCount % 10 === 0) {
        console.log(`   ... zpracováno ${importedCount}/${unitsData.size} jednotek`);
      }
    } catch (error) {
      console.error(`❌ Chyba při importu jednotky ${unitName}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Import dokončen!`);
  console.log(`   📦 Úspěšně: ${importedCount} jednotek`);
  console.log(`   ❌ Chyby: ${errorCount} jednotek`);
}

/**
 * Import dat jedné jednotky
 */
async function importUnitData(
  buildingId: string,
  billingPeriodId: string,
  unitName: string,
  unitData: UnitBillingData,
  year: number
) {
  // 1) Najít nebo vytvořit jednotku
  let unit = await prisma.unit.findFirst({
    where: {
      buildingId,
      unitNumber: unitName
    }
  });
  
  if (!unit) {
    // Vytvořit novou jednotku s výchozími hodnotami
    unit = await prisma.unit.create({
      data: {
        buildingId,
        unitNumber: unitName,
        shareNumerator: 1,
        shareDenominator: 100,
        totalArea: 0,
        variableSymbol: unitData.info.variableSymbol || undefined,
        bankAccount: unitData.info.bankAccount || undefined
      }
    });
  } else {
    // Aktualizovat variabilní symbol a účet
    if (unitData.info.variableSymbol || unitData.info.bankAccount) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          variableSymbol: unitData.info.variableSymbol || undefined,
          bankAccount: unitData.info.bankAccount || undefined
        }
      });
    }
  }
  
  // 2) Najít nebo vytvořit vlastníka
  if (unitData.info.owner) {
    const [firstName, ...lastNameParts] = unitData.info.owner.split(' ');
    const lastName = lastNameParts.join(' ') || firstName;
    
    let owner = await prisma.owner.findFirst({
      where: {
        firstName,
        lastName
      }
    });
    
    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          firstName,
          lastName,
          email: unitData.info.email || undefined,
          bankAccount: unitData.info.bankAccount || undefined
        }
      });
    }
    
    // Vytvořit ownership záznam (pokud neexistuje)
    const ownership = await prisma.ownership.findFirst({
      where: {
        unitId: unit.id,
        ownerId: owner.id,
        validTo: null
      }
    });
    
    if (!ownership) {
      await prisma.ownership.create({
        data: {
          unitId: unit.id,
          ownerId: owner.id,
          validFrom: new Date(`${year}-01-01`),
          sharePercent: 100
        }
      });
    }
  }
  
  // 3) Import služeb a nákladů
  for (const serviceData of unitData.services) {
    await importServiceCost(buildingId, billingPeriodId, unit.id, serviceData);
  }
  
  // 4) Import pevných plateb
  for (const fixedPayment of unitData.fixedPayments) {
    await importFixedPayment(buildingId, billingPeriodId, unit.id, fixedPayment);
  }
  
  // 5) Import měsíčních plateb
  await importMonthlyPayments(unit.id, year, unitData.monthlyData.payments);
  
  // 6) Import měsíčních předpisů (záloh)
  await importMonthlyAdvances(buildingId, unit.id, year, unitData.monthlyData.advances);
  
  // 7) Vytvořit BillingResult
  await prisma.billingResult.upsert({
    where: {
      billingPeriodId_unitId: {
        billingPeriodId,
        unitId: unit.id
      }
    },
    update: {
      totalResult: unitData.info.totalResult
    },
    create: {
      billingPeriodId,
      unitId: unit.id,
      totalAdvance: unitData.monthlyData.advances.reduce((a, b) => a + b, 0),
      totalCost: unitData.services.reduce((sum, s) => sum + s.unitCost, 0),
      totalResult: unitData.info.totalResult
    }
  });
}

/**
 * Import nákladů služby
 */
async function importServiceCost(
  buildingId: string,
  billingPeriodId: string,
  unitId: string,
  serviceData: BillingService
) {
  // Najít službu v DB
  const serviceCode = normalizeServiceCode(serviceData.name);
  
  let service = await prisma.service.findFirst({
    where: {
      buildingId,
      OR: [
        { code: serviceCode },
        { name: { contains: serviceData.name, mode: 'insensitive' } }
      ]
    }
  });
  
  if (!service) {
    // Vytvořit novou službu
    service = await prisma.service.create({
      data: {
        buildingId,
        code: serviceCode,
        name: serviceData.name,
        methodology: 'OWNERSHIP_SHARE' // výchozí
      }
    });
  }
  
  // Vytvořit BillingServiceCost
  await prisma.billingServiceCost.upsert({
    where: {
      billingPeriodId_unitId_serviceId: {
        billingPeriodId,
        unitId,
        serviceId: service.id
      }
    },
    update: {
      buildingCost: serviceData.buildingTotalCost,
      unitCost: serviceData.unitCost,
      unitAdvance: serviceData.unitAdvance,
      unitBalance: serviceData.unitBalance,
      // Uložit detaily jako JSON nebo do samostatných polí
      metadata: {
        unit: serviceData.details.unit,
        buildingUnits: serviceData.details.buildingUnits,
        unitPrice: serviceData.details.unitPrice,
        unitUnits: serviceData.details.unitUnits,
        calculationMethod: serviceData.details.calculationMethod,
        distributionShare: serviceData.distributionShare
      }
    },
    create: {
      billingPeriodId,
      unitId,
      serviceId: service.id,
      buildingCost: serviceData.buildingTotalCost,
      unitCost: serviceData.unitCost,
      unitAdvance: serviceData.unitAdvance,
      unitBalance: serviceData.unitBalance,
      metadata: {
        unit: serviceData.details.unit,
        buildingUnits: serviceData.details.buildingUnits,
        unitPrice: serviceData.details.unitPrice,
        unitUnits: serviceData.details.unitUnits,
        calculationMethod: serviceData.details.calculationMethod,
        distributionShare: serviceData.distributionShare
      }
    }
  });
  
  // Import odečtů měřidel
  for (const meterData of serviceData.meters) {
    await importMeterReading(unitId, service.id, billingPeriodId, meterData);
  }
}

/**
 * Import odečtu měřidla
 */
async function importMeterReading(
  unitId: string,
  serviceId: string,
  billingPeriodId: string,
  meterData: MeterReading
) {
  // Najít nebo vytvořit měřidlo
  let meter = await prisma.meter.findFirst({
    where: {
      unitId,
      serviceId,
      serialNumber: meterData.serial
    }
  });
  
  if (!meter) {
    meter = await prisma.meter.create({
      data: {
        unitId,
        serviceId,
        serialNumber: meterData.serial,
        type: 'WATER', // výchozí typ
        location: ''
      }
    });
  }
  
  // Vytvořit Reading
  const period = await prisma.billingPeriod.findUnique({
    where: { id: billingPeriodId }
  });
  
  if (period) {
    // Začáteční odečet
    await prisma.reading.upsert({
      where: {
        meterId_readingDate: {
          meterId: meter.id,
          readingDate: period.startDate
        }
      },
      update: {
        value: meterData.start
      },
      create: {
        meterId: meter.id,
        readingDate: period.startDate,
        value: meterData.start,
        type: 'INITIAL'
      }
    });
    
    // Konečný odečet
    await prisma.reading.upsert({
      where: {
        meterId_readingDate: {
          meterId: meter.id,
          readingDate: period.endDate
        }
      },
      update: {
        value: meterData.end
      },
      create: {
        meterId: meter.id,
        readingDate: period.endDate,
        value: meterData.end,
        type: 'FINAL'
      }
    });
  }
}

/**
 * Import pevné platby (Fond oprav)
 */
async function importFixedPayment(
  buildingId: string,
  billingPeriodId: string,
  unitId: string,
  fixedPayment: { name: string; amount: number }
) {
  // Najít nebo vytvořit službu pro fond oprav
  const serviceCode = normalizeServiceCode(fixedPayment.name);
  
  let service = await prisma.service.findFirst({
    where: {
      buildingId,
      code: serviceCode
    }
  });
  
  if (!service) {
    service = await prisma.service.create({
      data: {
        buildingId,
        code: serviceCode,
        name: fixedPayment.name,
        methodology: 'FIXED_AMOUNT'
      }
    });
  }
  
  // Vytvořit BillingServiceCost
  await prisma.billingServiceCost.upsert({
    where: {
      billingPeriodId_unitId_serviceId: {
        billingPeriodId,
        unitId,
        serviceId: service.id
      }
    },
    update: {
      unitCost: fixedPayment.amount,
      unitAdvance: 0,
      unitBalance: fixedPayment.amount
    },
    create: {
      billingPeriodId,
      unitId,
      serviceId: service.id,
      buildingCost: 0,
      unitCost: fixedPayment.amount,
      unitAdvance: 0,
      unitBalance: fixedPayment.amount
    }
  });
}

/**
 * Import měsíčních plateb
 */
async function importMonthlyPayments(
  unitId: string,
  year: number,
  monthlyPayments: number[]
) {
  for (let month = 0; month < 12; month++) {
    const amount = monthlyPayments[month];
    if (amount === 0) continue;
    
    const paymentDate = new Date(year, month, 15); // 15. den v měsíci
    
    await prisma.payment.create({
      data: {
        unitId,
        amount,
        paymentDate,
        description: `Úhrada za ${month + 1}/${year}`,
        type: 'BANK_TRANSFER'
      }
    });
  }
}

/**
 * Import měsíčních předpisů (záloh)
 */
async function importMonthlyAdvances(
  buildingId: string,
  unitId: string,
  year: number,
  monthlyAdvances: number[]
) {
  // Vytvořit "obecnou" službu pro předpisy
  let advanceService = await prisma.service.findFirst({
    where: {
      buildingId,
      code: 'advance_general'
    }
  });
  
  if (!advanceService) {
    advanceService = await prisma.service.create({
      data: {
        buildingId,
        code: 'advance_general',
        name: 'Zálohy celkem',
        methodology: 'OWNERSHIP_SHARE'
      }
    });
  }
  
  for (let month = 0; month < 12; month++) {
    const amount = monthlyAdvances[month];
    if (amount === 0) continue;
    
    await prisma.advanceMonthly.upsert({
      where: {
        unitId_serviceId_year_month: {
          unitId,
          serviceId: advanceService.id,
          year,
          month: month + 1
        }
      },
      update: {
        amount
      },
      create: {
        unitId,
        serviceId: advanceService.id,
        year,
        month: month + 1,
        amount
      }
    });
  }
}

// ============================================================================
// HLAVNÍ FUNKCE
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('📖 Použití:');
    console.log('  npx tsx scripts/import-export-full.ts <cesta-k-csv> <název-budovy> <rok>');
    console.log('');
    console.log('Příklad:');
    console.log('  npx tsx scripts/import-export-full.ts ./EXPORT_FULL.csv "Kníničky 318" 2024');
    process.exit(1);
  }
  
  const [csvPath, buildingName, yearStr] = args;
  const year = parseInt(yearStr, 10);
  
  if (isNaN(year)) {
    console.error('❌ Neplatný rok:', yearStr);
    process.exit(1);
  }
  
  // 1) Načíst CSV
  console.log(`📂 Načítám CSV: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Soubor nenalezen: ${csvPath}`);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    delimiter: ',',
    relax_column_count: true
  });
  
  console.log(`✅ Načteno ${rows.length} řádků`);
  
  // 2) Agregace dat
  console.log(`\n🔄 Agregace dat podle jednotek...`);
  const unitsData = aggregateUnitData(rows);
  console.log(`✅ Agregováno ${unitsData.size} jednotek`);
  
  // Debug výpis první jednotky
  const firstUnit = Array.from(unitsData.values())[0];
  if (firstUnit) {
    console.log(`\n📋 Ukázka dat pro jednotku: ${firstUnit.unitName}`);
    console.log(`   Vlastník: ${firstUnit.info.owner}`);
    console.log(`   VS: ${firstUnit.info.variableSymbol}`);
    console.log(`   Celkový výsledek: ${firstUnit.info.totalResult} Kč`);
    console.log(`   Počet služeb: ${firstUnit.services.length}`);
    console.log(`   Pevné platby: ${firstUnit.fixedPayments.length}`);
  }
  
  // 3) Import do databáze
  await importToDatabase(unitsData, buildingName, year);
  
  console.log(`\n🎉 Hotovo!`);
}

// Spuštění
main()
  .catch((error) => {
    console.error('💥 Kritická chyba:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
