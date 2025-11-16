const fs = require('fs');
const path = require('path');

function fixColors(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        fixColors(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      content = content.replace(/text-gray-600/g, 'text-gray-900');
      content = content.replace(/text-gray-500/g, 'text-gray-900');
      content = content.replace(/text-gray-700/g, 'text-gray-900');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('✓', fullPath);
      }
    }
  });
}

console.log('Opravuji barvy textu...\n');
fixColors('./app');
fixColors('./components');
console.log('\n✅ Hotovo!');
