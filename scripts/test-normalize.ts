// Test normalizace
function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

console.log('voda:', normalizeText('voda'))
console.log('vodné:', normalizeText('vodné'))
console.log('vodné a stočné:', normalizeText('vodné a stočné'))
console.log('Vodné a stočné:', normalizeText('Vodné a stočné'))

// Test porovnání
const dbService = 'Vodné a stočné'
const mappingValues = ['voda', 'studena voda', 'studená voda', 'vodne', 'vodné', 'vodne a stocne', 'vodné a stočné']

console.log('\nPorovnání s DB službou:', normalizeText(dbService))
for (const val of mappingValues) {
  const norm = normalizeText(val)
  const match = norm === normalizeText(dbService)
  console.log(`  ${val} -> ${norm} | match: ${match}`)
}
