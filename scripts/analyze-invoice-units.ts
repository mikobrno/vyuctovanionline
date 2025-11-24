
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'vyuctovani2024 (22).xlsx');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetName = 'Faktury';
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
}

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });


// Fixed indices based on observation
// Col 0: Service Name
// Col 2: Method
// Col 5: Total Units

console.log('\n--- Data Analysis ---');
const uniqueUnits = new Set<string>();

for (let i = 0; i < data.length; i++) {

    const row = data[i] as unknown[];
    const serviceName = row[0];
    const method = row[2];
    const totalUnits = row[5];

    if (serviceName && typeof serviceName === 'string' && serviceName !== 'Jednotka č. 318/03') {
        console.log(`Service: "${serviceName}" | Method: "${method}" | Total Units: "${totalUnits}"`);
        if (method) uniqueUnits.add(String(method));
    }
}

console.log('\n--- Unique Methods Found ---');
uniqueUnits.forEach(u => console.log(`- "${u}"`));
