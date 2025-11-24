import fs from 'fs';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// KONFIGURACE
const FILE_PATH = path.join(process.cwd(), 'public', 'import', 'data.xlsx');
const SHEET_INPUT = 'Vstupní data';
const SHEET_OUTPUT = 'Faktury'; // Zde je výsledná tabulka
const SHEET_EVIDENCE = 'Evidence'; // Zde je seznam bytů

// Rozsah dat na listu Faktury
const ROW_START = 10; 
const ROW_END = 40;   

// Mapování sloupců na listu Faktury (0-indexed)
const COL_SERVICE_NAME = 0; // A - Položka
const COL_TOTAL_COST = 4;   // E - Náklad (dům)
const COL_UNIT_COST = 9;    // J - Náklad (uživatel)
const COL_ADVANCE = 10;     // K - Záloha
const COL_RESULT = 11;      // L - Přeplatek/Nedoplatek
const COL_EXCEL_POINTER = 12; // M - Explicitní odkaz na sloupec (např. "BN")

// Helper function for string normalization
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Helper: Convert Excel column (e.g. "AA") to 0-based index
function excelColToIndex(colName: string): number {
  let index = 0;
  const cleanName = colName.toUpperCase().trim();
  for (let i = 0; i < cleanName.length; i++) {
    index = index * 26 + cleanName.charCodeAt(i) - 64;
  }
  return index - 1;
}

async function importAdvancePayments(hf: HyperFormula, sheetName: string, buildingId: string, year: number, fakturySheetId: number) {
  console.log(`\n🚀 Spouštím import záloh (EXPLICITNÍ ADRESOVÁNÍ) z listu: "${sheetName}"...`);

  const sheetId = hf.getSheetId(sheetName);
  if (sheetId === undefined) {
    console.warn(`⚠️ List "${sheetName}" nenalezen. Přeskakuji import záloh.`);
    return;
  }

  const dims = hf.getSheetDimensions(sheetId);
  const width = dims.width;
  const height = dims.height;

  // 1. NAČTENÍ KONFIGURACE Z LISTU FAKTURY (Sloupec M)
  console.log(`   🔍 Čtu konfiguraci sloupců z listu Faktury (sloupec M)...`);
  const dbServices = await prisma.service.findMany({ where: { buildingId: buildingId } });
  const serviceColMap = new Map<string, number>(); // ServiceID -> Start Column Index

  for (let row = ROW_START - 1; row < ROW_END; row++) {
      const serviceNameVal = hf.getCellValue({ sheet: fakturySheetId, col: COL_SERVICE_NAME, row: row });
      if (!serviceNameVal || typeof serviceNameVal !== 'string') continue;
      
      const serviceName = serviceNameVal.trim();
      if (serviceName === '' || serviceName.includes('Celkem')) continue;

      // Přečíst pointer ze sloupce M (index 12)
      const pointerVal = hf.getCellValue({ sheet: fakturySheetId, col: COL_EXCEL_POINTER, row: row });
      
      if (pointerVal && typeof pointerVal === 'string' && pointerVal.trim() !== '') {
          const colLetter = pointerVal.trim().toUpperCase();
          
          // Najít službu v DB
          const service = dbServices.find(s => normalize(s.name) === normalize(serviceName));
          
          if (service) {
              // Uložit do DB
              await prisma.service.update({
                  where: { id: service.id },
                  data: { excelColumn: colLetter }
              });

              const colIndex = excelColToIndex(colLetter);
              serviceColMap.set(service.id, colIndex);
              console.log(`   ✅ Služba "${service.name}" -> Sloupec ${colLetter} (Index ${colIndex})`);
          } else {
              console.warn(`   ⚠️ Služba "${serviceName}" má definovaný sloupec ${colLetter}, ale nebyla nalezena v DB.`);
          }
      }
  }

  if (serviceColMap.size === 0) {
      console.warn('   ❌ Žádné služby nemají definovaný sloupec v Excelu (sloupec M). Končím import záloh.');
      return;
  }

  // 2. EXTRAKCE DAT
  const START_ROW = 2; 
  let importedCount = 0;
  const units = await prisma.unit.findMany({ where: { buildingId } });
  const unitMap = new Map(units.map(u => [normalize(u.unitNumber), u.id]));
  units.forEach(u => unitMap.set(normalize(`Jednotka č. ${u.unitNumber}`), u.id));

  for (let row = START_ROW; row < height; row++) {
    const unitNameVal = hf.getCellValue({ sheet: sheetId, col: 0, row: row });
    if (!unitNameVal) continue;
    const unitName = String(unitNameVal).trim();
    const unitId = unitMap.get(normalize(unitName));
    if (!unitId) continue;

    for (const [serviceId, startColIndex] of serviceColMap.entries()) {
      for (let month = 1; month <= 12; month++) {
        // Předpokládáme, že data jsou v po sobě jdoucích sloupcích (Leden, Únor...)
        const targetCol = startColIndex + (month - 1);
        
        if (targetCol >= width) continue;
        
        const val = hf.getCellValue({ sheet: sheetId, col: targetCol, row: row });
        let amount = 0;
        if (typeof val === 'number') amount = val;
        else if (typeof val === 'string') amount = parseFloat(val.replace(/\s/g, '').replace(',', '.'));

        if (!isNaN(amount)) {
          await prisma.advanceMonthly.upsert({
            where: { unitId_serviceId_year_month: { unitId: unitId, serviceId: serviceId, year: year, month: month } },
            update: { amount },
            create: { unitId: unitId, serviceId: serviceId, year: year, month: month, amount }
          });
          importedCount++;
        }
      }
    }
  }
  console.log(`✅ Import záloh dokončen. Zpracováno ${importedCount} záznamů.`);
}

async function main() {
  console.log('🚀 Startuji Excel Engine Import...');

  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ Soubor nenalezen: ${FILE_PATH}`);
    return;
  }

  // 1. Načtení Excelu
  console.log('📚 Načítám Excel do paměti...');
  const workbook = XLSX.readFile(FILE_PATH);
  const sheets: Record<string, any[][]> = {};
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet['!ref']) {
      sheets[sheetName] = [];
      continue;
    }
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const sheetData: any[][] = [];

    for (let R = 0; R <= range.e.r; ++R) {
      const row: any[] = [];
      for (let C = 0; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (!cell) {
          row.push('');
        } else if (cell.f) {
          let formula = `=${cell.f}`;
          // Fix VLOOKUP approximate match
          if (formula.includes('VLOOKUP(BYT') && (formula.endsWith(',1)') || formula.endsWith(',TRUE)'))) {
             formula = formula.replace(/,1\)$/, ',0)').replace(/,TRUE\)$/, ',0)');
          }
          // Fix booleans
          if (formula.includes('FALSE') || formula.includes('TRUE')) {
             formula = formula
               .replace(/,FALSE\)/g, ',0)')
               .replace(/,TRUE\)/g, ',1)')
               .replace(/\(FALSE\)/g, '(0)')
               .replace(/\(TRUE\)/g, '(1)')
               .replace(/,FALSE,/g, ',0,')
               .replace(/,TRUE,/g, ',1,');
          }
          row.push(formula); 
        } else {
          row.push(cell.v !== undefined ? cell.v : '');
        }
      }
      sheetData.push(row);
    }
    sheets[sheetName] = sheetData;
  }

  const hf = HyperFormula.buildFromSheets(sheets, {
    licenseKey: 'gpl-v3',
    useColumnIndex: false
  });

  // Named Ranges
  if (workbook.Workbook && workbook.Workbook.Names) {
    workbook.Workbook.Names.forEach(name => {
      try {
        if (name.Ref) hf.addNamedExpression(name.Name, `=${name.Ref}`);
      } catch (e) {}
    });
  }

  const sheetNames = hf.getSheetNames();
  const inputSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase() === SHEET_INPUT.toLowerCase()) || '');
  const outputSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase() === SHEET_OUTPUT.toLowerCase()) || '');
  const evidenceSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase().includes('evidence')) || '');

  if (inputSheetId === undefined || outputSheetId === undefined || evidenceSheetId === undefined) {
    console.error('❌ Nenalezeny požadované listy.');
    return;
  }

  // 2. Získání seznamu jednotek
  console.log('📋 Načítám seznam jednotek...');
  const units: Array<{ name: string; ownerName: string; address: string; email: string; phone: string; bankAccount: string; }> = [];
  const evidenceDims = hf.getSheetDimensions(evidenceSheetId);
  
  for (let row = 1; row < evidenceDims.height; row++) {
    const unitName = hf.getCellValue({ sheet: evidenceSheetId, col: 0, row: row });
    if (unitName && typeof unitName === 'string' && unitName.trim() !== '') {
      const ownerName = hf.getCellValue({ sheet: evidenceSheetId, col: 1, row: row })?.toString() || '';
      const address = hf.getCellValue({ sheet: evidenceSheetId, col: 2, row: row })?.toString() || '';
      const email = hf.getCellValue({ sheet: evidenceSheetId, col: 3, row: row })?.toString() || '';
      const phone = hf.getCellValue({ sheet: evidenceSheetId, col: 4, row: row })?.toString() || '';
      const bankAccount = hf.getCellValue({ sheet: evidenceSheetId, col: 10, row: row })?.toString() || '';

      units.push({ name: unitName.toString(), ownerName, address, email, phone, bankAccount });
    }
  }

  // 3. Příprava DB
  const args = process.argv.slice(2);
  const buildingArg = args[0];

  if (!buildingArg) {
    console.error('❌ CHYBA: Nebyla specifikována budova. Zadejte název nebo ID budovy jako argument.');
    return;
  }

  const building = await prisma.building.findFirst({ 
    where: { 
      OR: [
        { id: buildingArg },
        { name: { contains: buildingArg, mode: 'insensitive' } }
      ]
    } 
  });
  
  if (!building) {
    console.error(`❌ Budova "${buildingArg}" nenalezena.`);
    return;
  }
  console.log(`✅ Vybrána budova: ${building.name}`);

  const svjBankAccount = hf.getCellValue({ sheet: inputSheetId, col: 1, row: 21 })?.toString();
  if (svjBankAccount) {
    await prisma.building.update({ where: { id: building.id }, data: { bankAccount: svjBankAccount } });
  }

  const period = await prisma.billingPeriod.upsert({
    where: { buildingId_year: { buildingId: building.id, year: 2024 } },
    update: {},
    create: { buildingId: building.id, year: 2024 }
  });

  console.log('🧹 Mazání starých výsledků...');
  await prisma.billingResult.deleteMany({ where: { billingPeriodId: period.id } });

  const controlData: Record<string, { excelTotal: number, calculatedSum: number }> = {};

  // 4. Hlavní smyčka přes jednotky
  for (const unitData of units) {
    const unitName = unitData.name;
    console.log(`🔄 Zpracovávám: ${unitName}`);

    hf.setCellContents({ sheet: inputSheetId, col: 1, row: 3 }, [[unitName]]);

    const cleanUnitName = unitName.replace('Jednotka č. ', '').trim();
    const dbUnit = await prisma.unit.findFirst({
      where: { buildingId: building.id, OR: [{ unitNumber: unitName }, { unitNumber: `Jednotka č. ${unitName}` }, { unitNumber: cleanUnitName }] },
      include: { ownerships: { include: { owner: true } } }
    });

    if (!dbUnit) continue;

    // Update Owner
    if (dbUnit.ownerships.length > 0) {
      const owner = dbUnit.ownerships[0].owner;
      let firstName = '';
      let lastName = unitData.ownerName;
      if (unitData.ownerName.includes(' ')) {
        const parts = unitData.ownerName.split(' ');
        lastName = parts[0];
        firstName = parts.slice(1).join(' ');
      }
      await prisma.owner.update({
        where: { id: owner.id },
        data: { firstName: firstName || owner.firstName, lastName: lastName || owner.lastName, address: unitData.address, email: unitData.email, phone: unitData.phone, bankAccount: unitData.bankAccount }
      });
    }

    // Monthly Payments & Prescriptions (Totals)
    const monthlyPayments: number[] = [];
    const monthlyPrescriptions: number[] = [];
    for (let m = 0; m < 12; m++) {
      const payVal = hf.getCellValue({ sheet: outputSheetId, col: m, row: 39 });
      const presVal = hf.getCellValue({ sheet: outputSheetId, col: m, row: 44 });
      monthlyPayments.push(typeof payVal === 'number' ? payVal : 0);
      monthlyPrescriptions.push(typeof presVal === 'number' ? presVal : 0);
    }

    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: period.id,
        unitId: dbUnit.id,
        totalCost: 0,
        totalAdvancePrescribed: 0,
        totalAdvancePaid: 0,
        result: 0,
        monthlyPayments: monthlyPayments,
        monthlyPrescriptions: monthlyPrescriptions
      }
    });

    let unitTotalCost = 0;
    let unitTotalAdvance = 0;
    let unitTotalBalance = 0;

    // Read Service Rows
    for (let row = ROW_START - 1; row < ROW_END; row++) {
      const serviceNameVal = hf.getCellValue({ sheet: outputSheetId, col: COL_SERVICE_NAME, row: row });
      if (!serviceNameVal || typeof serviceNameVal !== 'string' || serviceNameVal.trim() === '' || serviceNameVal.includes('Celkem')) continue;

      const serviceName = serviceNameVal.toString().trim();
      const getNum = (col: number) => {
        const val = hf.getCellValue({ sheet: outputSheetId, col: col, row: row });
        return typeof val === 'number' ? val : 0;
      };

      const totalBuildingCost = getNum(COL_TOTAL_COST);
      const unitCost = getNum(COL_UNIT_COST);
      const advance = getNum(COL_ADVANCE);
      const result = getNum(COL_RESULT);

      if (!controlData[serviceName]) controlData[serviceName] = { excelTotal: totalBuildingCost, calculatedSum: 0 };
      controlData[serviceName].calculatedSum += unitCost;

      let service = await prisma.service.findFirst({ where: { buildingId: building.id, name: serviceName } });
      if (!service) {
        service = await prisma.service.create({
          data: { buildingId: building.id, name: serviceName, code: serviceName.toUpperCase().replace(/\s+/g, '_').substring(0, 20), methodology: 'CUSTOM' }
        });
      }

      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: period.id,
          billingResultId: billingResult.id,
          serviceId: service.id,
          unitId: dbUnit.id,
          buildingTotalCost: totalBuildingCost,
          unitCost: unitCost,
          unitAdvance: advance,
          unitBalance: result,
          calculationBasis: `Excel Import (Řádek ${row + 1})`
        }
      });

      unitTotalCost += unitCost;
      unitTotalAdvance += advance;
      unitTotalBalance += result;
    }

    await prisma.billingResult.update({
      where: { id: billingResult.id },
      data: { totalCost: unitTotalCost, totalAdvancePrescribed: unitTotalAdvance, result: unitTotalBalance }
    });
  }

  // 5. Kontrolní modul
  console.log('\n📊 --- KONTROLNÍ MODUL ---');
  for (const [service, data] of Object.entries(controlData)) {
    const diff = data.excelTotal - data.calculatedSum;
    const status = Math.abs(diff) < 1 ? '✅' : '❌';
    console.log(`${status} ${service.padEnd(30)} | Excel: ${data.excelTotal.toFixed(2)} | Sum: ${data.calculatedSum.toFixed(2)} | Diff: ${diff.toFixed(2)}`);
  }

  // 6. IMPORT ZÁLOH (Explicitní)
  const advanceSheetName = hf.getSheetNames().find(n => normalize(n).includes('predpis') && normalize(n).includes('mesic')) || 'Předpis po mesici';
  await importAdvancePayments(hf, advanceSheetName, building.id, 2024, outputSheetId);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
