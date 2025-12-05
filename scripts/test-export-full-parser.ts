/**
 * test-export-full-parser.ts
 * 
 * Testovací script pro parsování EXPORT_FULL.csv bez zápisu do DB
 * Vypíše JSON strukturu pro debugging a validaci
 * 
 * Použití:
 *   npx tsx scripts/test-export-full-parser.ts <cesta-k-csv>
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';

// ============================================================================
// TYPY (zkopírované z import-export-full.ts)
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
    unit: string;
    buildingUnits: string;
    unitPrice: string;
    unitUnits: string;
    calculationMethod: string;
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
  payments: number[];
  advances: number[];
}

interface UnitBillingData {
  unitName: string;
  info: UnitInfo;
  services: BillingService[];
  fixedPayments: Array<{ name: string; amount: number }>;
  monthlyData: MonthlyData;
}

// ============================================================================
// POMOCNÉ FUNKCE
// ============================================================================

function parseCzechNumber(value: string | null | undefined): number {
  if (!value) return 0;
  
  const str = value.toString().trim();
  
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
  
  let cleaned = str
    .replace(/\s*Kč\s*/gi, '')
    .replace(/\s*m[²³]?\s*/gi, '')
    .replace(/\s*kWh\s*/gi, '')
    .replace(/\s*GJ\s*/gi, '')
    .replace(/\s*os\s*/gi, '')
    .replace(/\s/g, '');
  
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanTextValue(value: string | null | undefined): string {
  if (!value) return '';
  
  const str = value.toString().trim();
  
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

// ============================================================================
// AGREGACE
// ============================================================================

function aggregateUnitData(rows: CsvRow[]): Map<string, UnitBillingData> {
  const unitsMap = new Map<string, UnitBillingData>();
  
  for (const row of rows) {
    const unitName = row.UnitName;
    if (!unitName || unitName === '0') continue;
    
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
    
    switch (row.DataType) {
      case 'INFO':
        unitData.info = {
          owner: cleanTextValue(row.Val1),
          variableSymbol: cleanTextValue(row.Val2),
          email: cleanTextValue(row.Val3),
          totalResult: parseCzechNumber(row.Val4),
          bankAccount: cleanTextValue(row.Val5)
        };
        break;
      
      case 'COST':
        const serviceName = cleanTextValue(row.Key);
        if (serviceName) {
          unitData.services.push({
            name: serviceName,
            buildingTotalCost: parseCzechNumber(row.Val1),
            unitCost: parseCzechNumber(row.Val2),
            unitAdvance: parseCzechNumber(row.Val3),
            unitBalance: parseCzechNumber(row.Val4),
            distributionShare: cleanTextValue(row.Val9),
            details: {
              unit: cleanTextValue(row.Val5),
              buildingUnits: cleanTextValue(row.Val6),
              unitPrice: cleanTextValue(row.Val7),
              unitUnits: cleanTextValue(row.Val8),
              calculationMethod: cleanTextValue(row.Val9)
            },
            meters: []
          });
        }
        break;
      
      case 'METER':
        const meterServiceName = cleanTextValue(row.Key);
        if (meterServiceName) {
          const service = unitData.services.find(s => 
            s.name.toLowerCase().includes(meterServiceName.toLowerCase()) ||
            meterServiceName.toLowerCase().includes(s.name.toLowerCase())
          );
          
          if (service) {
            service.meters.push({
              serial: cleanTextValue(row.Val1),
              start: parseCzechNumber(row.Val2),
              end: parseCzechNumber(row.Val3),
              consumption: parseCzechNumber(row.Val4)
            });
          }
        }
        break;
      
      case 'PAYMENT_MONTHLY':
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
        break;
      
      case 'ADVANCE_MONTHLY':
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
        break;
      
      case 'FIXED_PAYMENT':
        const fpName = cleanTextValue(row.Key);
        const fpAmount = parseCzechNumber(row.Val1);
        if (fpName && fpAmount !== 0) {
          unitData.fixedPayments.push({ name: fpName, amount: fpAmount });
        }
        break;
    }
  }
  
  return unitsMap;
}

// ============================================================================
// HLAVNÍ FUNKCE
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('📖 Použití:');
    console.log('  npx tsx scripts/test-export-full-parser.ts <cesta-k-csv> [limit]');
    console.log('');
    console.log('Příklad:');
    console.log('  npx tsx scripts/test-export-full-parser.ts ./EXPORT_FULL.csv');
    console.log('  npx tsx scripts/test-export-full-parser.ts ./EXPORT_FULL.csv 3');
    process.exit(1);
  }
  
  const [csvPath, limitStr] = args;
  const limit = limitStr ? parseInt(limitStr, 10) : 3;
  
  // Načíst CSV
  console.log(`📂 Načítám CSV: ${csvPath}\n`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Soubor nenalezen: ${csvPath}`);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    delimiter: ',',
    relax_column_count: true
  });
  
  console.log(`✅ Načteno ${rows.length} řádků z CSV\n`);
  
  // Agregace
  console.log(`🔄 Agregace dat podle jednotek...\n`);
  const unitsData = aggregateUnitData(rows);
  console.log(`✅ Agregováno ${unitsData.size} jednotek\n`);
  
  // Výpis statistik
  console.log(`📊 STATISTIKY:`);
  console.log(`================`);
  
  let totalServices = 0;
  let totalMeters = 0;
  let totalFixedPayments = 0;
  
  for (const unitData of unitsData.values()) {
    totalServices += unitData.services.length;
    totalMeters += unitData.services.reduce((sum, s) => sum + s.meters.length, 0);
    totalFixedPayments += unitData.fixedPayments.length;
  }
  
  console.log(`  Jednotek:       ${unitsData.size}`);
  console.log(`  Služeb celkem:  ${totalServices}`);
  console.log(`  Měřidel celkem: ${totalMeters}`);
  console.log(`  Pevných plateb: ${totalFixedPayments}`);
  console.log(``);
  
  // Výpis příkladů (prvních N jednotek)
  console.log(`\n📋 UKÁZKA DAT (prvních ${limit} jednotek):`);
  console.log(`==========================================\n`);
  
  const units = Array.from(unitsData.values()).slice(0, limit);
  
  for (const unitData of units) {
    console.log(`🏠 ${unitData.unitName}`);
    console.log(`   👤 Vlastník: ${unitData.info.owner || '(nepřiřazen)'}`);
    console.log(`   📧 Email: ${unitData.info.email || '(bez emailu)'}`);
    console.log(`   💳 VS: ${unitData.info.variableSymbol || '(bez VS)'}`);
    console.log(`   🏦 Účet: ${unitData.info.bankAccount || '(bez účtu)'}`);
    console.log(`   💰 Celkový výsledek: ${unitData.info.totalResult.toFixed(2)} Kč`);
    console.log(``);
    
    // Služby
    if (unitData.services.length > 0) {
      console.log(`   📦 SLUŽBY (${unitData.services.length}):`);
      for (const service of unitData.services) {
        console.log(`      • ${service.name}`);
        console.log(`        Náklad domu:  ${service.buildingTotalCost.toFixed(2)} Kč`);
        console.log(`        Náklad bytu:  ${service.unitCost.toFixed(2)} Kč`);
        console.log(`        Záloha:       ${service.unitAdvance.toFixed(2)} Kč`);
        console.log(`        Výsledek:     ${service.unitBalance.toFixed(2)} Kč`);
        
        if (service.details.unit || service.details.buildingUnits) {
          console.log(`        Detail:`);
          if (service.details.unit) console.log(`          Jednotka: ${service.details.unit}`);
          if (service.details.buildingUnits) console.log(`          Dům: ${service.details.buildingUnits}`);
          if (service.details.unitPrice) console.log(`          Cena/jednotku: ${service.details.unitPrice}`);
          if (service.details.unitUnits) console.log(`          Spotřeba: ${service.details.unitUnits}`);
        }
        
        if (service.meters.length > 0) {
          console.log(`        Měřidla:`);
          for (const meter of service.meters) {
            console.log(`          📏 ${meter.serial}: ${meter.start} → ${meter.end} (${meter.consumption})`);
          }
        }
      }
      console.log(``);
    }
    
    // Pevné platby
    if (unitData.fixedPayments.length > 0) {
      console.log(`   💵 PEVNÉ PLATBY (${unitData.fixedPayments.length}):`);
      for (const fp of unitData.fixedPayments) {
        console.log(`      • ${fp.name}: ${fp.amount.toFixed(2)} Kč`);
      }
      console.log(``);
    }
    
    // Měsíční data
    const totalPayments = unitData.monthlyData.payments.reduce((a, b) => a + b, 0);
    const totalAdvances = unitData.monthlyData.advances.reduce((a, b) => a + b, 0);
    
    if (totalPayments > 0 || totalAdvances > 0) {
      console.log(`   📅 MĚSÍČNÍ DATA:`);
      console.log(`      Úhrady celkem:   ${totalPayments.toFixed(2)} Kč`);
      console.log(`      Předpisy celkem: ${totalAdvances.toFixed(2)} Kč`);
      
      const nonZeroPayments = unitData.monthlyData.payments.filter(p => p !== 0).length;
      const nonZeroAdvances = unitData.monthlyData.advances.filter(a => a !== 0).length;
      console.log(`      Měsíců s úhradou: ${nonZeroPayments}/12`);
      console.log(`      Měsíců s předpisem: ${nonZeroAdvances}/12`);
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
  }
  
  // Export JSON (pro další zpracování)
  const outputPath = csvPath.replace('.csv', '_parsed.json');
  const jsonData = Array.from(unitsData.values());
  
  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`\n✅ JSON export uložen do: ${outputPath}`);
  console.log(`   (obsahuje všech ${unitsData.size} jednotek)\n`);
}

main().catch(console.error);
