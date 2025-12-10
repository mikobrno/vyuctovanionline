
import * as XLSX from 'xlsx';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'JSON', 'vyuctovani2024 (7).xlsx'); // Using the file found in JSON dir

function main() {
    console.log(`Reading file: ${FILE_PATH}`);
    const workbook = XLSX.readFile(FILE_PATH);

    // Inspect 'Faktury' headers (Row 10 -> index 9)
    const fakturySheet = workbook.Sheets['Faktury'];
    if (fakturySheet) {
        console.log('\n--- Sheet: Faktury (Header Row 10) ---');
        const range = XLSX.utils.decode_range(fakturySheet['!ref'] || 'A1:Z50');
        for (let C = 0; C <= 15; C++) { // Check first 15 columns
            const cell = fakturySheet[XLSX.utils.encode_cell({ r: 9, c: C })];
            console.log(`Col ${C} (${XLSX.utils.encode_col(C)}): ${cell ? cell.v : '(empty)'}`);
        }
    } else {
        console.log('Sheet "Faktury" not found. Available:', workbook.SheetNames.join(', '));
    }

    // Inspect 'Vstupní data' for Bank Account etc.
    const inputSheet = workbook.Sheets['Vstupní data'];
    if (inputSheet) {
        console.log('\n--- Sheet: Vstupní data ---');
        // Check around B35 (row index 34)
        for (let R = 30; R <= 40; R++) {
            const cellA = inputSheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
            const cellB = inputSheet[XLSX.utils.encode_cell({ r: R, c: 1 })];
            console.log(`Row ${R + 1}: [${cellA ? cellA.v : ''}] -> [${cellB ? cellB.v : ''}]`);
        }
    }
}

main();
