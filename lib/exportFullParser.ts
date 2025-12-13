import * as XLSX from 'xlsx';
import {
  BillingService,
  MeterReading,
  UnitBillingData,
  ExportFullDataType,
  ExportFullBuildingInfo
} from '../types/export-full';

export type ExportFullWarningType =
  | 'missing-sheet'
  | 'missing-header'
  | 'missing-unit'
  | 'missing-datatype'
  | 'unknown-datatype'
  | 'meter-unmatched';

export interface ExportFullWarning {
  row: number;
  type: ExportFullWarningType;
  message: string;
}

export interface ExportFullPreviewStats {
  rowCount: number;
  unitCount: number;
  serviceCount: number;
  meterCount: number;
  fixedPaymentCount: number;
  hasBuildingInfo: boolean;
}

export interface ExportFullPreviewResult {
  units: UnitBillingData[];
  warnings: ExportFullWarning[];
  stats: ExportFullPreviewStats;
  buildingInfo?: ExportFullBuildingInfo;
}

const normalizeHeader = (h: unknown) => String(h || '').trim().toLowerCase();
const BUILDING_INFO_UNIT_NAME = '__BUILDING__';

export function parseCzechNumber(value: string | null | undefined): number {
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
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

export function cleanTextValue(value: string | null | undefined): string {
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

interface CsvLikeRow {
  UnitName: string;
  DataType: ExportFullDataType | string;
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

function ensureUnit(map: Map<string, UnitBillingData>, unitName: string) {
  if (!map.has(unitName)) {
    map.set(unitName, {
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
  return map.get(unitName)!;
}

export function parseExportFullSheet(buffer: Buffer): ExportFullPreviewResult {
  const warnings: ExportFullWarning[] = [];

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets['EXPORT_FULL'];
  if (!sheet) {
    warnings.push({ row: 0, type: 'missing-sheet', message: 'Sheet EXPORT_FULL nenalezen.' });
    return { units: [], warnings, stats: { rowCount: 0, unitCount: 0, serviceCount: 0, meterCount: 0, fixedPaymentCount: 0, hasBuildingInfo: false } };
  }

  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
  if (data.length === 0) {
    warnings.push({ row: 0, type: 'missing-header', message: 'Prázdný list EXPORT_FULL.' });
    return { units: [], warnings, stats: { rowCount: 0, unitCount: 0, serviceCount: 0, meterCount: 0, fixedPaymentCount: 0, hasBuildingInfo: false } };
  }

  const headerRow = data[0];
  const headerIndex = (name: string) => headerRow.findIndex((h: unknown) => normalizeHeader(h) === name.toLowerCase());
  const idxUnit = headerIndex('unitname');
  const idxType = headerIndex('datatype');
  const idxKey = headerIndex('key');

  if (idxUnit === -1 || idxType === -1) {
    warnings.push({ row: 0, type: 'missing-header', message: 'Chybí sloupce UnitName nebo DataType.' });
    return { units: [], warnings, stats: { rowCount: 0, unitCount: 0, serviceCount: 0, meterCount: 0, fixedPaymentCount: 0, hasBuildingInfo: false } };
  }

  const idxVal = (n: number) => headerIndex(`val${n}`);
  const idxSource = headerIndex('sourcerow');

  const rows: CsvLikeRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const unitName = cleanTextValue(row[idxUnit]);
    if (!unitName) {
      warnings.push({ row: i + 1, type: 'missing-unit', message: 'Prázdný UnitName, řádek přeskočen.' });
      continue;
    }
    const dataTypeRaw = cleanTextValue(row[idxType]).toUpperCase();
    if (!dataTypeRaw) {
      warnings.push({ row: i + 1, type: 'missing-datatype', message: `Unit ${unitName}: chybí DataType.` });
      continue;
    }

    const vals: string[] = [];
    for (let v = 1; v <= 13; v++) {
      const idx = idxVal(v);
      vals.push(idx >= 0 ? String(row[idx] ?? '') : '');
    }

    rows.push({
      UnitName: unitName,
      DataType: dataTypeRaw,
      Key: cleanTextValue(idxKey >= 0 ? row[idxKey] : ''),
      Val1: vals[0],
      Val2: vals[1],
      Val3: vals[2],
      Val4: vals[3],
      Val5: vals[4],
      Val6: vals[5],
      Val7: vals[6],
      Val8: vals[7],
      Val9: vals[8],
      Val10: vals[9],
      Val11: vals[10],
      Val12: vals[11],
      Val13: vals[12],
      SourceRow: idxSource >= 0 ? String(row[idxSource] ?? '') : ''
    });
  }

  const unitsMap = new Map<string, UnitBillingData>();
  let buildingInfo: ExportFullBuildingInfo | undefined;
  let serviceCount = 0;
  let meterCount = 0;
  let fixedPaymentCount = 0;

  for (const row of rows) {
    const type = (row.DataType || '').toUpperCase() as ExportFullDataType;

    if (type === 'BUILDING_INFO') {
      const bankAccount = cleanTextValue(row.Val1);
      const address = cleanTextValue(row.Val2);
      const name = cleanTextValue(row.Val3);

      if (bankAccount || address || name) {
        buildingInfo = {
          unitName: row.UnitName || BUILDING_INFO_UNIT_NAME,
          bankAccount,
          address: address || undefined,
          name: name || undefined,
          sourceRow: cleanTextValue(row.SourceRow) || undefined
        };
      }
      continue;
    }

    const unit = ensureUnit(unitsMap, row.UnitName);
    switch (type) {
      case 'INFO':
        unit.info = {
          owner: cleanTextValue(row.Val1), // Mgr. Patrik Neuwirth
          variableSymbol: cleanTextValue(row.Val2), // 151320011
          email: cleanTextValue(row.Val3), // patrikneu@seznam.cz
          totalResult: parseCzechNumber(row.Val4), // Celkový výsledek (prázdné v tomto případě)
          bankAccount: cleanTextValue(row.Val5) // 224623004/0300
        };
        break;
      case 'COST': {
        const serviceName = cleanTextValue(row.Key);
        if (!serviceName) break;
        const unitCost = parseCzechNumber(row.Val3); // Náklad bytu (Val3 = 3 083,04)
        const unitAdvance = parseCzechNumber(row.Val4); // Záloha bytu (Val4 = 840,00)
        const service: BillingService = {
          name: serviceName,
          buildingTotalCost: parseCzechNumber(row.Val6), // Náklad domu
          unitCost: unitCost, // Náklad bytu
          unitAdvance: unitAdvance, // Záloha bytu
          unitBalance: unitCost - unitAdvance, // Vypočítaný výsledek
          distributionShare: cleanTextValue(row.Val1), // Podíl %
          details: {
            unit: cleanTextValue(row.Val9), // Metodika
            buildingUnits: cleanTextValue(row.Val7), // Počet jednotek dům
            unitPrice: cleanTextValue(row.Val8), // Cena za jednotku
            unitUnits: cleanTextValue(row.Val2), // Podíl jednotky
            calculationMethod: cleanTextValue(row.Val9) // Metodika
          },
          meters: []
        };
        unit.services.push(service);
        serviceCount++;
        break;
      }
      case 'METER': {
        const serviceName = cleanTextValue(row.Key);
        if (!serviceName) break;
        const meter: MeterReading = {
          serial: cleanTextValue(row.Val1),
          start: parseCzechNumber(row.Val2),
          end: parseCzechNumber(row.Val3),
          consumption: parseCzechNumber(row.Val4)
        };
        const service = unit.services.find(s =>
          s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
          serviceName.toLowerCase().includes(s.name.toLowerCase())
        );
        if (service) {
          service.meters.push(meter);
          meterCount++;
        } else {
          warnings.push({ row: rows.indexOf(row) + 2, type: 'meter-unmatched', message: `Měřidlo "${serviceName}" nelze spárovat s žádnou službou jednotky ${unit.unitName}.` });
        }
        break;
      }
      case 'PAYMENT_MONTHLY':
        unit.monthlyData.payments = [
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
        unit.monthlyData.advances = [
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
      case 'FIXED_PAYMENT': {
        const name = cleanTextValue(row.Key);
        const amount = parseCzechNumber(row.Val1);
        if (name && amount !== 0) {
          unit.fixedPayments.push({ name, amount });
          fixedPaymentCount++;
        }
        break;
      }
      default:
        warnings.push({ row: rows.indexOf(row) + 2, type: 'unknown-datatype', message: `Neznámý DataType "${row.DataType}".` });
        break;
    }
  }

  const units = Array.from(unitsMap.values());
  return {
    units,
    warnings,
    stats: {
      rowCount: rows.length,
      unitCount: units.length,
      serviceCount,
      meterCount,
      fixedPaymentCount,
      hasBuildingInfo: Boolean(buildingInfo)
    },
    buildingInfo
  };
}
