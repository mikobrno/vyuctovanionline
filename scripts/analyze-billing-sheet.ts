/**
 * Analyzuje strukturu Excel souboru - zejména záložku "Vyúčtování byt - 1.část"
 */
import * as xlsx from 'xlsx';

const filePath = process.argv[2] || './JSON/vyuctovani2024 (7).xlsx';

console.log(`\n📂 Analyzuji soubor: ${filePath}\n`);

const workbook = xlsx.readFile(filePath);

console.log('📋 Listy v souboru:');
workbook.SheetNames.forEach((name, i) => console.log(`  ${i+1}. ${name}`));

// Najít list Vyúčtování byt
const billSheetName = workbook.SheetNames.find(name => 
  name.toLowerCase().includes('vyúčt') && name.toLowerCase().includes('byt')
);

if (!billSheetName) {
  console.log('\n❌ List "Vyúčtování byt" nenalezen');
  process.exit(1);
}

console.log(`\n🎯 Analyzuji list: "${billSheetName}"`);

const sheet = workbook.Sheets[billSheetName];
const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');

console.log(`📐 Rozsah: ${sheet['!ref']}`);
console.log(`   Řádky: ${range.s.r + 1} - ${range.e.r + 1}`);
console.log(`   Sloupce: ${xlsx.utils.encode_col(range.s.c)} - ${xlsx.utils.encode_col(range.e.c)}`);

// Vypsat obsah klíčových řádků
console.log('\n📊 Obsah listu (klíčové oblasti):\n');

function getCell(row: number, col: number): string {
  const addr = xlsx.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  return cell ? String(cell.v || '').substring(0, 40) : '';
}

function printRow(row: number, label: string) {
  const values: string[] = [];
  for (let c = 0; c <= 12; c++) {
    values.push(getCell(row - 1, c)); // xlsx je 0-indexed
  }
  const nonEmpty = values.filter(v => v).join(' | ');
  if (nonEmpty) {
    console.log(`Ř${row.toString().padStart(2)}: ${label.padEnd(25)} ${nonEmpty.substring(0, 100)}`);
  }
}

// Hlavička a identifikace
console.log('=== HLAVIČKA ===');
for (let r = 1; r <= 10; r++) {
  printRow(r, '');
}

// Tabulka služeb (typicky ř. 10-35)
console.log('\n=== TABULKA SLUŽEB (ř. 10-35) ===');
for (let r = 10; r <= 35; r++) {
  printRow(r, '');
}

// Pevné platby, fond oprav (ř. 35-40)
console.log('\n=== PEVNÉ PLATBY / FOND (ř. 35-40) ===');
for (let r = 35; r <= 40; r++) {
  printRow(r, '');
}

// Měsíční úhrady (typicky ř. 39)
console.log('\n=== MĚSÍČNÍ DATA (ř. 38-45) ===');
for (let r = 38; r <= 45; r++) {
  printRow(r, '');
}

// Měřidla (typicky ř. 45-60)
console.log('\n=== MĚŘIDLA (ř. 45-65) ===');
for (let r = 45; r <= 65; r++) {
  printRow(r, '');
}

// Detailní výpis všech buněk s hodnotami
console.log('\n\n📝 DETAILNÍ MAPA BUNĚK (neprázdné):\n');

const cellMap: Record<string, { addr: string; value: string; row: number; col: number }[]> = {};

for (let r = 0; r <= Math.min(range.e.r, 70); r++) {
  for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
    const addr = xlsx.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      const val = String(cell.v).substring(0, 50);
      console.log(`${addr.padEnd(5)} (ř${(r+1).toString().padStart(2)}, sl${xlsx.utils.encode_col(c)}): ${val}`);
    }
  }
}

// Zjistit strukturu hlavičky tabulky služeb
console.log('\n\n🔍 STRUKTURA HLAVIČKY TABULKY SLUŽEB:\n');

// Najít řádek s hlavičkou (typicky ř. 10 nebo 11)
for (let r = 8; r <= 12; r++) {
  const headers: string[] = [];
  for (let c = 0; c <= 10; c++) {
    const val = getCell(r - 1, c);
    if (val) headers.push(`${xlsx.utils.encode_col(c)}="${val}"`);
  }
  if (headers.length > 3) {
    console.log(`Řádek ${r}: ${headers.join(', ')}`);
  }
}

console.log('\n✅ Analýza dokončena');
