import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface JsonMeridlo {
  typ?: string
  meridlo?: string
  pocatecni_hodnota?: number
  koncova_hodnota?: number
  rocni_naklad?: number
  import_id?: string | null
}

interface JsonMeridlaUnit {
  oznaceni: string
  tuv?: JsonMeridlo[]
  sv?: JsonMeridlo[]
  teplo?: JsonMeridlo[]
  elektro?: JsonMeridlo[]
}

interface JsonData {
  meridla?: JsonMeridlaUnit[]
}

async function main() {
  const buildingId = process.argv[2]
  const jsonFile = process.argv[3] || '2024.json'
  
  if (!buildingId) {
    console.log('Použití: npx tsx scripts/update-meter-variants.ts <buildingId> [jsonFile]')
    console.log('Příklad: npx tsx scripts/update-meter-variants.ts cmikmr76z0000jkps06anasbc 2024.json')
    return
  }
  
  // Načíst JSON
  const jsonPath = path.join(process.cwd(), 'public', 'import', jsonFile)
  if (!fs.existsSync(jsonPath)) {
    console.error(`Soubor ${jsonPath} neexistuje`)
    return
  }
  
  const jsonData: JsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  
  // Získat jednotky z databáze
  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: { meters: true }
  })
  
  console.log(`Nalezeno ${units.length} jednotek v budově`)
  
  // Vytvořit mapu jednotek podle označení
  const unitMap = new Map<string, typeof units[0]>()
  for (const unit of units) {
    unitMap.set(unit.unitNumber, unit)
    // Také zkusit bez prefixu "Byt č. "
    const stripped = unit.unitNumber.replace(/^Byt\s*[cčČ]\.?\s*/i, '').trim()
    unitMap.set(stripped, unit)
  }
  
  const METER_TYPE_MAP: Record<string, string> = {
    tuv: 'HOT_WATER',
    sv: 'COLD_WATER',
    teplo: 'HEATING',
    elektro: 'ELECTRICITY'
  }
  
  let updated = 0
  let skipped = 0
  
  for (const meridlaUnit of jsonData.meridla || []) {
    // Najít jednotku
    let unit = unitMap.get(meridlaUnit.oznaceni)
    if (!unit) {
      const stripped = meridlaUnit.oznaceni.replace(/^Byt\s*[cčČ]\.?\s*/i, '').trim()
      unit = unitMap.get(stripped)
    }
    
    if (!unit) {
      console.log(`  ⚠️ Jednotka ${meridlaUnit.oznaceni} nenalezena`)
      continue
    }
    
    for (const [key, meterType] of Object.entries(METER_TYPE_MAP)) {
      const meters = meridlaUnit[key as keyof JsonMeridlaUnit] as JsonMeridlo[] | undefined
      if (!meters || !Array.isArray(meters)) continue
      
      for (let idx = 0; idx < meters.length; idx++) {
        const m = meters[idx]
        const variant = m.typ || null
        
        // Najít odpovídající měřidlo v databázi
        // Hledáme podle unitId a typu
        const dbMeter = unit.meters.find(dbM => 
          dbM.type === meterType && 
          (dbM.variant === null || dbM.variant === variant)
        )
        
        if (dbMeter && dbMeter.variant !== variant) {
          await prisma.meter.update({
            where: { id: dbMeter.id },
            data: { variant }
          })
          console.log(`  ✅ ${unit.unitNumber}: ${meterType} -> variant = ${variant}`)
          updated++
        } else if (dbMeter) {
          skipped++
        } else {
          console.log(`  ⚠️ ${unit.unitNumber}: měřidlo typu ${meterType} nenalezeno`)
        }
      }
    }
  }
  
  console.log(`\n✅ Aktualizováno: ${updated} měřidel`)
  console.log(`⏭️ Přeskočeno: ${skipped} měřidel (již aktuální)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
