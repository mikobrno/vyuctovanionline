import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const filePath = 'JSON/vyuctovani2024 (7).xlsx';
const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheet = workbook.Sheets['EXPORT_FULL'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Vypsat prvních 15 řádků s názvy sloupců
console.log('=== HLAVIČKY SLOUPCŮ ===');
console.log(data[0]);
console.log('');

// Vypsat detailně data pro jednu jednotku (řádky 1-10, kde je Byt-č.-151301)
console.log('=== DATA PRO BYT-Č.-151301 (prvních 10 řádků) ===');
for (let i = 1; i <= 10; i++) {
  const row = data[i];
  if (!row) break;
  console.log(`Řádek ${i}:`);
  console.log(`  [0] UnitName: "${row[0]}"`);
  console.log(`  [1] DataType: "${row[1]}"`);
  console.log(`  [2] Key: "${row[2]}"`);
  for (let j = 3; j < 14; j++) {
    console.log(`  [${j}] Val${j-2}: "${row[j]}"`);
  }
  console.log('');
}
