import XLSX from 'xlsx';
import fs from 'fs';

const file = fs.readFileSync('JSON/vyuctovani2024 (7).xlsx');
const workbook = XLSX.read(file, { type: 'buffer' });
const sheet = workbook.Sheets['EXPORT_FULL'];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log('=== COST řádky pro Byt č. 151301 ===\n');

const costRows = data.filter((row: any) => 
  row.UnitName?.includes('151301') && row.DataType === 'COST'
);

costRows.forEach((row: any, idx: number) => {
  console.log(`\nŘádek ${idx + 1} (${row.Key}):`);
  console.log(`  Val1: "${row.Val1}" (Podíl %)`);
  console.log(`  Val2: "${row.Val2}" (Jednotky)`);
  console.log(`  Val3: "${row.Val3}" ??? `);
  console.log(`  Val4: "${row.Val4}" ??? `);
  console.log(`  Val5: "${row.Val5}" ??? `);
  console.log(`  Val6: "${row.Val6}" (Náklad domu)`);
  console.log(`  Val7: "${row.Val7}" (Počet jednotek dům)`);
  console.log(`  Val8: "${row.Val8}" (Cena za jednotku)`);
  console.log(`  Val9: "${row.Val9}" (Metodika)`);
});

console.log('\n\n=== POROVNÁNÍ S PDF ===');
console.log('PDF údaje pro jednotlivé služby:');
console.log('Elektrická energie: Náklad = 3 083,04 Kč, Záloha = 840,00 Kč');
console.log('Úklid bytového domu: Náklad = 3 213,12 Kč, Záloha = 1 080,00 Kč');
console.log('Projití domů: Náklad = 2 775,49 Kč, Záloha = 1 056,00 Kč');
