/**
 * Analyzuje listy Evidence a Vstupní data pro kompletní mapování
 */
import * as xlsx from 'xlsx';

const filePath = process.argv[2] || './JSON/vyuctovani2024 (7).xlsx';

console.log(`\n📂 Analyzuji soubor: ${filePath}\n`);

const workbook = xlsx.readFile(filePath);

function getCell(sheet: xlsx.WorkSheet, row: number, col: number): string {
  const addr = xlsx.utils.encode_cell({ r: row - 1, c: col });
  const cell = sheet[addr];
  return cell ? String(cell.v || '').substring(0, 60) : '';
}

function analyzeSheet(sheetName: string, maxRows: number = 20) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`❌ List "${sheetName}" nenalezen\n`);
    return;
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 LIST: ${sheetName}`);
  console.log(`${'='.repeat(80)}`);
  
  const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');
  console.log(`Rozsah: ${sheet['!ref']}\n`);
  
  for (let r = 1; r <= Math.min(range.e.r + 1, maxRows); r++) {
    const values: string[] = [];
    for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
      const val = getCell(sheet, r, c);
      if (val) values.push(`${xlsx.utils.encode_col(c)}="${val.substring(0, 25)}"`);
    }
    if (values.length > 0) {
      console.log(`Ř${r.toString().padStart(2)}: ${values.join(' | ')}`);
    }
  }
}

// Analyzovat klíčové listy
analyzeSheet('Evidence', 30);
analyzeSheet('vstupní data', 50);

// Speciální analýza Vstupních dat - kde je ID jednotky a jméno
const wsInput = workbook.Sheets['vstupní data'];
if (wsInput) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 KLÍČOVÉ BUŇKY VE VSTUPNÍCH DATECH:`);
  console.log(`${'='.repeat(80)}`);
  
  // Známé pozice
  const keyCells = [
    { addr: 'B4', desc: 'ID jednotky (vstup)' },
    { addr: 'C4', desc: 'Název jednotky' },
    { addr: 'B5', desc: '?' },
    { addr: 'C5', desc: '?' },
    { addr: 'B6', desc: '?' },
    { addr: 'C6', desc: '?' },
    { addr: 'B34', desc: 'Správce?' },
    { addr: 'C34', desc: '?' },
  ];
  
  for (const kc of keyCells) {
    const cell = wsInput[kc.addr];
    const val = cell ? String(cell.v || cell.f || '').substring(0, 50) : '(prázdné)';
    console.log(`${kc.addr.padEnd(5)} ${kc.desc.padEnd(25)} = ${val}`);
  }
}

// Kontrola EXPORT_FULL listu
const wsExport = workbook.Sheets['EXPORT_FULL'];
if (wsExport) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 STÁVAJÍCÍ EXPORT_FULL (prvních 30 řádků):`);
  console.log(`${'='.repeat(80)}`);
  
  const data = xlsx.utils.sheet_to_json<string[]>(wsExport, { header: 1, defval: '' });
  
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = data[i];
    if (row && row.some(v => v !== '')) {
      const vals = row.slice(0, 8).map(v => String(v || '').substring(0, 15).padEnd(16)).join('');
      console.log(`${(i+1).toString().padStart(3)}: ${vals}`);
    }
  }
}

console.log('\n✅ Analýza dokončena');
