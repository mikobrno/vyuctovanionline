const fs = require('fs');
const { read, utils } = require('xlsx');
const wb = read(fs.readFileSync('public/import/vyuctovani2024.xlsx'));
const sheet = wb.Sheets['EXPORT_FULL'];
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });
const rows = data.filter(r => String(r[1]).toUpperCase() === 'PAYMENT_MONTHLY');
console.log('rows', rows.length);
console.log(rows[0]);
