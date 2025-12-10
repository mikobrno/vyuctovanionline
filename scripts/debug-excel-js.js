
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.join(process.cwd(), 'JSON', 'vyuctovani2024 (7).xlsx');
const OUTPUT_FILE = path.join(process.cwd(), 'debug_output.txt');

const log = (msg) => fs.appendFileSync(OUTPUT_FILE, msg + '\n');
fs.writeFileSync(OUTPUT_FILE, ''); // Clear file

log(`Checking file existence: ${FILE_PATH}`);
if (!fs.existsSync(FILE_PATH)) {
    console.error('File does not exist!');
    process.exit(1);
}

const workbook = XLSX.readFile(FILE_PATH);

log('Sheet Names: ' + workbook.SheetNames.join(', '));

// 1. Check 'Faktury' for columns
const faktury = workbook.Sheets['Faktury'];
if (faktury) {
    log('\n--- Faktury Scanning Rows 0-15 ---');
    for (let r = 0; r < 20; r++) { // Increased to 20
        let rowStr = `Row ${r + 1}: `;
        for (let c = 0; c < 15; c++) {
            const cell = faktury[XLSX.utils.encode_cell({ r: r, c: c })];
            if (cell && cell.v !== undefined) rowStr += `[${cell.v}] `;
            else rowStr += `[] `;
        }
        log(rowStr);
    }
} else {
    log('Sheet Faktury NOT FOUND');
}

// 2. Check 'vstupní data' (lowercase)
const inputSheet = workbook.Sheets['vstupní data'] || workbook.Sheets['Vstupní data'];
if (inputSheet) {
    log('\n--- vstupní data Scanning ---');
    // Search for "Bankovní" or "spojení" or "poplatek"
    const range = XLSX.utils.decode_range(inputSheet['!ref']);
    for (let r = 0; r <= 100; r++) { // Increased range
        for (let c = 0; c < 10; c++) {
            const cell = inputSheet[XLSX.utils.encode_cell({ r: r, c: c })];
            if (cell && cell.v) {
                const val = String(cell.v).toLowerCase();
                if (val.includes('bank') || val.includes('spojení') || val.includes('symbol') || val.includes('poplatek') || val.includes('minul')) {
                    const valNext = inputSheet[XLSX.utils.encode_cell({ r: r, c: c + 1 })];
                    log(`Found '${cell.v}' at [Row ${r + 1}, Col ${c}]: => Value next: ${valNext ? valNext.v : 'EMPTY'}`);
                }
            }
        }
    }
} else {
    log('Sheet "vstupní data" NOT FOUND');
}
