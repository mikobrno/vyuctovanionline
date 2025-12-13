/**
 * types/export-full.ts
 * 
 * TypeScript typy pro EXPORT_FULL import a zpracování dat
 * Použití v aplikaci pro generování PDF a další operace
 */

/**
 * Řádek z EXPORT_FULL.csv souboru
 */
export interface ExportFullCsvRow {
  UnitName: string;
  DataType: ExportFullDataType;
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

/**
 * Typy řádků v EXPORT_FULL
 */
export type ExportFullDataType =
  | 'INFO'              // Základní údaje jednotky
  | 'COST'              // Náklady služby
  | 'METER'             // Odečty měřidel
  | 'PAYMENT_MONTHLY'   // Měsíční úhrady
  | 'ADVANCE_MONTHLY'   // Měsíční předpisy
  | 'FIXED_PAYMENT'     // Pevné platby (fond oprav)
  | 'BUILDING_INFO';    // Řádek s údaji o celé budově (číslo účtu, adresa)

/**
 * Údaje o budově z řádku BUILDING_INFO
 */
export interface ExportFullBuildingInfo {
  /** Speciální UnitName (typicky "__BUILDING__") */
  unitName: string;
  /** Číslo účtu budovy / SVJ */
  bankAccount: string;
  /** Adresa budovy */
  address?: string;
  /** Název / popis budovy */
  name?: string;
  /** Původní číslo řádku (SourceRow) pro debug */
  sourceRow?: string;
}

/**
 * Základní informace o jednotce (z řádku INFO)
 */
export interface UnitInfo {
  /** Jméno vlastníka */
  owner: string;
  /** Variabilní symbol */
  variableSymbol: string;
  /** Email vlastníka */
  email: string;
  /** Celkový výsledek vyúčtování (přeplatek/nedoplatek) */
  totalResult: number;
  /** Bankovní účet vlastníka */
  bankAccount: string;
}

/**
 * Detail nákladů služby (údaje pro tisk)
 */
export interface BillingServiceDetails {
  /** Jednotka měření (m², m³, os, GJ) */
  unit: string;
  /** Počet jednotek za celý dům */
  buildingUnits: string;
  /** Cena za jednotku (Kč/m², Kč/m³) */
  unitPrice: string;
  /** Počet jednotek pro tuto bytovou jednotku */
  unitUnits: string;
  /** Metodika výpočtu nebo podíl */
  calculationMethod: string;
}

/**
 * Odečet měřidla
 */
export interface MeterReading {
  /** Výrobní číslo měřidla */
  serial: string;
  /** Počáteční stav */
  start: number;
  /** Konečný stav */
  end: number;
  /** Spotřeba (end - start) */
  consumption: number;
}

/**
 * Náklady jedné služby pro jednotku
 */
export interface BillingService {
  /** Název služby */
  name: string;
  /** Celkový náklad za dům */
  buildingTotalCost: number;
  /** Náklad připadající na tuto jednotku */
  unitCost: number;
  /** Zaplacené zálohy */
  unitAdvance: number;
  /** Výsledek (unitCost - unitAdvance) */
  unitBalance: number;
  /** Podíl jednotky (např. "9,63%") */
  distributionShare: string;
  /** Detailní údaje pro tisk */
  details: BillingServiceDetails;
  /** Seznam měřidel pro tuto službu */
  meters: MeterReading[];
}

/**
 * Pevná platba (fond oprav, správa SVJ)
 */
export interface FixedPayment {
  /** Název platby */
  name: string;
  /** Částka */
  amount: number;
}

/**
 * Měsíční data (platby a předpisy)
 */
export interface MonthlyData {
  /** Úhrady za jednotlivé měsíce (12 hodnot) */
  payments: number[];
  /** Předpisy za jednotlivé měsíce (12 hodnot) */
  advances: number[];
}

/**
 * Kompletní data vyúčtování pro jednu jednotku
 */
export interface UnitBillingData {
  /** Název jednotky (např. "Byt 1513/01") */
  unitName: string;
  /** Základní informace */
  info: UnitInfo;
  /** Seznam služeb */
  services: BillingService[];
  /** Pevné platby */
  fixedPayments: FixedPayment[];
  /** Měsíční úhrady a předpisy */
  monthlyData: MonthlyData;
}

/**
 * Celý import - mapa jednotek
 */
export type UnitBillingDataMap = Map<string, UnitBillingData>;

/**
 * Agregovaná statistika pro budovu
 */
export interface BuildingStatistics {
  /** Počet jednotek */
  unitCount: number;
  /** Celkový náklad všech služeb */
  totalCost: number;
  /** Celkové zálohy */
  totalAdvances: number;
  /** Celkový přeplatek */
  totalOverpayment: number;
  /** Celkový nedoplatek */
  totalUnderpayment: number;
  /** Seznam všech služeb (unikátní) */
  services: string[];
  /** Počet měřidel celkem */
  meterCount: number;
}

/**
 * Výsledek parsování CSV
 */
export interface ParseResult {
  /** Úspěch parsování */
  success: boolean;
  /** Chybová hláška (pokud success = false) */
  error?: string;
  /** Data jednotek */
  units?: UnitBillingDataMap;
  /** Statistiky */
  statistics?: BuildingStatistics;
  /** Počet zpracovaných řádků CSV */
  rowCount?: number;
}

/**
 * Parametry pro import do databáze
 */
export interface ImportParams {
  /** Cesta k CSV souboru */
  csvPath: string;
  /** Název budovy */
  buildingName: string;
  /** Rok vyúčtování */
  year: number;
  /** Přepsat existující data */
  overwrite?: boolean;
  /** Vytvořit backup před importem */
  createBackup?: boolean;
}

/**
 * Výsledek importu do databáze
 */
export interface ImportResult {
  /** Úspěch importu */
  success: boolean;
  /** Chybová hláška */
  error?: string;
  /** Počet úspěšně importovaných jednotek */
  importedCount?: number;
  /** Počet chyb */
  errorCount?: number;
  /** ID budovy */
  buildingId?: string;
  /** ID vyúčtovacího období */
  billingPeriodId?: string;
  /** Detail chyb (jednotka → chyba) */
  errors?: Record<string, string>;
}

/**
 * Pomocné funkce - typ signatury
 */
export type ParseCzechNumberFn = (value: string | null | undefined) => number;
export type CleanTextValueFn = (value: string | null | undefined) => string;
export type NormalizeServiceCodeFn = (name: string) => string;

/**
 * Konfigurace parseru
 */
export interface ParserConfig {
  /** Oddělovač CSV (výchozí: ',') */
  delimiter?: string;
  /** Přeskočit prázdné řádky */
  skipEmptyLines?: boolean;
  /** Trim hodnot */
  trim?: boolean;
  /** Podporovat BOM */
  bom?: boolean;
  /** Vlastní funkce pro parsování čísel */
  numberParser?: ParseCzechNumberFn;
  /** Vlastní funkce pro čištění textu */
  textCleaner?: CleanTextValueFn;
}

/**
 * Validační pravidla
 */
export interface ValidationRules {
  /** Vyžadovat email */
  requireEmail?: boolean;
  /** Vyžadovat variabilní symbol */
  requireVariableSymbol?: boolean;
  /** Minimální počet služeb */
  minServices?: number;
  /** Validovat měřidla (sériové číslo, hodnoty) */
  validateMeters?: boolean;
}

/**
 * Validační výsledek
 */
export interface ValidationResult {
  /** Je validní */
  valid: boolean;
  /** Seznam varování */
  warnings: ValidationWarning[];
  /** Seznam chyb */
  errors: ValidationError[];
}

export interface ValidationWarning {
  /** Jednotka */
  unitName: string;
  /** Kód varování */
  code: string;
  /** Zpráva */
  message: string;
  /** Kontext (volitelné) */
  context?: Record<string, unknown>;
}

export interface ValidationError {
  /** Jednotka */
  unitName: string;
  /** Kód chyby */
  code: string;
  /** Zpráva */
  message: string;
  /** Kontext (volitelné) */
  context?: Record<string, unknown>;
}

/**
 * Filtr pro export dat
 */
export interface ExportFilter {
  /** Filtrovat podle jednotek (regex nebo přesný match) */
  unitNames?: string[];
  /** Filtrovat podle vlastníka */
  ownerNames?: string[];
  /** Jen jednotky s emailem */
  onlyWithEmail?: boolean;
  /** Jen jednotky s nedoplatkem */
  onlyWithUnderpayment?: boolean;
  /** Jen jednotky s přeplatkem */
  onlyWithOverpayment?: boolean;
  /** Minimální výše nedoplatku/přeplatku */
  minAbsoluteResult?: number;
}

/**
 * Export formát
 */
export type ExportFormat = 'JSON' | 'CSV' | 'EXCEL' | 'PDF';

/**
 * Parametry pro export dat
 */
export interface ExportDataParams {
  /** Data k exportu */
  units: UnitBillingDataMap;
  /** Formát */
  format: ExportFormat;
  /** Výstupní soubor */
  outputPath: string;
  /** Filtry */
  filter?: ExportFilter;
  /** Včetně statistik */
  includeStatistics?: boolean;
}
