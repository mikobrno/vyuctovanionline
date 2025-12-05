import XLSX from 'xlsx';
import fs from 'fs';

const file = fs.readFileSync('JSON/vyuctovani2024 (7).xlsx');
const workbook = XLSX.read(file, { type: 'buffer' });
const sheet = workbook.Sheets['EXPORT_FULL'];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log('=== VŠECHNY DATOVÉ TYPY PRO BYT 151301 ===\n');

const unit151301 = data.filter((row: any) => row.UnitName?.includes('151301'));

// Seskupit podle DataType
const byType: { [key: string]: any[] } = {};
unit151301.forEach((row: any) => {
  const type = row.DataType || 'UNKNOWN';
  if (!byType[type]) byType[type] = [];
  byType[type].push(row);
});

Object.keys(byType).forEach(type => {
  console.log(`\n╔════ ${type} ════╗`);
  byType[type].forEach((row: any, idx: number) => {
    console.log(`\n  Řádek ${idx + 1}: ${row.Key || '(bez klíče)'}`);
    console.log(`    Val1: "${row.Val1}"`);
    console.log(`    Val2: "${row.Val2}"`);
    console.log(`    Val3: "${row.Val3}"`);
    console.log(`    Val4: "${row.Val4}"`);
    console.log(`    Val5: "${row.Val5}"`);
    console.log(`    Val6: "${row.Val6}"`);
    console.log(`    Val7: "${row.Val7}"`);
    console.log(`    Val8: "${row.Val8}"`);
    console.log(`    Val9: "${row.Val9}"`);
    console.log(`    Val10: "${row.Val10}"`);
    console.log(`    Val11: "${row.Val11}"`);
    console.log(`    Val12: "${row.Val12}"`);
    console.log(`    Val13: "${row.Val13}"`);
  });
});

console.log('\n\n╔════ POROVNÁNÍ S PDF ════╗');
console.log('\nPDF ÚČET - Vyúčtování služeb:');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ Služba                  │ Náklad  │ Záloha  │');
console.log('├─────────────────────────────────────────────┤');
console.log('│ El. energie             │ 3083,04 │  840,00 │');
console.log('│ Úklid bytového domu     │ 3213,12 │ 1080,00 │');
console.log('│ Pojištění domu          │ 2775,40 │ 1056,00 │');
console.log('│ Ohřev teplé vody (TUV)  │ 4913,14 │ 4200,00 │');
console.log('│ Studená voda            │ 5155,00 │ 3000,00 │');
console.log('│ Teplo                   │ 8485,83 │ 9360,00 │');
console.log('│ Správa domu             │ 3639,18 │ 3000,00 │');
console.log('│ Tvorba na splátku       │    0,00 │ 1978,00 │');
console.log('└─────────────────────────────────────────────┘');
console.log('\nCelkem náklady na odběrném místě: 31 264,71 Kč');
console.log('Celkem zálohy:                      24 514,00 Kč');
console.log('Nedoplatek:                        -15 486,00 Kč (dluž)');
