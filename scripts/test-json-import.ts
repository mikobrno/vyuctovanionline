import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Mapování JSON klíčů predpisů na možné názvy služeb v DB
const PREDPISY_SERVICE_MAP: Record<string, string[]> = {
  elektrika: ['elektrika', 'elektricka energie', 'elektrická energie', 'elektrina', 'elektrické', 'elektrická energie (společné prostory)'],
  uklid: ['uklid', 'úklid', 'uklid bytoveho domu', 'úklid bytového domu'],
  komin: ['komin', 'komín', 'kominy', 'komíny'],
  vytah: ['vytah', 'výtah', 'pravidelna udrzba vytah', 'pravidelná údržba výtah'],
  voda: ['voda', 'studena voda', 'studená voda', 'vodne', 'vodné', 'vodne a stocne', 'vodné a stočné'],
  sprava: ['sprava', 'správa', 'sprava domu', 'správa domu'],
  opravy: ['opravy', 'fond oprav', 'fond opravy'],
  teplo: ['teplo', 'vytapeni', 'vytápění'],
  tuv: ['tuv', 'teplá voda', 'tepla voda', 'ohrev', 'ohřev', 'ohrev teple vody', 'ohřev teplé vody', 'ohřev teplé vody (tuv)'],
  pojisteni: ['pojisteni', 'pojištění', 'pojisteni domu', 'pojištění domu'],
  ostatni_sklep: ['ostatni sklep', 'ostatní sklep', 'ostatni naklady garaz', 'ostatní náklady garáž', 'ostatní náklady (garáž a sklepy)'],
  internet: ['internet'],
  ostatni_upc: ['ostatni upc', 'ostatní upc', 'upc', 'ostatní náklady - upc', 'ostatni naklady - upc', 'ostatní náklady upc'],
  sta: ['sta', 'antena', 'anténa', 'spolecna antena', 'společná anténa'],
  spolecne_naklady: ['spolecne naklady', 'společné náklady'],
  statutari: ['statutari', 'statutární', 'odmena vyboru', 'odměna výboru', 'mzdové náklady', 'mzdove naklady'],
  najemne: ['najemne', 'nájemné', 'ostatni najemne', 'ostatní nájemné'],
  sluzby: ['sluzby', 'služby', 'ostatní služby'],
  ostatni_sluzby: ['ostatni sluzby', 'ostatní služby', 'ostatni sluzby 2', 'ostatní služby 2'],
  poplatek_pes: ['poplatek pes', 'poplatek za psa', 'tvorba na splatku', 'tvorba na splátku', 'tvorba na splátku úvěru', 'uver', 'úvěr']
}

function normalizeHeaderCell(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Service = { id: string; name: string }

function findServiceByPredpisKey(services: Service[], predpisKey: string): Service | undefined {
  const possibleNames = PREDPISY_SERVICE_MAP[predpisKey]
  if (!possibleNames) return undefined
  
  for (const name of possibleNames) {
    const normalizedName = normalizeHeaderCell(name)
    const found = services.find(s => normalizeHeaderCell(s.name) === normalizedName)
    if (found) return found
  }
  
  // Fuzzy fallback
  for (const name of possibleNames) {
    const normalizedName = normalizeHeaderCell(name)
    const found = services.find(s => {
      const sName = normalizeHeaderCell(s.name)
      return sName.includes(normalizedName) || normalizedName.includes(sName)
    })
    if (found) return found
  }
  
  return undefined
}

function stripUnitPrefixes(value: string) {
  return value
    .replace(/^(jednotka|byt|nebytový prostor|nebyt\.|ateliér|atelier|garáž|garaz|sklep|bazén|bazen)\s*(č\.?|c\.?)?\s*/gi, '')
    .replace(/^(č\.?|c\.?)\s*/gi, '')
    .trim()
}

interface JsonPredpis {
  oznaceni: string
  uzivatel?: string
  [key: string]: string | Record<string, number> | undefined
}

interface JsonData {
  predpisy?: JsonPredpis[]
}

async function main() {
  const buildingId = 'cmij326vl03emjkh4js2r8afm' // Mikšíčkova 20
  const year = 2024
  
  // Load JSON
  const jsonPath = path.join(process.cwd(), 'public', 'import', '2024.json')
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8')
  const jsonData: JsonData = JSON.parse(jsonContent)
  
  if (!jsonData.predpisy) {
    console.log('No predpisy in JSON')
    return
  }
  
  console.log(`Loaded ${jsonData.predpisy.length} predpisy from JSON`)
  
  // Get services for building
  const services = await prisma.service.findMany({ 
    where: { buildingId },
    select: { id: true, name: true }
  })
  console.log(`Found ${services.length} services in DB:`)
  services.forEach(s => console.log(`  - ${s.name}`))
  
  // Get units for building
  const units = await prisma.unit.findMany({
    where: { buildingId },
    select: { id: true, unitNumber: true }
  })
  console.log(`Found ${units.length} units in DB`)
  
  // Build unit map
  const unitMap = new Map<string, { id: string }>()
  for (const u of units) {
    unitMap.set(u.unitNumber, { id: u.id })
    unitMap.set(stripUnitPrefixes(u.unitNumber), { id: u.id })
  }
  
  // Process predpisy
  const advancesToCreate: { unitId: string; serviceId: string; year: number; month: number; amount: number }[] = []
  const unmatchedKeys = new Set<string>()
  const unmatchedUnits = new Set<string>()
  
  for (const predpis of jsonData.predpisy) {
    const unitOznaceni = predpis.oznaceni
    const strippedOznaceni = stripUnitPrefixes(unitOznaceni)
    const unit = unitMap.get(unitOznaceni) || unitMap.get(strippedOznaceni)
    
    if (!unit) {
      unmatchedUnits.add(unitOznaceni)
      continue
    }
    
    for (const [key, value] of Object.entries(predpis)) {
      if (key === 'oznaceni' || key === 'uzivatel') continue
      if (typeof value !== 'object' || value === null) continue
      
      const monthlyData = value as Record<string, number>
      const service = findServiceByPredpisKey(services, key)
      
      if (!service) {
        unmatchedKeys.add(key)
        continue
      }
      
      for (const [monthStr, amount] of Object.entries(monthlyData)) {
        const month = parseInt(monthStr, 10)
        if (isNaN(month) || month < 1 || month > 12) continue
        if (amount <= 0) continue
        
        advancesToCreate.push({
          unitId: unit.id,
          serviceId: service.id,
          year,
          month,
          amount
        })
      }
    }
  }
  
  console.log(`\n=== Results ===`)
  console.log(`Advances to create: ${advancesToCreate.length}`)
  console.log(`Unmatched JSON keys (no service): ${[...unmatchedKeys].join(', ') || 'none'}`)
  console.log(`Unmatched units: ${[...unmatchedUnits].join(', ') || 'none'}`)
  
  if (advancesToCreate.length > 0) {
    console.log(`\nFirst 5 advances:`)
    advancesToCreate.slice(0, 5).forEach(a => {
      const service = services.find(s => s.id === a.serviceId)
      console.log(`  ${a.month}/${a.year}: ${service?.name} = ${a.amount} Kč`)
    })
    
    // Optionally insert
    const readline = require('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    
    rl.question('\nInsert advances? (y/n): ', async (answer: string) => {
      if (answer.toLowerCase() === 'y') {
        // Delete old advances
        const deleted = await prisma.advanceMonthly.deleteMany({
          where: { unit: { buildingId }, year }
        })
        console.log(`Deleted ${deleted.count} old advances`)
        
        // Create new
        await prisma.advanceMonthly.createMany({ data: advancesToCreate })
        console.log(`Created ${advancesToCreate.length} advances`)
      } else {
        console.log('Aborted')
      }
      
      rl.close()
      await prisma.$disconnect()
    })
  } else {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
