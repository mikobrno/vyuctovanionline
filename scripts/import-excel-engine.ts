import fs from 'fs';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// KONFIGURACE
const FILE_PATH = path.join(process.cwd(), 'public', 'import', 'data.xlsx');
const SHEET_INPUT = 'Vstupní data';
const CELL_INPUT_UNIT = 'B4'; // Kde se přepíná byt
const SHEET_OUTPUT = 'Faktury'; // Zde je výsledná tabulka
const SHEET_EVIDENCE = 'Evidence'; // Zde je seznam bytů

// Rozsah dat na listu Faktury (řádky s daty služeb)
// Podle screenshotu data začínají cca na řádku 10 a končí před "Celkem náklady"
const ROW_START = 10; // Řádek 10 (index 9)
const ROW_END = 30;   // Řádek 30 (index 29) - odhad, upravíme dynamicky

// Mapování sloupců na listu Faktury (0-indexed)
// A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11
const COL_SERVICE_NAME = 0; // A - Položka
const COL_TOTAL_COST = 4;   // E - Náklad (dům)
const COL_UNIT_COST = 9;    // J - Náklad (uživatel)
const COL_ADVANCE = 10;     // K - Záloha
const COL_RESULT = 11;      // L - Přeplatek/Nedoplatek

async function main() {
  console.log('🚀 Startuji Excel Engine Import...');

  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ Soubor nenalezen: ${FILE_PATH}`);
    return;
  }

  // 1. Načtení Excelu pomocí XLSX a konverze pro HyperFormula
  console.log('📚 Načítám Excel do paměti (včetně vzorců)...');
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
          // PATCH: Oprava VLOOKUP(BYT, ...) na exact match, pokud je tam approximate match (1)
          // HyperFormula je striktní na řazení u approximate match, což Excel někdy promine
          if (formula.includes('VLOOKUP(BYT') && (formula.endsWith(',1)') || formula.endsWith(',TRUE)'))) {
             console.log(`🔧 Patching formula at ${sheetName}!${cellAddress}: ${formula}`);
             formula = formula.replace(/,1\)$/, ',0)').replace(/,TRUE\)$/, ',0)');
          }

          // PATCH: HyperFormula nepodporuje klíčová slova TRUE/FALSE, nahradíme je za 1/0
          if (formula.includes('FALSE') || formula.includes('TRUE')) {
             const original = formula;
             formula = formula
               .replace(/,FALSE\)/g, ',0)')
               .replace(/,TRUE\)/g, ',1)')
               .replace(/\(FALSE\)/g, '(0)')
               .replace(/\(TRUE\)/g, '(1)')
               .replace(/,FALSE,/g, ',0,')
               .replace(/,TRUE,/g, ',1,');
             
             if (formula !== original) {
                // console.log(`🔧 Patching booleans at ${sheetName}!${cellAddress}`);
             }
          }
          row.push(formula); 
        } else {
          row.push(cell.v !== undefined ? cell.v : ''); // Načteme hodnotu
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

  // Načtení definovaných názvů (Named Ranges)
  if (workbook.Workbook && workbook.Workbook.Names) {
    console.log(`🔖 Načítám ${workbook.Workbook.Names.length} definovaných názvů...`);
    workbook.Workbook.Names.forEach(name => {
      try {
        // HyperFormula potřebuje výraz s rovnitkem, např. "=List1!$A$1"
        // XLSX vrací Ref bez rovnitka
        if (name.Ref) {
           hf.addNamedExpression(name.Name, `=${name.Ref}`);
        }
      } catch (e: any) {
        console.warn(`   ⚠️ Chyba při načítání názvu '${name.Name}': ${e.message}`);
      }
    });
  }

  const sheetNames = hf.getSheetNames();
  const inputSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase() === SHEET_INPUT.toLowerCase()) || '');
  const outputSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase() === SHEET_OUTPUT.toLowerCase()) || '');
  const evidenceSheetId = hf.getSheetId(sheetNames.find(n => n.toLowerCase().includes('evidence')) || '');

  if (inputSheetId === undefined || outputSheetId === undefined || evidenceSheetId === undefined) {
    console.error('❌ Nenalezeny požadované listy.');
    console.log('Dostupné listy:', sheetNames);
    return;
  }

  // 2. Získání seznamu jednotek a vlastníků
  console.log('📋 Načítám seznam jednotek a vlastníků...');
  const units: Array<{
    name: string;
    ownerName: string;
    address: string;
    email: string;
    phone: string;
    bankAccount: string;
  }> = [];
  const evidenceDims = hf.getSheetDimensions(evidenceSheetId);
  
  // Sloupce v Evidence (0-indexed): A=0 (Jednotka), B=1 (Jméno), C=2 (Adresa), D=3 (Email), E=4 (Telefon), K=10 (Účet)
  for (let row = 1; row < evidenceDims.height; row++) {
    const unitName = hf.getCellValue({ sheet: evidenceSheetId, col: 0, row: row });
    if (unitName && typeof unitName === 'string' && unitName.trim() !== '') {
      const ownerName = hf.getCellValue({ sheet: evidenceSheetId, col: 1, row: row })?.toString() || '';
      const address = hf.getCellValue({ sheet: evidenceSheetId, col: 2, row: row })?.toString() || '';
      const email = hf.getCellValue({ sheet: evidenceSheetId, col: 3, row: row })?.toString() || '';
      const phone = hf.getCellValue({ sheet: evidenceSheetId, col: 4, row: row })?.toString() || '';
      const bankAccount = hf.getCellValue({ sheet: evidenceSheetId, col: 10, row: row })?.toString() || '';

      units.push({
        name: unitName.toString(),
        ownerName,
        address,
        email,
        phone,
        bankAccount
      });
    }
  }
  console.log(`   -> Nalezeno ${units.length} jednotek.`);

  // 3. Příprava DB (najdeme budovu a období)
  // Pro zjednodušení bereme první budovu a rok 2024
  const building = await prisma.building.findFirst({ where: { name: 'Kníničky 318 - Neptun' } });
  if (!building) throw new Error('Budova nenalezena');

  // Načtení čísla účtu SVJ z Vstupní data B22 (col 1, row 21)
  const svjBankAccount = hf.getCellValue({ sheet: inputSheetId, col: 1, row: 21 })?.toString();
  if (svjBankAccount) {
    console.log(`🏦 Aktualizuji účet SVJ: ${svjBankAccount}`);
    await prisma.building.update({
      where: { id: building.id },
      data: { bankAccount: svjBankAccount }
    });
  }

  const period = await prisma.billingPeriod.upsert({
    where: { buildingId_year: { buildingId: building.id, year: 2024 } },
    update: {},
    create: { buildingId: building.id, year: 2024 }
  });

  // Smazání starých výsledků pro čistý import
  console.log('🧹 Mazání starých výsledků...');
  await prisma.billingResult.deleteMany({ where: { billingPeriodId: period.id } });

  // Data pro kontrolní modul (Služba -> {celkemDleExcelu, celkemSoucetJednotek})
  const controlData: Record<string, { excelTotal: number, calculatedSum: number }> = {};

  // 4. Hlavní smyčka přes jednotky
  for (const unitData of units) {
    const unitName = unitData.name;
    console.log(`🔄 Zpracovávám: ${unitName}`);

    // A. Nastavit jednotku v Excelu
    // B4 = col 1, row 3
    hf.setCellContents({ sheet: inputSheetId, col: 1, row: 3 }, [[unitName]]);

    // B. Najít jednotku v DB
    const cleanUnitName = unitName.replace('Jednotka č. ', '').trim();
    const dbUnit = await prisma.unit.findFirst({
      where: { 
        buildingId: building.id,
        OR: [
          { unitNumber: unitName },
          { unitNumber: `Jednotka č. ${unitName}` },
          { unitNumber: cleanUnitName }
        ]
      },
      include: { ownerships: { include: { owner: true } } }
    });

    if (!dbUnit) {
      console.warn(`   ⚠️ Jednotka ${unitName} nenalezena v DB, přeskakuji.`);
      continue;
    }

    // Aktualizace vlastníka
    if (dbUnit.ownerships.length > 0) {
      const owner = dbUnit.ownerships[0].owner;
      // Rozdělení jména na First/Last pokud je v jednom stringu
      // Předpoklad: "Příjmení Jméno" nebo "Firma"
      // Pro jednoduchost uložíme celé do lastName pokud není mezera, jinak rozdělíme
      let firstName = '';
      let lastName = unitData.ownerName;
      if (unitData.ownerName.includes(' ')) {
        const parts = unitData.ownerName.split(' ');
        lastName = parts[0]; // První slovo je obvykle příjmení
        firstName = parts.slice(1).join(' ');
      }

      await prisma.owner.update({
        where: { id: owner.id },
        data: {
          firstName: firstName || owner.firstName, // Zachovat pokud je prázdné
          lastName: lastName || owner.lastName,
          address: unitData.address,
          email: unitData.email,
          phone: unitData.phone,
          bankAccount: unitData.bankAccount
        }
      });
    }

    // Načtení měsíčních dat (Platby a Předpisy)
    // Platby: Řádek 40 (index 39), sloupce A-L (0-11)
    // Předpisy: Řádek 45 (index 44), sloupce A-L (0-11)
    const monthlyPayments: number[] = [];
    const monthlyPrescriptions: number[] = [];

    for (let m = 0; m < 12; m++) {
      const payVal = hf.getCellValue({ sheet: outputSheetId, col: m, row: 39 }); // Řádek 40
      const presVal = hf.getCellValue({ sheet: outputSheetId, col: m, row: 44 }); // Řádek 45
      
      monthlyPayments.push(typeof payVal === 'number' ? payVal : 0);
      monthlyPrescriptions.push(typeof presVal === 'number' ? presVal : 0);
    }

    // C. Vytvořit BillingResult
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: period.id,
        unitId: dbUnit.id,
        totalCost: 0, // Dopočítáme později nebo vezmeme z Excelu
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

    // D. Číst řádky služeb
    for (let row = ROW_START - 1; row < ROW_END; row++) {
      const serviceNameVal = hf.getCellValue({ sheet: outputSheetId, col: COL_SERVICE_NAME, row: row });
      
      // Pokud není název služby, konec tabulky nebo prázdný řádek
      if (!serviceNameVal || typeof serviceNameVal !== 'string' || serviceNameVal.trim() === '' || serviceNameVal.includes('Celkem')) continue;

      const serviceName = serviceNameVal.toString().trim();
      
      // Čtení hodnot (ošetření chyb #VALUE! atd.)
      const getNum = (col: number) => {
        const val = hf.getCellValue({ sheet: outputSheetId, col: col, row: row });
        return typeof val === 'number' ? val : 0;
      };

      const totalBuildingCost = getNum(COL_TOTAL_COST);
      const unitCost = getNum(COL_UNIT_COST);
      const advance = getNum(COL_ADVANCE);
      const result = getNum(COL_RESULT);

      // Aktualizace kontrolních dat
      if (!controlData[serviceName]) {
        controlData[serviceName] = { excelTotal: totalBuildingCost, calculatedSum: 0 };
      }
      controlData[serviceName].calculatedSum += unitCost;

      // Uložení do DB
      // 1. Najít nebo vytvořit službu
      let service = await prisma.service.findFirst({
        where: { buildingId: building.id, name: serviceName }
      });

      if (!service) {
        service = await prisma.service.create({
          data: {
            buildingId: building.id,
            name: serviceName,
            code: serviceName.toUpperCase().replace(/\s+/g, '_').substring(0, 20),
            methodology: 'CUSTOM', // Upraveno na existující enum
          }
        });
      }

      // 2. Uložit nebo aktualizovat BillingServiceCost
      const existingCost = await prisma.billingServiceCost.findUnique({
        where: {
          billingResultId_serviceId: {
            billingResultId: billingResult.id,
            serviceId: service.id
          }
        }
      });

      if (existingCost) {
        // Pokud již existuje, přičteme hodnoty (agregace řádků se stejným názvem)
        await prisma.billingServiceCost.update({
          where: { id: existingCost.id },
          data: {
            buildingTotalCost: { increment: totalBuildingCost },
            unitCost: { increment: unitCost },
            unitAdvance: { increment: advance },
            unitBalance: { increment: result },
            calculationBasis: existingCost.calculationBasis + `, Řádek ${row + 1}`
          }
        });
      } else {
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
      }

      unitTotalCost += unitCost;
      unitTotalAdvance += advance;
      unitTotalBalance += result;
    }

    // Aktualizace součtů v BillingResult
    await prisma.billingResult.update({
      where: { id: billingResult.id },
      data: {
        totalCost: unitTotalCost,
        totalAdvancePrescribed: unitTotalAdvance,
        result: unitTotalBalance
      }
    });
  }

  // 5. Kontrolní modul - Výpis
  console.log('\n📊 --- KONTROLNÍ MODUL ---');
  console.log('Služba'.padEnd(40) + ' | ' + 'Excel Celkem (E)'.padStart(15) + ' | ' + 'Součet Jednotek'.padStart(15) + ' | ' + 'Rozdíl'.padStart(15));
  console.log('-'.repeat(95));

  let totalDiff = 0;
  for (const [service, data] of Object.entries(controlData)) {
    const diff = data.excelTotal - data.calculatedSum;
    totalDiff += Math.abs(diff);
    
    const status = Math.abs(diff) < 1 ? '✅' : '❌';
    
    console.log(
      `${status} ${service.padEnd(37)} | ` +
      `${data.excelTotal.toFixed(2)}`.padStart(15) + ' | ' +
      `${data.calculatedSum.toFixed(2)}`.padStart(15) + ' | ' +
      `${diff.toFixed(2)}`.padStart(15)
    );
  }
  console.log('-'.repeat(95));
  if (totalDiff < 10) {
    console.log('✅ Všechna data byla úspěšně rozúčtována (rozdíly jsou zanedbatelné zaokrouhlení).');
  } else {
    console.log('⚠️ Pozor! Některé služby se nerozúčtovaly celé. Zkontrolujte, zda nechybí jednotky.');
  }

}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
