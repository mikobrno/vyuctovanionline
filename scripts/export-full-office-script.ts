type ExcelPrimitive = string | number | boolean | null;

declare namespace ExcelScript {
  type RangeValue = ExcelPrimitive;

  interface RangeFont {
    setBold(value: boolean): void;
    setColor(color: string): void;
  }

  interface RangeFill {
    setColor(color: string): void;
  }

  interface RangeFormat {
    setColumnWidth(width: number): void;
    getFont(): RangeFont;
    getFill(): RangeFill;
  }

  interface Range {
    getValues(): RangeValue[][];
    setValue(value: RangeValue | string): void;
    setValues(values: (string | number)[][]): void;
    clear(): void;
    getRowCount(): number;
    getFormat(): RangeFormat;
  }

  interface Worksheet {
    getName(): string;
    getRange(address: string): Range;
    getRangeByIndexes(startRow: number, startColumn: number, rowCount: number, columnCount: number): Range;
    getUsedRange(): Range | undefined;
  }

  interface Application {
    calculate(): void;
  }

  interface Workbook {
    getWorksheet(name: string): Worksheet | undefined;
    getWorksheets(): Worksheet[];
    addWorksheet(name: string): Worksheet;
    getApplication(): Application;
  }
}

type DataType =
  | 'INFO'
  | 'COST'
  | 'METER'
  | 'PAYMENT_MONTHLY'
  | 'ADVANCE_MONTHLY'
  | 'FIXED_PAYMENT'
  | 'BUILDING_INFO';

const BUILDING_INFO_UNIT_NAME = '__BUILDING__';

interface ExportRow {
  unitName: string;
  dataType: DataType;
  key: string;
  values: (string | number)[];
  sourceRow?: string;
}

interface UnitRecord {
  code: string;
  owner?: string;
  address?: string;
  email?: string;
  phone?: string;
  bankAccount?: string;
}

interface ExtractedUnitInfo {
  unitName: string;
  normalizedUnit: string;
  ownerName: string;
  variableSymbol: string;
  email: string;
  bankAccount: string;
  totalResult: number;
  totalCost: number;
  totalAdvance: number;
  repairFund: number;
  resultNote: string;
  periodBalance: number;
  previousPeriodBalance: number;
  grandTotal: number;
  sourceSheetMeta: SourceSheetMeta;
}

interface SourceSheetMeta {
  sheetName: string;
  rows: number;
  cols: number;
  hash: string;
}

interface UnitSwitchAudit {
  unitCode: string;
  unitName: string;
  sheetName: string;
  rows: number;
  cols: number;
  hash: string;
  attempts: number;
}

interface FixedPaymentExtract {
  name: string;
  amount: number;
  sourceRow: string;
}

interface UnitTotalsExtract {
  totalCost: number;
  totalAdvance: number;
  totalResult: number;
  sourceRow: string;
}

interface NamedAmountExtract {
  amount: number;
  sourceRow: string;
}

interface ServiceExtract {
  name: string;
  shareText: string;
  unitUnitsText: string;
  unitCost: number;
  advance: number;
  measurement: string;
  buildingCost: number;
  buildingUnitsText: string;
  unitPriceText: string;
  distributionBase: string;
  balance: number;
  sourceRow: string;
}

interface MeterRecord {
  service: string;
  serial: string;
  start: number;
  end: number;
  consumption: number;
  sourceRow: string;
}

interface ExportStats {
  units: number;
  services: number;
  meters: number;
  payments: number;
  advances: number;
}

interface BuildingInfo {
  bankAccount: string;
  address?: string;
  name?: string;
}

const MONTH_KEYWORDS = ['leden', 'unor', 'březen', 'brezen', 'duben', 'květen', 'kveten', 'cerven', 'cervenec', 'srpen', 'zari', 'rijen', 'listopad', 'prosinec'];
const PAYMENT_LABELS = ['úhrady', 'uhrazeno', 'platby', 'přehled úhrad', 'prehled uhrad'];
const ADVANCE_LABELS = ['předpis', 'predpis', 'zálohy', 'přehled předpisů', 'prehled predpisu'];
const RESULT_LABELS = ['k úhradě', 'výsledek vyúčtování', 'přeplatek', 'nedoplatek'];
const IGNORED_SERVICE_PATTERNS = [/^celkem/i, /^náklady/i, /^vyúčtovani/i, /^přeplatek/i, /^k úhradě/i];

function main(workbook: ExcelScript.Workbook): void {
  const VERSION = 'V91-EXPORT_FULL';
  const YEAR = 2024;
  const N8N_WEBHOOK = 'https://n8n.srv882016.hstgr.cloud/webhook/excel-import';

  console.log(`🚀 EXPORT_FULL ${VERSION} - start`);

  const evidenceSheet = findSheet(workbook, ['Evidence']);
  const vstupniSheet = findSheet(workbook, ['vstupní data', 'Vstupní data']);
  const fakturySheet = findSheet(workbook, ['Vyúčtování byt - 1.část', 'Faktury']);

  if (!evidenceSheet || !vstupniSheet || !fakturySheet) {
    console.log('❌ Chybí některý z povinných listů (Evidence, vstupní data, Vyúčtování).');
    return;
  }

  const exportSheet = ensureSheet(workbook, 'EXPORT_FULL');
  const jsonSheet = ensureSheet(workbook, 'JSON_OUTPUT');
  exportSheet.getUsedRange()?.clear();
  jsonSheet.getUsedRange()?.clear();

  const application = workbook.getApplication();

  const units = collectUnits(evidenceSheet);
  console.log(`📋 Jednotky k exportu: ${units.length}`);

  const meterSheet = findSheet(workbook, ['Odečty formular', 'Odečty formulář', 'Odečty']);
  const meterIndex = buildMeterMap(meterSheet);

  const paymentsSheet = findSheet(workbook, ['uhrady', 'úhrady', 'platby']);
  const monthlyPaymentsIndex = buildMonthlyMap(paymentsSheet);

  const advancesSheet = findSheet(workbook, ['Předpis po mesici', 'Zálohy byt - měsíčně', 'Předpisy']);
  const monthlyAdvancesIndex = buildMonthlyMap(advancesSheet);

  const exportRows: ExportRow[] = [];
  const stats: ExportStats = { units: 0, services: 0, meters: 0, payments: 0, advances: 0 };
  let buildingInfoAdded = false;
  let cachedBuildingInfo: BuildingInfo | null = null;
  let lastBillingSheetHash: string | null = null;
  let lastUnitCode: string | null = null;
  const unitSwitchAudit: UnitSwitchAudit[] = [];

  for (const unit of units) {
    if (!unit.code) continue;
    // Přepnutí jednotky + robustní refresh (formule někdy nereagují na první calculate)
    const refreshed = refreshBillingSheetForUnit(vstupniSheet, fakturySheet, application, unit.code, lastBillingSheetHash);
    const sourceValues = refreshed.values;
    const inputValues = vstupniSheet.getUsedRange()?.getValues() ?? [];
    const billingSheetMeta = refreshed.meta;

    if (lastBillingSheetHash && billingSheetMeta.hash === lastBillingSheetHash && lastUnitCode && lastUnitCode !== unit.code) {
      console.log(`⚠️ Varování: list Vyúčtování se po přepnutí jednotky nezměnil (hash=${billingSheetMeta.hash}). unit=${unit.code}, předtím=${lastUnitCode}`);
    }

    lastBillingSheetHash = billingSheetMeta.hash;
    lastUnitCode = unit.code;

    if (!buildingInfoAdded) {
      // PRIORITA 1: Přímé čtení z buňky B35 na vstupní data (tam je účet SVJ)
      const directBankAccount = extractDirectBankAccount(vstupniSheet);
      if (directBankAccount) {
        cachedBuildingInfo = { bankAccount: directBankAccount };
        exportRows.push(createBuildingInfoRow(cachedBuildingInfo));
        buildingInfoAdded = true;
        console.log(`🏦 Účet SVJ z B35: ${directBankAccount}`);
      } else {
        // PRIORITA 2: Hledáme na obou listech
        cachedBuildingInfo = extractBuildingInfo(sourceValues) || extractBuildingInfo(inputValues) || cachedBuildingInfo;
        if (cachedBuildingInfo && cachedBuildingInfo.bankAccount) {
          exportRows.push(createBuildingInfoRow(cachedBuildingInfo));
          buildingInfoAdded = true;
          console.log(`🏦 Účet SVJ: ${cachedBuildingInfo.bankAccount}`);
        }
      }
    }

    const services = extractServiceRows(sourceValues);
    const fixedPayments = extractFixedPayments(sourceValues);
    const totalsFromBilling = extractUnitTotalsFromBillingSheet(sourceValues);
    const periodBalanceFromBilling = extractNamedAmount(sourceValues, [
      'nedoplatek v účtovaném období',
      'nedoplatek v uctovanem obdobi',
      'přeplatek v účtovaném období',
      'preplatek v uctovanem obdobi'
    ]);
    const previousPeriodBalanceFromBilling = extractNamedAmount(sourceValues, [
      'v minulém období',
      'v minulem obdobi'
    ]);
    const grandTotalFromBilling = extractNamedAmount(sourceValues, [
      'nedoplatek celkem',
      'preplatek celkem',
      'přeplatek celkem'
    ]);

    const info = extractUnitInfo(
      unit,
      inputValues,
      services,
      fixedPayments,
      totalsFromBilling,
      periodBalanceFromBilling,
      previousPeriodBalanceFromBilling,
      grandTotalFromBilling,
      billingSheetMeta
    );

    unitSwitchAudit.push({
      unitCode: unit.code,
      unitName: info.unitName,
      sheetName: billingSheetMeta.sheetName,
      rows: billingSheetMeta.rows,
      cols: billingSheetMeta.cols,
      hash: billingSheetMeta.hash,
      attempts: refreshed.attempts,
    });

    exportRows.push(createInfoRow(info));
    stats.units++;

    services.forEach(service => {
      exportRows.push(createCostRow(info.unitName, service));
    });
    stats.services += services.length;

    fixedPayments.forEach(payment => {
      exportRows.push(createFixedPaymentRow(info.unitName, payment));
    });

    const inlinePayments = extractInlineMonthlyData(sourceValues, PAYMENT_LABELS);
    const inlineAdvances = extractInlineMonthlyData(sourceValues, ADVANCE_LABELS);

    // Debug log pro první jednotku
    if (stats.units === 1) {
      console.log(`📊 DEBUG první jednotka ${info.unitName}:`);
      console.log(`   Payments: ${inlinePayments ? inlinePayments.join(', ') : 'null'}`);
      console.log(`   Advances: ${inlineAdvances ? inlineAdvances.join(', ') : 'null'}`);
    }

    const normalizedKey = info.normalizedUnit;
    const payments = inlinePayments || monthlyPaymentsIndex.get(normalizedKey) || [];
    if (payments.some(v => v !== 0)) {
      exportRows.push(createMonthlyRow(info.unitName, 'PAYMENT_MONTHLY', 'Úhrady', payments));
      stats.payments++;
    }

    const advances = inlineAdvances || monthlyAdvancesIndex.get(normalizedKey) || [];
    if (advances.some(v => v !== 0)) {
      exportRows.push(createMonthlyRow(info.unitName, 'ADVANCE_MONTHLY', 'Předpisy', advances));
      stats.advances++;
    }

    const meters = meterIndex.get(normalizedKey) || [];
    meters.forEach(meter => exportRows.push(createMeterRow(info.unitName, meter)));
    stats.meters += meters.length;
  }

  writeExportSheet(exportSheet, exportRows);

  const summary = {
    version: VERSION,
    year: YEAR,
    units: stats.units,
    rows: exportRows.length,
    services: stats.services,
    meters: stats.meters,
    payments: stats.payments,
    advances: stats.advances,
    unitSwitchAudit,
    generatedAt: new Date().toISOString()
  };

  jsonSheet.getRange('A1').setValue(JSON.stringify(summary, null, 2));
  jsonSheet.getRange('A2').setValue(N8N_WEBHOOK);
  jsonSheet.getRange('A1').getFormat().setColumnWidth(180);

  // Přehledná tabulka auditů (rychlá kontrola přepínání + hash)
  const auditHeader: (string | number)[][] = [['UnitCode', 'UnitName', 'Sheet', 'Rows', 'Cols', 'Hash', 'Attempts']];
  const auditTable: (string | number)[][] = auditHeader.concat(
    unitSwitchAudit.map(row => [
      row.unitCode,
      row.unitName,
      row.sheetName,
      row.rows,
      row.cols,
      row.hash,
      row.attempts
    ])
  );
  jsonSheet.getRangeByIndexes(3, 0, auditTable.length, auditHeader[0].length).setValues(auditTable);

  console.log(`✅ Hotovo: ${exportRows.length} řádků, ${stats.units} jednotek.`);
}

function refreshBillingSheetForUnit(
  vstupniSheet: ExcelScript.Worksheet,
  fakturySheet: ExcelScript.Worksheet,
  application: ExcelScript.Application,
  unitCode: string,
  previousHash: string | null
): { values: ExcelScript.RangeValue[][]; meta: SourceSheetMeta; attempts: number } {
  const unitCell = vstupniSheet.getRange('B4');
  let attempts = 1;

  // 1) standardní přepnutí
  unitCell.setValue(unitCode);
  application.calculate();

  let values = fakturySheet.getUsedRange()?.getValues() ?? [];
  let meta = buildSheetMeta(fakturySheet.getName(), values);

  // 2) pokud hash zůstává stejný jako předchozí jednotka, zkus reset + recalculace
  if (previousHash && meta.hash === previousHash) {
    attempts = 2;
    unitCell.setValue('');
    application.calculate();
    unitCell.setValue(unitCode);
    application.calculate();
    application.calculate();

    values = fakturySheet.getUsedRange()?.getValues() ?? [];
    meta = buildSheetMeta(fakturySheet.getName(), values);
  }

  return { values, meta, attempts };
}

function findSheet(workbook: ExcelScript.Workbook, candidates: string[]): ExcelScript.Worksheet | null {
  for (const name of candidates) {
    const sheet = workbook.getWorksheet(name);
    if (sheet) return sheet;
  }
  const normalizedCandidates = candidates.map(label => normalizeString(label));
  for (const sheet of workbook.getWorksheets()) {
    const normalizedName = normalizeString(sheet.getName());
    if (normalizedCandidates.some(label => normalizedName.includes(label))) {
      return sheet;
    }
  }
  return null;
}

function ensureSheet(workbook: ExcelScript.Workbook, name: string): ExcelScript.Worksheet {
  return workbook.getWorksheet(name) ?? workbook.addWorksheet(name);
}

function collectUnits(sheet: ExcelScript.Worksheet): UnitRecord[] {
  const range = sheet.getUsedRange();
  if (!range) return [];
  const values = range.getValues();
  const units: UnitRecord[] = [];
  const seen = new Set<string>();
  for (const row of values.slice(1)) {
    const code = sanitizeText(row[0]);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    units.push({
      code,
      owner: sanitizeText(row[1]),
      address: sanitizeText(row[2]),
      email: sanitizeText(row[3]),
      phone: sanitizeText(row[4]),
      bankAccount: sanitizeText(row[10])
    });
  }
  return units;
}

function extractServiceRows(values: ExcelScript.RangeValue[][]): ServiceExtract[] {
  const services: ServiceExtract[] = [];
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length < 11) continue;
    const serviceName = sanitizeText(row[0]);
    if (!serviceName || IGNORED_SERVICE_PATTERNS.some(regex => regex.test(serviceName))) {
      continue;
    }

    const buildingCost = toNumber(row[4]);
    const unitCost = toNumber(row[8]);
    const advance = toNumber(row[9]);
    // Viewer-only: nikdy nedopočítávat balance (když v Excelu není, necháme 0)
    const balance = hasExcelValue(row[10]) ? toNumber(row[10]) : 0;
    if (buildingCost === 0 && unitCost === 0 && advance === 0 && balance === 0) continue;

    services.push({
      name: serviceName,
      shareText: formatShare(row[3]),
      unitUnitsText: formatNumericText(row[7]),
      unitCost,
      advance,
      measurement: sanitizeText(row[1]) || sanitizeText(row[2]),
      buildingCost,
      buildingUnitsText: formatNumericText(row[5]),
      unitPriceText: formatNumericText(row[6]),
      distributionBase: sanitizeText(row[2]) || '',
      balance,
      sourceRow: `Row${r + 1}`
    });
  }
  return services;
}

function extractUnitInfo(
  unit: UnitRecord,
  inputValues: ExcelScript.RangeValue[][],
  services: ServiceExtract[],
  fixedPayments: FixedPaymentExtract[],
  totalsFromBilling: UnitTotalsExtract | null,
  periodBalanceFromBilling: NamedAmountExtract | null,
  previousPeriodBalanceFromBilling: NamedAmountExtract | null,
  grandTotalFromBilling: NamedAmountExtract | null,
  sourceSheetMeta: SourceSheetMeta
): ExtractedUnitInfo {
  const ownerFromSheet = extractLabelValue(inputValues, ['vlastník', 'majitel']);
  const variableSymbol = extractLabelValue(inputValues, ['variabilní symbol', 'variable symbol']) || deriveVsFromCode(unit.code);
  const email = extractLabelValue(inputValues, ['email']);
  const bankAccount = extractLabelValue(inputValues, ['bankovní spojení', 'číslo účtu']) || unit.bankAccount || '';
  const displayName = extractLabelValue(inputValues, ['jednotka č', 'byt č']) || unit.code;
  const resultFromSheet = extractLabelNumber(inputValues, RESULT_LABELS);
  const fallbackResult = totalsFromBilling?.totalResult ?? 0;

  // Viewer-only: preferuj vždy součty přímo z listu vyúčtování (Celkem vyúčtování)
  const totalCostFromSheet = totalsFromBilling?.totalCost ??
    (extractLabelNumber(inputValues, [
      'celkem náklady',
      'celkem naklady',
      'náklady celkem',
      'naklady celkem',
      'celkové náklady',
      'celkove naklady',
    ]) ?? 0);

  const totalAdvanceFromSheet = totalsFromBilling?.totalAdvance ??
    (extractLabelNumber(inputValues, [
      'celkem zálohy',
      'celkem zalohy',
      'zálohy celkem',
      'zalohy celkem',
      'celkové zálohy',
      'celkove zalohy',
      'předpis celkem',
      'predpis celkem',
    ]) ?? 0);

  // Fond oprav: buď explicitně z input listu, nebo z tabulky pevných plateb
  const repairFundFromInput = extractLabelNumber(inputValues, ['fond oprav', 'fo']);
  const repairFundFromFixed = fixedPayments.find(p => normalizeString(p.name).includes('fond oprav'))?.amount;
  const repairFundFromSheet = repairFundFromInput ?? (typeof repairFundFromFixed === 'number' ? repairFundFromFixed : 0);

  const resultNoteFromSheet =
    extractLabelValue(inputValues, ['poznámka', 'poznamka', 'poznámka k výsledku', 'poznamka k vysledku', 'instrukce']) ||
    '';

  const periodBalance = periodBalanceFromBilling?.amount ?? 0;
  const previousPeriodBalance = previousPeriodBalanceFromBilling?.amount ?? 0;
  const grandTotal = grandTotalFromBilling?.amount ?? 0;

  return {
    unitName: displayName,
    normalizedUnit: normalizeUnitKey(displayName),
    ownerName: ownerFromSheet || unit.owner || '',
    variableSymbol,
    email: email || unit.email || '',
    bankAccount,
    totalResult: (resultFromSheet ?? totalsFromBilling?.totalResult ?? fallbackResult),
    totalCost: totalCostFromSheet,
    totalAdvance: totalAdvanceFromSheet,
    repairFund: repairFundFromSheet,
    resultNote: resultNoteFromSheet,
    periodBalance,
    previousPeriodBalance,
    grandTotal,
    sourceSheetMeta,
  };
}

function extractUnitTotalsFromBillingSheet(values: ExcelScript.RangeValue[][]): UnitTotalsExtract | null {
  const needles = ['celkem vyuctovani', 'celkem vyúčtování'];

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;
    const joined = row.map(cell => normalizeString(sanitizeText(cell))).join(' ');
    if (!joined) continue;
    if (!needles.some(n => joined.includes(n))) continue;

    // V řádku bývají vedle sebe: celkem náklad (uživatel), celkem záloha, celkem rozdíl.
    // Vezmeme číselné hodnoty z konce řádku (přeplatky/nedoplatky mohou být záporné).
    const numbers: number[] = [];
    for (let c = 0; c < row.length; c++) {
      if (!hasExcelValue(row[c])) continue;
      const raw = sanitizeText(row[c]);
      if (!raw) continue;
      // číselné buňky typicky obsahují číslice nebo minus
      if (!/[0-9]/.test(raw)) continue;
      const n = toNumber(row[c]);
      if (n === 0) continue;
      numbers.push(n);
    }

    if (numbers.length < 3) {
      continue;
    }

    const totalResult = numbers[numbers.length - 1];
    const totalAdvance = numbers[numbers.length - 2];
    const totalCost = numbers[numbers.length - 3];

    return {
      totalCost,
      totalAdvance,
      totalResult,
      sourceRow: `Row${r + 1}`,
    };
  }

  return null;
}

function extractInlineMonthlyData(values: ExcelScript.RangeValue[][], labels: string[]): number[] | null {
  const normalizedLabels = labels.map(l => normalizeString(l));
  
  // Hledáme řádek s nadpisem obsahujícím label (např. "Přehled úhrad za rok 2024")
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    
    // Projdeme buňky v řádku - hledáme nadpis
    for (let c = 0; c < Math.min(5, row.length); c++) {
      const cellText = normalizeString(sanitizeText(row[c]));
      if (!cellText) continue;
      
      // Našli jsme nadpis obsahující label?
      if (normalizedLabels.some(label => cellText.includes(label))) {
        // Hledáme hlavičku měsíců v následujících řádcích
        for (let headerRow = r; headerRow < Math.min(r + 5, values.length); headerRow++) {
          const hRow = values[headerRow];
          const monthColumns: number[] = [];
          
          for (let col = 0; col < hRow.length; col++) {
            const hCellText = sanitizeText(hRow[col]).toLowerCase().replace(/\s/g, '');
            // Hledáme měsíce: 1/2024, 2/2024, 1.2024, leden, únor...
            if (/^\d{1,2}[\/\.]\d{2,4}$/.test(hCellText) ||
                /^\d{1,2}[\/\.]20\d{2}$/.test(hCellText) ||
                MONTH_KEYWORDS.some(m => hCellText.includes(m))) {
              monthColumns.push(col);
            }
          }
          
          // Našli jsme aspoň 6 měsíčních sloupců?
          if (monthColumns.length >= 6) {
            // Hodnoty jsou v následujícím řádku
            const dataRowIndex = headerRow + 1;
            if (dataRowIndex < values.length) {
              const dataRow = values[dataRowIndex];
              const months: number[] = [];
              
              for (let i = 0; i < Math.min(12, monthColumns.length); i++) {
                const colIdx = monthColumns[i];
                months.push(toNumber(dataRow[colIdx]));
              }
              
              // Doplníme na 12 měsíců
              while (months.length < 12) {
                months.push(0);
              }
              
              if (months.some(value => value !== 0)) {
                return months.slice(0, 12);
              }
            }
          }
        }
      }
    }
  }
  
  // Fallback: původní logika pro případ že je label přímo v řádku s hodnotami
  // (např. Měsíc | 1/2024 | 2/2024... a pod tím Uhrazeno | 70 | 70...)
  let headerRowIndex = -1;
  let monthColumns: number[] = [];
  
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const foundMonthCols: number[] = [];
    
    for (let c = 0; c < row.length; c++) {
      const cellText = sanitizeText(row[c]).toLowerCase().replace(/\s/g, '');
      if (/^\d{1,2}[\/\.]\d{2,4}$/.test(cellText) ||
          /^\d{1,2}[\/\.]20\d{2}$/.test(cellText) ||
          MONTH_KEYWORDS.some(m => cellText.includes(m))) {
        foundMonthCols.push(c);
      }
    }
    
    if (foundMonthCols.length >= 6) {
      headerRowIndex = r;
      monthColumns = foundMonthCols.slice(0, 12);
      break;
    }
  }
  
  // Hledáme řádek s labelem pod hlavičkou
  for (let r = Math.max(0, headerRowIndex + 1); r < values.length; r++) {
    const row = values[r];
    
    for (let c = 0; c < Math.min(5, row.length); c++) {
      const cellText = normalizeString(sanitizeText(row[c]));
      if (!cellText) continue;
      
      if (normalizedLabels.some(label => cellText.includes(label) || cellText === label)) {
        const months: number[] = [];
        
        if (monthColumns.length >= 6) {
          for (const colIdx of monthColumns) {
            months.push(toNumber(row[colIdx]));
          }
        } else {
          for (let offset = 1; offset <= 12; offset++) {
            const colIdx = c + offset;
            if (colIdx < row.length) {
              months.push(toNumber(row[colIdx]));
            } else {
              months.push(0);
            }
          }
        }
        
        while (months.length < 12) {
          months.push(0);
        }
        
        if (months.some(value => value !== 0)) {
          return months.slice(0, 12);
        }
      }
    }
  }
  
  return null;
}

function buildMonthlyMap(sheet: ExcelScript.Worksheet | null): Map<string, number[]> {
  const map = new Map<string, number[]>();
  if (!sheet) return map;
  const range = sheet.getUsedRange();
  if (!range) return map;
  const values = range.getValues();
  if (!values.length) return map;

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(values.length, 25); r++) {
    const rowText = values[r].map(value => sanitizeText(value).toLowerCase());
    const matches = rowText.filter(cell => MONTH_KEYWORDS.some(month => cell.includes(month) || cell === `${MONTH_KEYWORDS.indexOf(month) + 1}`)).length;
    if (matches >= 6) {
      headerRowIndex = r;
      break;
    }
  }
  if (headerRowIndex === -1) return map;

  const headerRow = values[headerRowIndex];
  const monthColumns: number[] = [];
  headerRow.forEach((cell, index) => {
    const text = sanitizeText(cell).toLowerCase();
    const hit = MONTH_KEYWORDS.findIndex(keyword => text.includes(keyword) || text === `${keyword}` || text === `${MONTH_KEYWORDS.indexOf(keyword) + 1}`);
    if (hit >= 0 && monthColumns.length < 12) {
      monthColumns.push(index);
    }
  });
  if (monthColumns.length < 3) return map;

  const unitColumn = findColumnIndex(headerRow, ['jednot', 'byt', 'unit', 'kód']) ?? 0;

  for (let r = headerRowIndex + 1; r < values.length; r++) {
    const row = values[r];
    const unitName = sanitizeText(row[unitColumn]);
    if (!unitName) continue;
    const normalized = normalizeUnitKey(unitName);
    const months = monthColumns.slice(0, 12).map(col => toNumber(row[col]));
    map.set(normalized, months);
  }

  return map;
}

function buildMeterMap(sheet: ExcelScript.Worksheet | null): Map<string, MeterRecord[]> {
  const map = new Map<string, MeterRecord[]>();
  if (!sheet) return map;
  const values = sheet.getUsedRange()?.getValues() ?? [];
  if (!values.length) return map;

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(values.length, 50); r++) {
    const rowText = values[r].map(value => sanitizeText(value).toLowerCase()).join(' ');
    if (rowText.includes('měř') && (rowText.includes('počáte') || rowText.includes('start'))) {
      headerRowIndex = r;
      break;
    }
  }
  if (headerRowIndex === -1) return map;

  const header = values[headerRowIndex];
  const unitColumn = findColumnIndex(header, ['jednot', 'byt', 'unit']);
  const serviceColumn = findColumnIndex(header, ['služ', 'service', 'typ']);
  const serialColumn = findColumnIndex(header, ['výrob', 'serial', 'číslo']);
  const startColumn = findColumnIndex(header, ['počáte', 'start']);
  const endColumn = findColumnIndex(header, ['koneč', 'end']);
  const consumptionColumn = findColumnIndex(header, ['spotřeb', 'consumption']);

  if (
    unitColumn === null ||
    serviceColumn === null ||
    serialColumn === null ||
    startColumn === null ||
    endColumn === null ||
    consumptionColumn === null
  ) {
    return map;
  }

  for (let r = headerRowIndex + 1; r < values.length; r++) {
    const row = values[r];
    const unitName = sanitizeText(row[unitColumn]);
    if (!unitName) continue;
    const normalized = normalizeUnitKey(unitName);
    const service = sanitizeText(row[serviceColumn]) || 'Měřená služba';
    const serial = sanitizeText(row[serialColumn]);
    const start = toNumber(row[startColumn]);
    const end = toNumber(row[endColumn]);
    const consumption = toNumber(row[consumptionColumn]) || (end - start);

    if (!map.has(normalized)) {
      map.set(normalized, []);
    }
    map.get(normalized)!.push({
      service,
      serial,
      start,
      end,
      consumption,
      sourceRow: sheet.getName() ? `${sheet.getName()}!${r + 1}` : `Row${r + 1}`
    });
  }

  return map;
}

function extractBuildingInfo(values: ExcelScript.RangeValue[][]): BuildingInfo | null {
  if (!values.length) return null;
  // Hledáme bankovní spojení SVJ - různé varianty labelů
  const bankAccountLabels = [
    'bankovní spojení společenství',
    'bankovni spojeni spolecenstvi', 
    'bankovní účet společenství',
    'bankovni ucet spolecenstvi',
    'číslo účtu svj',
    'cislo uctu svj',
    'účet svj',
    'ucet svj'
  ];
  let bankAccount = findLabelValueInRow(values, bankAccountLabels);
  
  // Fallback: hledej "bankovní spojení" které NENÍ v kontextu jednotky/člena
  if (!bankAccount) {
    bankAccount = findBuildingBankAccount(values);
  }
  
  const address = findLabelValueInRow(values, ['adresa společenství', 'adresa svj', 'adresa domu']);
  const name = findLabelValueInRow(values, ['odběrné místo', 'odberne misto', 'budova', 'dům']);
  if (!bankAccount && !address && !name) {
    return null;
  }
  return {
    bankAccount: bankAccount || '',
    address: address || undefined,
    name: name || undefined
  };
}

// Přímé čtení účtu SVJ z buňky B35 na listu "vstupní data"
function extractDirectBankAccount(sheet: ExcelScript.Worksheet): string {
  // Zkus buňku B35 kde je "bankovní spojení společenství"
  const possibleRows = [35, 34, 36, 33, 37]; // B35 a okolí
  const possibleCols = ['B', 'C', 'D'];
  
  for (const rowNum of possibleRows) {
    for (const col of possibleCols) {
      try {
        const labelCell = sheet.getRange(`A${rowNum}`);
        const valueCell = sheet.getRange(`${col}${rowNum}`);
        const labelText = normalizeString(sanitizeText(labelCell.getValues()[0][0]));
        const valueText = sanitizeText(valueCell.getValues()[0][0]);
        
        // Hledej "bankovní spojení společenství" v labelu
        if (labelText.includes('spolecenstvi') && 
            (labelText.includes('bankovni') || labelText.includes('spojeni') || labelText.includes('ucet'))) {
          
          // Nesmí obsahovat "člena"
          if (labelText.includes('clena') || labelText.includes('vlastnika')) {
            continue;
          }
          
          // Hodnota musí vypadat jako číslo účtu
          if (valueText && valueText.includes('/') && /\d{6,}/.test(valueText)) {
            console.log(`🏦 Nalezen účet SVJ na ${col}${rowNum}: ${valueText}`);
            return valueText;
          }
        }
      } catch (e) {
        // Buňka neexistuje, přeskoč
      }
    }
  }
  
  // Alternativně: projdi celý list a hledej "bankovní spojení společenství"
  const usedRange = sheet.getUsedRange();
  if (!usedRange) return '';
  const values = usedRange.getValues();
  
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    for (let c = 0; c < row.length; c++) {
      const cellText = normalizeString(sanitizeText(row[c]));
      
      // Hledej "bankovní spojení společenství"
      if (cellText.includes('spolecenstvi') && 
          (cellText.includes('bankovni') || cellText.includes('spojeni'))) {
        
        // Nesmí obsahovat "člena"
        if (cellText.includes('clena') || cellText.includes('vlastnika')) {
          continue;
        }
        
        // Hledej hodnotu v následujících buňkách
        for (let i = c + 1; i < Math.min(c + 5, row.length); i++) {
          const val = sanitizeText(row[i]);
          if (val && val.includes('/') && /\d{6,}/.test(val)) {
            console.log(`🏦 Účet SVJ nalezen na řádku ${r + 1}: ${val}`);
            return val;
          }
        }
      }
    }
  }
  
  return '';
}

function findLabelValueInRow(values: ExcelScript.RangeValue[][], labels: string[], lookahead = 6): string {
  const normalizedLabels = labels.map(label => normalizeString(label));
  for (const row of values) {
    for (let column = 0; column < row.length; column++) {
      const cellText = sanitizeText(row[column]);
      const normalizedCell = normalizeString(cellText);
      if (!normalizedCell) continue;
      
      // Přeskoč buňky obsahující "člena" nebo "vlastníka" - to je účet vlastníka, ne SVJ
      if (normalizedCell.includes('clena') || normalizedCell.includes('vlastnika')) {
        continue;
      }
      
      if (normalizedLabels.some(label => normalizedCell.includes(label))) {
        // Zkontroluj jestli hodnota je ve stejné buňce (za dvojtečkou)
        const colonIndex = cellText.indexOf(':');
        if (colonIndex > 0 && colonIndex < cellText.length - 1) {
          const valueAfterColon = cellText.substring(colonIndex + 1).trim();
          if (valueAfterColon) {
            return valueAfterColon;
          }
        }
        
        // Jinak hledej v následujících buňkách
        for (let offset = 1; offset <= lookahead; offset++) {
          const candidate = sanitizeText(row[column + offset]);
          if (candidate) {
            return candidate;
          }
        }
      }
    }
  }
  return '';
}

// Speciální funkce pro hledání bankovního účtu budovy/SVJ
// Hledá POUZE "bankovní spojení společenství" - NIKDY "bankovní spojení člena"!
// NEPOUZIVAT "nedoplatek uhraďte na účet" - tam může být účet člena!
function findBuildingBankAccount(values: ExcelScript.RangeValue[][]): string {
  // 0) Řádková detekce pro případ, že label je rozdělen do více buněk (např. "bankovní spojení:" + "společenství:")
  for (const row of values) {
    const normalizedCells = row.map(c => normalizeString(sanitizeText(c)));
    const rowText = normalizedCells.join(' ');
    if (!rowText) continue;
    if ((rowText.includes('spolecenstvi') || rowText.includes('svj')) && (rowText.includes('bankovni') || rowText.includes('spojeni') || rowText.includes('ucet'))) {
      if (rowText.includes('clena') || rowText.includes('vlastnika')) continue;

      // V některých šablonách jsou v jednom řádku zároveň údaje o SVJ i o členu.
      // Proto bereme účet co nejblíž (ideálně vpravo) od buňky, která obsahuje "společenství/SVJ".
      const idxSpol = normalizedCells.findIndex(t => (t.includes('spolecenstvi') || t.includes('svj')) && !t.includes('clena') && !t.includes('vlastnika'));
      const isAccount = (cellText: string): boolean => {
        const t = cellText.replace(/\s/g, '');
        return /\d{6,}/.test(t) && t.includes('/');
      };

      const searchOrder: number[] = [];
      if (idxSpol >= 0) {
        for (let i = idxSpol; i < Math.min(row.length, idxSpol + 10); i++) searchOrder.push(i);
        for (let i = idxSpol - 1; i >= Math.max(0, idxSpol - 10); i--) searchOrder.push(i);
      } else {
        for (let i = 0; i < row.length; i++) searchOrder.push(i);
      }

      for (const i of searchOrder) {
        const cellText = sanitizeText(row[i]);
        if (cellText && isAccount(cellText)) {
          console.log(`🏦 Účet SVJ z řádku (split label): ${cellText}`);
          return cellText.replace(/\s/g, '');
        }
      }
    }
  }

  // Projdi všechny buňky a hledej POUZE "spojení společenství" nebo "účet společenství"
  for (const row of values) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const cellText = sanitizeText(cell);
      const normalizedCell = normalizeString(cellText);
      
      // MUSÍ obsahovat "spolecenstvi" - jinak přeskoč
      if (!normalizedCell.includes('spolecenstvi') && !normalizedCell.includes('svj')) {
        continue;
      }
      
      // NESMÍ obsahovat "člena" nebo "vlastníka"
      if (normalizedCell.includes('clena') || normalizedCell.includes('vlastnika')) {
        continue;
      }
      
      // Hledej "bankovní spojení společenství" nebo podobné
      if (normalizedCell.includes('bankovni') || normalizedCell.includes('ucet') || normalizedCell.includes('spojeni')) {
        // Zkus najít účet přímo v této buňce
        const accountMatch = cellText.match(/(\d{6,}[\d\s]*\/\s*\d{4})/);
        if (accountMatch) {
          const account = accountMatch[1].replace(/\s/g, '');
          console.log(`🏦 Účet SVJ v buňce: ${account}`);
          return account;
        }
        
        // Hledej v následujících buňkách na stejném řádku
        for (let i = c + 1; i < Math.min(c + 6, row.length); i++) {
          const nextCell = sanitizeText(row[i]);
          if (nextCell && /\d{6,}/.test(nextCell) && nextCell.includes('/')) {
            console.log(`🏦 Účet SVJ vedle: ${nextCell}`);
            return nextCell;
          }
        }
      }
    }
  }
  
  // Fallback: hledej řádek kde je "společenství" a číslo účtu
  for (const row of values) {
    const rowText = row.map(c => normalizeString(sanitizeText(c))).join(' ');
    
    // Musí obsahovat "společenství", nesmí obsahovat "člena"
    if (!rowText.includes('spolecenstvi') && !rowText.includes('svj')) continue;
    if (rowText.includes('clena') || rowText.includes('vlastnika')) continue;
    
    // Najdi číslo účtu v tomto řádku
    for (const cell of row) {
      const cellText = sanitizeText(cell);
      if (cellText && /\d{6,}/.test(cellText) && cellText.includes('/')) {
        console.log(`🏦 Účet SVJ z řádku: ${cellText}`);
        return cellText;
      }
    }
  }
  
  console.log(`⚠️ Účet SVJ nenalezen!`);
  return '';
}

function createInfoRow(info: ExtractedUnitInfo): ExportRow {
  return {
    unitName: info.unitName,
    dataType: 'INFO',
    key: 'Detail',
    values: [
      info.ownerName,
      info.variableSymbol,
      info.email,
      formatCzNumber(info.totalResult),
      info.bankAccount,
      info.resultNote || '',
      formatCzNumber(info.totalCost),
      formatCzNumber(info.totalAdvance),
      formatCzNumber(info.repairFund),
      formatCzNumber(info.periodBalance),
      formatCzNumber(info.previousPeriodBalance),
      formatCzNumber(info.grandTotal),
      formatSheetMeta(info.sourceSheetMeta)
    ]
  };
}

function extractNamedAmount(values: ExcelScript.RangeValue[][], needles: string[]): NamedAmountExtract | null {
  const normNeedles = needles.map(n => normalizeString(n));
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;
    const rowText = row.map(cell => normalizeString(sanitizeText(cell))).join(' ');
    if (!rowText) continue;
    if (!normNeedles.some(n => rowText.includes(n))) continue;

    // Najdi poslední nenulové číslo v řádku
    for (let c = row.length - 1; c >= 0; c--) {
      if (!hasExcelValue(row[c])) continue;
      const raw = sanitizeText(row[c]);
      if (!raw || !/[0-9]/.test(raw)) continue;
      const n = toNumber(row[c]);
      if (n === 0) continue;
      return { amount: n, sourceRow: `Row${r + 1}` };
    }
  }
  return null;
}

function createFixedPaymentRow(unitName: string, payment: FixedPaymentExtract): ExportRow {
  return {
    unitName,
    dataType: 'FIXED_PAYMENT',
    key: payment.name,
    values: [formatCzNumber(payment.amount), '', '', '', '', '', '', '', '', '', '', '', ''],
    sourceRow: payment.sourceRow,
  };
}

function extractFixedPayments(values: ExcelScript.RangeValue[][]): FixedPaymentExtract[] {
  const results: FixedPaymentExtract[] = [];
  const headerNeedle = 'pevné platby';

  const isSectionStart = (row: ExcelScript.RangeValue[]): boolean => {
    return row.some(cell => normalizeString(sanitizeText(cell)).includes(headerNeedle));
  };

  const isSectionEnd = (row: ExcelScript.RangeValue[]): boolean => {
    const text = row.map(cell => normalizeString(sanitizeText(cell))).join(' ');
    if (!text.trim()) return false;
    return (
      PAYMENT_LABELS.some(label => text.includes(normalizeString(label))) ||
      ADVANCE_LABELS.some(label => text.includes(normalizeString(label))) ||
      text.includes('měsí') ||
      text.includes('mesic') ||
      text.includes('měřid') ||
      text.includes('merid')
    );
  };

  let startRow = -1;
  for (let r = 0; r < values.length; r++) {
    if (isSectionStart(values[r])) {
      startRow = r + 1;
      break;
    }
  }
  if (startRow === -1) return results;

  let emptyStreak = 0;
  for (let r = startRow; r < Math.min(values.length, startRow + 30); r++) {
    const row = values[r];
    if (!row) continue;
    if (isSectionEnd(row)) break;

    const nameCellIndex = row.findIndex(cell => {
      const t = sanitizeText(cell);
      return Boolean(t) && /[a-zá-ž]/i.test(t);
    });
    const name = nameCellIndex >= 0 ? sanitizeText(row[nameCellIndex]) : '';

    // Najít první nenulovou částku v řádku (mimo textového názvu)
    let amount = 0;
    for (let c = 0; c < row.length; c++) {
      if (c === nameCellIndex) continue;
      const n = toNumber(row[c]);
      if (n !== 0) {
        amount = n;
        break;
      }
    }

    if (!name && amount === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;

    const normalizedName = normalizeString(name);
    if (!normalizedName || normalizedName.startsWith('celkem')) {
      continue;
    }

    if (amount !== 0) {
      results.push({
        name,
        amount,
        sourceRow: `Row${r + 1}`,
      });
    }
  }

  return results;
}

function createBuildingInfoRow(info: BuildingInfo): ExportRow {
  return {
    unitName: BUILDING_INFO_UNIT_NAME,
    dataType: 'BUILDING_INFO',
    key: 'BuildingBankAccount',
    values: [
      info.bankAccount,
      info.address || '',
      info.name || '',
      '', '', '', '', '', '', '', '', '', ''
    ]
  };
}

function createCostRow(unitName: string, service: ServiceExtract): ExportRow {
  return {
    unitName,
    dataType: 'COST',
    key: service.name,
    values: [
      service.shareText,
      service.unitUnitsText,
      formatCzNumber(service.unitCost),
      formatCzNumber(service.advance),
      service.measurement,
      formatCzNumber(service.buildingCost),
      service.buildingUnitsText,
      service.unitPriceText,
      service.distributionBase,
      formatCzNumber(service.balance),
      '', '', ''
    ],
    sourceRow: service.sourceRow
  };
}

function createMeterRow(unitName: string, meter: MeterRecord): ExportRow {
  return {
    unitName,
    dataType: 'METER',
    key: meter.service,
    values: [
      meter.serial,
      formatCzNumber(meter.start, 3),
      formatCzNumber(meter.end, 3),
      formatCzNumber(meter.consumption, 3),
      '', '', '', '', '', '', '', '', ''
    ],
    sourceRow: meter.sourceRow
  };
}

function createMonthlyRow(unitName: string, dataType: 'PAYMENT_MONTHLY' | 'ADVANCE_MONTHLY', key: string, rawValues: number[]): ExportRow {
  const months = rawValues.slice(0, 12);
  while (months.length < 12) {
    months.push(0);
  }
  return {
    unitName,
    dataType,
    key,
    values: months.map(value => formatCzNumber(value)).concat(['']),
  };
}

function writeExportSheet(sheet: ExcelScript.Worksheet, rows: ExportRow[]): void {
  const header = ['UnitName', 'DataType', 'Key', 'Val1', 'Val2', 'Val3', 'Val4', 'Val5', 'Val6', 'Val7', 'Val8', 'Val9', 'Val10', 'Val11', 'Val12', 'Val13', 'SourceRow'];
  const table: (string | number)[][] = [header];

  for (const row of rows) {
    const values: (string | number)[] = Array(13).fill('');
    row.values.slice(0, 13).forEach((value, index) => {
      values[index] = value;
    });
    table.push([row.unitName, row.dataType, row.key, ...values, row.sourceRow || '']);
  }

  const range = sheet.getRangeByIndexes(0, 0, table.length, header.length);
  range.setValues(table);

  const headerRange = sheet.getRangeByIndexes(0, 0, 1, header.length);
  const headerFormat = headerRange.getFormat();
  headerFormat.getFont().setBold(true);
  headerFormat.getFont().setColor('#ffffff');
  headerFormat.getFill().setColor('#0f172a');

  const widths = [24, 16, 36, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 18];
  for (let column = 0; column < header.length; column++) {
    sheet.getRangeByIndexes(0, column, Math.max(1, table.length), 1).getFormat().setColumnWidth(widths[column] || 14);
  }

  const summaryRow = table.length + 2;
  sheet.getRange(`A${summaryRow}`).setValue('🔍 Kontrolní součet');
  sheet.getRange(`A${summaryRow + 1}`).setValue(`Jednotky: ${rows.filter(row => row.dataType === 'INFO').length}`);
  sheet.getRange(`A${summaryRow + 2}`).setValue(`Služby: ${rows.filter(row => row.dataType === 'COST').length}`);
  sheet.getRange(`A${summaryRow + 3}`).setValue(`Měřidla: ${rows.filter(row => row.dataType === 'METER').length}`);
}

function sanitizeText(value: ExcelScript.RangeValue | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildSheetMeta(sheetName: string, values: ExcelScript.RangeValue[][]): SourceSheetMeta {
  const rows = values.length;
  const cols = values.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);

  let hash = fnv1a32Init();
  hash = fnv1a32Update(hash, sheetName);
  hash = fnv1a32Update(hash, '\u001e');
  for (let r = 0; r < rows; r++) {
    const row = values[r] || [];
    for (let c = 0; c < cols; c++) {
      const cellText = sanitizeText(row[c]);
      hash = fnv1a32Update(hash, cellText);
      hash = fnv1a32Update(hash, '\u001f');
    }
    hash = fnv1a32Update(hash, '\u001d');
  }

  return {
    sheetName,
    rows,
    cols,
    hash: fnv1a32Finalize(hash),
  };
}

function formatSheetMeta(meta: SourceSheetMeta): string {
  // Stabilní JSON pro pozdější import a audit (Val13)
  return JSON.stringify({
    sheetName: meta.sheetName,
    rows: meta.rows,
    cols: meta.cols,
    hash: meta.hash,
  });
}

function fnv1a32Init(): number {
  return 0x811c9dc5;
}

function fnv1a32Update(hash: number, input: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function fnv1a32Finalize(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hasExcelValue(value: ExcelScript.RangeValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function normalizeString(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeUnitKey(value: string): string {
  return normalizeString(value).replace(/[^a-z0-9]/g, '');
}

function toNumber(value: ExcelScript.RangeValue | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const cleaned = String(value).replace(/\s+/g, '').replace('−', '-').replace(',', '.');
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatCzNumber(value: number | string, fractionDigits = 2): string {
  if (typeof value === 'string') return value;
  if (!isFinite(value) || Math.abs(value) < 0.0000001) return value === 0 ? '0' : '';
  const formatted = value.toFixed(fractionDigits).replace('.', ',');
  return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatShare(value: ExcelScript.RangeValue | undefined): string {
  const numeric = toNumber(value);
  if (numeric === 0) return sanitizeText(value);
  return `${formatCzNumber(numeric)} %`;
}

function formatNumericText(value: ExcelScript.RangeValue | undefined): string {
  const numeric = toNumber(value);
  if (numeric === 0) return sanitizeText(value);
  return formatCzNumber(numeric);
}

function extractLabelValue(grid: ExcelScript.RangeValue[][], labels: string[]): string {
  for (const row of grid) {
    for (let column = 0; column < Math.min(4, row.length - 1); column++) {
      const cellText = sanitizeText(row[column]).toLowerCase();
      if (!cellText) continue;
      if (labels.some(label => cellText.includes(label))) {
        return sanitizeText(row[column + 1]);
      }
    }
  }
  return '';
}

function extractLabelNumber(grid: ExcelScript.RangeValue[][], labels: string[]): number | null {
  for (const row of grid) {
    for (let column = 0; column < Math.min(4, row.length - 1); column++) {
      const cellText = sanitizeText(row[column]).toLowerCase();
      if (!cellText) continue;
      if (labels.some(label => cellText.includes(label))) {
        const value = toNumber(row[column + 1]);
        if (value !== 0) return value;
      }
    }
  }
  return null;
}

function deriveVsFromCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits || code;
}

function findColumnIndex(row: ExcelScript.RangeValue[], keywords: string[]): number | null {
  for (let i = 0; i < row.length; i++) {
    const cellText = sanitizeText(row[i]).toLowerCase();
    if (!cellText) continue;
    if (keywords.some(keyword => cellText.includes(keyword))) {
      return i;
    }
  }
  return null;
}
