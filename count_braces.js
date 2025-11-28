const fs = require('fs');
const path = 'd:\\Projekty\\vyuctovanionline-1\\app\\api\\import\\complete\\route.ts';
const content = fs.readFileSync(path, 'utf-8');
const lines = content.split('\n');

let balance = 0;
const startLine = 1412;
const endLine = 1797;

console.log(`Analyzing lines ${startLine} to ${endLine}...`);

for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    let cleanLine = line.split('//')[0]; 
    
    const open = (cleanLine.match(/\{/g) || []).length;
    const close = (cleanLine.match(/\}/g) || []).length;
    
    if (open > 0 || close > 0) {
        balance += (open - close);
        console.log(`${i+1}: B=${balance} (+${open}, -${close}) ${line.trim()}`);
    }
}
