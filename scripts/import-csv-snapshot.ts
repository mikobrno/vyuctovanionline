/**
 * import-csv-snapshot.ts
 * "Blbuvzdorný" importér CSV exportu z Excelu do databáze
 * 
 * Použití:
 *   npx tsx scripts/import-csv-snapshot.ts <cesta-k-csv> <rok>
 *   npx tsx scripts/import-csv-snapshot.ts ./export.csv 2024
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// POMOCNÉ FUNKCE
// ============================================================================

/**
 * Vyčistí hodnotu z Excelu - zpracuje české formáty, Excelové chyby, prázdné hodnoty
 */
function cleanNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  
  const str = String(val).trim();
  
  // Excelové chyby
  if (str.startsWith('#') || str === 'N/A' || str === '-' || str === '—') return 0;
  
  // Odstranění jednotek a měny
  let cleaned = str
    .replace(/\s*Kč\s*/gi, '')
    .replace(/\s*m[²³]?\s*/gi, '')
    .replace(/\s*kWh\s*/gi, '')
    .replace(/\s*GJ\s*/gi, '')
    .replace(/\s/g, '');  // mezery v čísle
  
  // České formátování: "1 250,50" → "1250.50"
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extrahuje č.p. z názvu jednotky (např. "Byt-č.-20801" → "2080")
 */
function extractCisloPopisne(unitName: string): string | null {
  // Formát: Byt-č.-XXXXY kde XXXX je č.p. a Y je číslo bytu
  const match = unitName.match(/(\d{4})\d$/);
  return match ? match[1] : null;
}

/**
 * Normalizuje název služby na kód (bez diakritiky, lowercase)
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
// TYPY
// ============================================================================

interface CsvRow {
  UNIT_NAME: string;
  ROW_TYPE: 'INFO' | 'COST' | 'METER' | 'ADVANCE_MONTHLY' | 'FUND';
  SERVICE_NAME: string;
  [key: string]: string; // dynamická pole
}

interface ParsedService {
  serviceName: string;
  rowType: string;
  buildingCost: number;
  unitCost: number;
  unitAdvance: number;
  unitBalance: number;
  consumption: number;
  unitPrice: number;
  monthlyAdvances: number[];
  meterDetails?: {
    serial: string;
    start: number;
    end: number;
    consumption: number;
  }[];
}

interface ParsedUnit {
  unitName: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  variableSymbol?: string;
  address?: string;
  totalCost: number;
  totalAdvance: number;
  totalBalance: number;
  repairFund: number;
  services: ParsedService[];
  monthlyAdvances: number[];
}

// ============================================================================
// PARSOVÁNÍ CSV
// ============================================================================

function parseCsvFile(filePath: string): ParsedUnit[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records: CsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  
  const unitMap = new Map<string, ParsedUnit>();
  
  for (const row of records) {
    const unitName = row.UNIT_NAME?.trim();
    if (!unitName) continue;
    
    // Inicializace jednotky
    if (!unitMap.has(unitName)) {
      unitMap.set(unitName, {
        unitName,
        totalCost: 0,
        totalAdvance: 0,
        totalBalance: 0,
        repairFund: 0,
        services: [],
        monthlyAdvances: Array(12).fill(0),
      });
    }
    
    const unit = unitMap.get(unitName)!;
    const rowType = row.ROW_TYPE?.trim().toUpperCase() || 'COST';
    
    // INFO řádky - údaje o vlastníkovi
    if (rowType === 'INFO') {
      unit.ownerName = row.OWNER_NAME || row.SERVICE_NAME || unit.ownerName;
      unit.email = row.EMAIL || unit.email;
      unit.phone = row.PHONE || unit.phone;
      unit.variableSymbol = row.VARIABLE_SYMBOL || row.VS || unit.variableSymbol;
      unit.address = row.ADDRESS || unit.address;
      
      // Celkové hodnoty z INFO řádku
      if (row.TOTAL_COST) unit.totalCost = cleanNumber(row.TOTAL_COST);
      if (row.TOTAL_ADVANCE) unit.totalAdvance = cleanNumber(row.TOTAL_ADVANCE);
      if (row.TOTAL_BALANCE || row.BALANCE) {
        unit.totalBalance = cleanNumber(row.TOTAL_BALANCE || row.BALANCE);
      }
      continue;
    }
    
    // ADVANCE_MONTHLY - měsíční zálohy
    if (rowType === 'ADVANCE_MONTHLY') {
      for (let m = 1; m <= 12; m++) {
        const key = `M${m}` as keyof CsvRow;
        if (row[key]) {
          unit.monthlyAdvances[m - 1] += cleanNumber(row[key]);
        }
      }
      continue;
    }
    
    // FUND - fond oprav
    if (rowType === 'FUND') {
      unit.repairFund = cleanNumber(row.UNIT_ADVANCE || row.UNIT_COST || 0);
      continue;
    }
    
    // COST nebo METER - služby
    const serviceName = row.SERVICE_NAME?.trim();
    if (!serviceName) continue;
    
    const unitCost = cleanNumber(row.UNIT_COST);
    const unitAdvance = cleanNumber(row.UNIT_ADVANCE);
    
    // Filtrovat nulové služby
    if (unitCost === 0 && unitAdvance === 0 && rowType === 'COST') {
      continue;
    }
    
    const service: ParsedService = {
      serviceName,
      rowType,
      buildingCost: cleanNumber(row.BUILDING_COST),
      unitCost,
      unitAdvance,
      unitBalance: unitAdvance - unitCost, // přeplatek = záloha - náklad
      consumption: cleanNumber(row.CONSUMPTION || row.UNIT_CONSUMPTION),
      unitPrice: cleanNumber(row.UNIT_PRICE),
      monthlyAdvances: [],
    };
    
    // Měsíční zálohy pro službu
    for (let m = 1; m <= 12; m++) {
      const key = `M${m}` as keyof CsvRow;
      service.monthlyAdvances.push(cleanNumber(row[key]));
    }
    
    // METER - detaily měřidel
    if (rowType === 'METER') {
      service.meterDetails = [{
        serial: row.METER_SERIAL || row.SERIAL || '',
        start: cleanNumber(row.METER_START || row.START_VALUE),
        end: cleanNumber(row.METER_END || row.END_VALUE),
        consumption: cleanNumber(row.CONSUMPTION || row.METER_CONSUMPTION),
      }];
    }
    
    unit.services.push(service);
  }
  
  return Array.from(unitMap.values());
}

// ============================================================================
// IMPORT DO DATABÁZE
// ============================================================================

async function importToDatabase(units: ParsedUnit[], year: number) {
  console.log(`\n📦 Import ${units.length} jednotek pro rok ${year}...\n`);
  
  if (units.length === 0) {
    console.log('❌ Žádné jednotky k importu');
    return;
  }
  
  // 1. Detekce domu z č.p. v názvu jednotky
  const firstUnit = units[0];
  const cisloPopisne = extractCisloPopisne(firstUnit.unitName);
  
  if (!cisloPopisne) {
    throw new Error(`Nelze extrahovat č.p. z názvu jednotky: ${firstUnit.unitName}`);
  }
  
  console.log(`🔍 Detekováno č.p.: ${cisloPopisne}`);
  
  // 2. Najít dům v databázi
  const building = await prisma.building.findFirst({
    where: {
      OR: [
        { address: { contains: cisloPopisne } },
        { name: { contains: cisloPopisne } },
      ],
    },
    include: { units: true },
  });
  
  if (!building) {
    throw new Error(`Dům s č.p. ${cisloPopisne} nenalezen v databázi`);
  }
  
  console.log(`✅ Nalezen dům: ${building.name} (${building.address})`);
  console.log(`   Jednotek v DB: ${building.units.length}`);
  
  // 3. Získat nebo vytvořit billing period
  const billingPeriod = await prisma.billingPeriod.upsert({
    where: {
      buildingId_year: {
        buildingId: building.id,
        year,
      },
    },
    create: {
      buildingId: building.id,
      year,
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
    update: {
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
  });
  
  console.log(`📅 Billing period: ${billingPeriod.id}`);
  
  // 4. Smazat staré výsledky pro toto období
  await prisma.billingServiceCost.deleteMany({
    where: { billingPeriodId: billingPeriod.id },
  });
  await prisma.billingResult.deleteMany({
    where: { billingPeriodId: billingPeriod.id },
  });
  
  console.log('🗑️  Staré výsledky smazány');
  
  // 5. Cache pro služby
  const serviceCache = new Map<string, string>(); // code → serviceId
  
  async function getOrCreateService(serviceName: string): Promise<string> {
    const code = normalizeServiceCode(serviceName);
    
    if (serviceCache.has(code)) {
      return serviceCache.get(code)!;
    }
    
    // Hledat existující službu
    let service = await prisma.service.findFirst({
      where: {
        buildingId: building.id,
        OR: [
          { code },
          { name: serviceName },
          { name: { contains: serviceName.substring(0, 10) } },
        ],
      },
    });
    
    // Vytvořit novou službu
    if (!service) {
      service = await prisma.service.create({
        data: {
          buildingId: building.id,
          name: serviceName,
          code: code + '_' + Date.now(), // unikátní kód
          methodology: 'OWNERSHIP_SHARE',
          isActive: true,
        },
      });
      console.log(`   ➕ Vytvořena služba: ${serviceName}`);
    }
    
    serviceCache.set(code, service.id);
    return service.id;
  }
  
  // 6. Import jednotek
  let importedUnits = 0;
  let importedCosts = 0;
  
  for (const unitData of units) {
    // Najít jednotku v DB
    const unitNumber = unitData.unitName.replace(/\D/g, '').slice(-1) || '1';
    
    const unit = building.units.find(u => {
      const uNum = u.unitNumber.replace(/\D/g, '');
      const dataNum = unitData.unitName.replace(/\D/g, '');
      return uNum === dataNum || u.unitNumber === unitData.unitName;
    }) || building.units.find(u => 
      u.unitNumber.includes(unitNumber) || unitData.unitName.includes(u.unitNumber)
    );
    
    if (!unit) {
      console.log(`   ⚠️  Jednotka nenalezena: ${unitData.unitName}`);
      continue;
    }
    
    // Vypočítat celkové hodnoty pokud nejsou z INFO
    const totalCost = unitData.totalCost || unitData.services.reduce((sum, s) => sum + s.unitCost, 0);
    const totalAdvance = unitData.totalAdvance || unitData.services.reduce((sum, s) => sum + s.unitAdvance, 0);
    const totalBalance = totalAdvance - totalCost;
    
    // Vytvořit BillingResult
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        totalCost,
        totalAdvancePrescribed: totalAdvance,
        totalAdvancePaid: totalAdvance,
        repairFund: unitData.repairFund,
        result: totalBalance,
        monthlyPrescriptions: unitData.monthlyAdvances,
        summaryJson: JSON.stringify({
          ownerName: unitData.ownerName,
          email: unitData.email,
          phone: unitData.phone,
          variableSymbol: unitData.variableSymbol,
          address: unitData.address,
        }),
      },
    });
    
    importedUnits++;
    
    // Vytvořit BillingServiceCost pro každou službu
    for (const svc of unitData.services) {
      const serviceId = await getOrCreateService(svc.serviceName);
      
      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: billingPeriod.id,
          billingResultId: billingResult.id,
          serviceId,
          unitId: unit.id,
          buildingTotalCost: svc.buildingCost,
          unitConsumption: svc.consumption || null,
          unitCost: svc.unitCost,
          unitAdvance: svc.unitAdvance,
          unitBalance: svc.unitBalance,
          unitPricePerUnit: svc.unitPrice || null,
          monthlyAdvances: JSON.stringify(svc.monthlyAdvances),
          meterReadings: svc.meterDetails ? JSON.stringify(svc.meterDetails) : null,
          calculationType: svc.rowType,
        },
      });
      
      importedCosts++;
    }
  }
  
  console.log(`\n✅ Import dokončen!`);
  console.log(`   📊 Jednotek: ${importedUnits}`);
  console.log(`   💰 Nákladů služeb: ${importedCosts}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Použití: npx tsx scripts/import-csv-snapshot.ts <cesta-k-csv> <rok>');
    console.log('Příklad: npx tsx scripts/import-csv-snapshot.ts ./export.csv 2024');
    process.exit(1);
  }
  
  const csvPath = args[0];
  const year = parseInt(args[1], 10);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Soubor neexistuje: ${csvPath}`);
    process.exit(1);
  }
  
  if (isNaN(year) || year < 2000 || year > 2100) {
    console.error(`❌ Neplatný rok: ${args[1]}`);
    process.exit(1);
  }
  
  console.log(`📂 CSV soubor: ${csvPath}`);
  console.log(`📅 Rok: ${year}`);
  
  try {
    const units = parseCsvFile(csvPath);
    console.log(`📋 Načteno ${units.length} jednotek z CSV`);
    
    await importToDatabase(units, year);
  } catch (error) {
    console.error('❌ Chyba při importu:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
