
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'JSON', 'vyuctovani2024 (7).xlsx');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetName = 'EXPORT_FULL';

if (!workbook.Sheets[sheetName]) {
    console.error(`Sheet ${sheetName} not found in ${filePath}`);
    console.log('Available sheets:', workbook.SheetNames);
    process.exit(1);
}

const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

if (data.length === 0) {
    console.log('Sheet is empty');
    process.exit(0);
}

// Print headers (first row)
console.log('Headers:', data[0]);

// Find rows matching "Byt-č.-151301" in UnitName column (index 0)
const targetUnit = 'Byt-č.-151301';
const matchingRows = data.filter((row: any) => {
    return row[0] === targetUnit;
});

console.log(`Found ${matchingRows.length} matching rows.`);
// Search for "64,23"
const searchRate = "64,23";
console.log(`\nSearching for ${searchRate}...`);
const foundRate = matchingRows.some((row: any) => {
    return row.some((cell: any) => String(cell).includes(searchRate));
});

if (foundRate) {
    console.log(`Found ${searchRate}!`);
    const rowWithRate = matchingRows.find((row: any) => row.some((cell: any) => String(cell).includes(searchRate)));
    console.log("Row with rate:", rowWithRate);
} else {
    console.log(`Did NOT find ${searchRate}.`);
}

// Print all ADVANCE_MONTHLY_SOURCE rows
console.log("\nAll ADVANCE_MONTHLY_SOURCE rows:");
const advanceRows = matchingRows.filter((row: any) => row[1] === 'ADVANCE_MONTHLY_SOURCE');
advanceRows.forEach((row: any, index: number) => {
    console.log(`Advance Row ${index + 1}: Key=${row[2]}, Sum=${(row as any[]).slice(3, 15).reduce((a: any, b: any) => Number(a) + Number(b), 0)}`);
});

