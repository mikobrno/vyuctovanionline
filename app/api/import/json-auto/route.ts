import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Service } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

export const runtime = 'nodejs'

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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Funkce pro nalezení služby podle JSON klíče předpisu
// PRIORITA: 1. advancePaymentColumn (z konfigurace), 2. fallback na staré mapování
function findServiceByPredpisKey(services: Service[], predpisKey: string): Service | undefined {
  // 1. PRIORITA: Hledáme službu s odpovídajícím advancePaymentColumn
  const serviceByMapping = services.find(s => s.advancePaymentColumn === predpisKey)
  if (serviceByMapping) return serviceByMapping
  
  // 2. FALLBACK: Staré mapování podle názvu
  const possibleNames = PREDPISY_SERVICE_MAP[predpisKey]
  if (!possibleNames) return undefined
  
  for (const name of possibleNames) {
    const normalizedName = normalizeText(name)
    const found = services.find(s => normalizeText(s.name) === normalizedName)
    if (found) return found
  }
  
  // Fuzzy fallback - hledáme částečnou shodu
  for (const name of possibleNames) {
    const normalizedName = normalizeText(name)
    const found = services.find(s => {
      const sName = normalizeText(s.name)
      return sName.includes(normalizedName) || normalizedName.includes(sName)
    })
    if (found) return found
  }
  
  return undefined
}

// Kontrola, zda má budova nakonfigurované mapování služeb
function hasServiceMapping(services: Service[]): boolean {
  return services.some(s => s.advancePaymentColumn !== null)
}

// Funkce stripUnitPrefixes odstraněna - jednotky se nyní vytváří přímo z JSON

// Typy pro JSON strukturu
interface JsonPredpis {
  oznaceni: string
  uzivatel?: string
  [key: string]: string | Record<string, number> | undefined
}

interface JsonHouseInfo {
  nazev?: string
  sidlo?: string
}

interface JsonVstupniData {
  adresa?: string
  spravce?: string
  rok?: string | number
}

interface JsonData {
  house_info?: JsonHouseInfo
  vstupni_data?: JsonVstupniData
  predpisy?: JsonPredpis[]
}

// Extrahuje adresu budovy z JSON (pro hledání v DB)
function extractBuildingAddress(jsonData: JsonData): string | null {
  // Priorita: vstupni_data.adresa > house_info.sidlo
  if (jsonData.vstupni_data?.adresa) {
    return jsonData.vstupni_data.adresa
  }
  if (jsonData.house_info?.sidlo) {
    return jsonData.house_info.sidlo
  }
  if (jsonData.house_info?.nazev) {
    // Zkusíme extrahovat adresu z názvu
    const match = jsonData.house_info.nazev.match(/(\w+\s+\d+\/?\d*)/i)
    if (match) return match[1]
  }
  return null
}

// Extrahuje rok z JSON
function extractYear(jsonData: JsonData): number | null {
  const rok = jsonData.vstupni_data?.rok
  if (rok) {
    const year = typeof rok === 'string' ? parseInt(rok, 10) : rok
    if (!isNaN(year) && year > 2000 && year < 2100) {
      return year
    }
  }
  return null
}

// Najde budovu podle adresy nebo vytvoří novou
async function findOrCreateBuilding(jsonData: JsonData) {
  const address = extractBuildingAddress(jsonData)
  
  // Extrahujeme ulici a číslo z adresy
  const extractStreetAndNumber = (addr: string) => {
    // "Zborovská 939/2, Brno" -> ulice=zborovska, cislo popisne=939, cislo orientacni=2
    const match = addr.match(/^([a-záčďéěíňóřšťúůýž]+)\s*(\d+)(?:\/(\d+))?/i)
    if (match) {
      return {
        street: normalizeText(match[1]),
        fullNumber: match[2] + (match[3] ? '/' + match[3] : ''),
        buildingNumber: match[2], // číslo popisné (939)
        orientNumber: match[3] || null // číslo orientační (2)
      }
    }
    return null
  }
  
  const parsed = address ? extractStreetAndNumber(address) : null
  
  if (parsed) {
    const buildings = await prisma.building.findMany({
      select: { id: true, name: true, address: true }
    })
    
    for (const building of buildings) {
      const buildingNameNorm = normalizeText(building.name)
      const buildingAddrNorm = building.address ? normalizeText(building.address) : ''
      const searchIn = buildingNameNorm + ' ' + buildingAddrNorm
      
      // Hledáme shodu ulice
      if (!searchIn.includes(parsed.street)) continue
      
      // Pro "Zborovská 939/2" hledáme přesnou shodu s číslem
      // Regex pro číslo s hranicemi (ne jako součást většího čísla)
      const orientNumberPattern = parsed.orientNumber 
        ? new RegExp(`\\b${parsed.orientNumber}\\b`)
        : null
      const buildingNumberPattern = new RegExp(`\\b${parsed.buildingNumber}\\b`)
      
      // Priorita: shoda ulice + orientační číslo (pokud existuje)
      if (parsed.orientNumber && orientNumberPattern?.test(searchIn)) {
        // Musí obsahovat ulici a orientační číslo jako celé slovo
        return { building, created: false }
      }
      
      // Fallback: shoda ulice + číslo popisné
      if (buildingNumberPattern.test(searchIn)) {
        return { building, created: false }
      }
    }
  }
  
  // Budova nenalezena - vytvoříme novou
  // Použijeme krátký název (adresu) pro přehlednost
  const fullName = jsonData.house_info?.nazev || address || 'Importovaná budova'
  const buildingAddress = jsonData.house_info?.sidlo || address || ''
  
  // Krátký název - extrahujeme adresu z plného názvu nebo použijeme adresu
  const shortName = address || (fullName.length > 50 
    ? fullName.substring(0, 50)
    : fullName)
  
  const newBuilding = await prisma.building.create({
    data: {
      name: shortName, // Krátký název pro přehlednost
      address: buildingAddress,
      city: 'Brno',
      zip: '60000',
      managerName: jsonData.vstupni_data?.spravce || null,
    }
  })
  
  return { building: newBuilding, created: true }
}

// GET - vrací seznam JSON souborů nebo info o konkrétním souboru
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const jsonFile = url.searchParams.get('file')
  
  // Pokud není soubor specifikován, vrátíme seznam dostupných JSON souborů
  if (!jsonFile) {
    try {
      const jsonDir = path.join(process.cwd(), 'JSON')
      const files = await fs.readdir(jsonDir)
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('spec'))
      
      // Pro každý soubor načteme info o budově a roku
      const fileInfos = await Promise.all(jsonFiles.map(async (file) => {
        try {
          const content = await fs.readFile(path.join(jsonDir, file), 'utf-8')
          const data = JSON.parse(content) as JsonData
          const result = await findOrCreateBuilding(data)
          
          return {
            file,
            address: extractBuildingAddress(data),
            year: extractYear(data),
            buildingName: data.house_info?.nazev || null,
            matchedBuilding: { id: result.building.id, name: result.building.name },
            wouldCreate: false // GET nesmí vytvářet
          }
        } catch {
          return { file, address: null, year: null, buildingName: null, matchedBuilding: null }
        }
      }))
      
      return NextResponse.json({ files: fileInfos })
    } catch {
      return NextResponse.json({ error: 'Nelze načíst JSON soubory' }, { status: 500 })
    }
  }
  
  // Načtení konkrétního JSON souboru
  try {
    const jsonPath = path.join(process.cwd(), 'JSON', jsonFile)
    const content = await fs.readFile(jsonPath, 'utf-8')
    const jsonData = JSON.parse(content) as JsonData
    
    const address = extractBuildingAddress(jsonData)
    const year = extractYear(jsonData)
    
    // Najdeme odpovídající budovu (GET nevytváří novou)
    const result = await findOrCreateBuilding(jsonData)
    
    return NextResponse.json({
      file: jsonFile,
      address,
      year,
      buildingName: jsonData.house_info?.nazev || null,
      matchedBuilding: { id: result.building.id, name: result.building.name },
      buildingCreated: result.created,
      hasPredpisy: !!jsonData.predpisy?.length,
      unitCount: jsonData.predpisy?.length || 0
    })
  } catch (error) {
    return NextResponse.json({ 
      error: `Nelze načíst JSON soubor: ${error instanceof Error ? error.message : 'neznámá chyba'}` 
    }, { status: 500 })
  }
}

// POST - import předpisů z JSON (z uploadovaného souboru nebo ze serveru)
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const jsonFileFromQuery = url.searchParams.get('file')
  
  const log: string[] = []
  const warnings: string[] = []
  
  let jsonData: JsonData
  let sourceFileName = ''
  
  try {
    // Zkusíme načíst z FormData (upload z frontendu)
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Upload přes FormData
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return NextResponse.json({ error: 'Nebyl nahrán žádný soubor' }, { status: 400 })
      }
      
      sourceFileName = file.name
      const content = await file.text()
      jsonData = JSON.parse(content) as JsonData
      
      log.push(`📄 Načten uploadovaný JSON soubor: ${sourceFileName}`)
    } else if (jsonFileFromQuery) {
      // Načtení ze serveru (původní logika)
      const jsonPath = path.join(process.cwd(), 'JSON', jsonFileFromQuery)
      const content = await fs.readFile(jsonPath, 'utf-8')
      jsonData = JSON.parse(content) as JsonData
      sourceFileName = jsonFileFromQuery
      
      log.push(`📄 Načten JSON soubor ze serveru: ${sourceFileName}`)
    } else {
      return NextResponse.json({ error: 'Musíte buď nahrát soubor nebo specifikovat ?file=nazev.json' }, { status: 400 })
    }
    
    // 2. Extrahujeme rok
    const year = extractYear(jsonData)
    
    if (!year) {
      return NextResponse.json({ error: 'JSON neobsahuje rok vyúčtování' }, { status: 400 })
    }
    
    log.push(`📅 Rok z JSON: ${year}`)
    
    // 3. Najdeme nebo vytvoříme budovu
    const { building, created: buildingCreated } = await findOrCreateBuilding(jsonData)
    
    if (buildingCreated) {
      log.push(`🆕 Vytvořena nová budova: ${building.name} (ID: ${building.id})`)
    } else {
      log.push(`✅ Nalezena budova: ${building.name} (ID: ${building.id})`)
    }
    
    // 4. Najdeme nebo vytvoříme billing period
    let billingPeriod = await prisma.billingPeriod.findFirst({
      where: {
        buildingId: building.id,
        year
      }
    })
    
    if (!billingPeriod) {
      billingPeriod = await prisma.billingPeriod.create({
        data: {
          buildingId: building.id,
          year,
        }
      })
      log.push(`🆕 Vytvořeno zúčtovací období: ${year}`)
    } else {
      log.push(`📅 Používám existující zúčtovací období: ${year}`)
    }
    
    // 5. SMAZÁNÍ STARÝCH DAT - jednotky a související záznamy
    // Nejprve smažeme staré měsíční předpisy pro rok
    const existingUnits = await prisma.unit.findMany({
      where: { buildingId: building.id }
    })
    
    if (existingUnits.length > 0) {
      // Smažeme předpisy záloh
      const deletedAdvances = await prisma.advanceMonthly.deleteMany({
        where: { 
          unitId: { in: existingUnits.map(u => u.id) },
          year 
        }
      })
      log.push(`🗑️ Smazáno ${deletedAdvances.count} starých měsíčních předpisů pro rok ${year}`)
      
      // Smažeme všechny jednotky této budovy (cascade smaže i související data)
      const deletedUnits = await prisma.unit.deleteMany({
        where: { buildingId: building.id }
      })
      log.push(`🗑️ Smazáno ${deletedUnits.count} starých jednotek`)
    }
    
    // 6. Načteme služby
    const services = await prisma.service.findMany({
      where: { buildingId: building.id }
    })
    log.push(`📋 Nalezeno ${services.length} služeb`)
    
    // KONTROLA MAPOVÁNÍ SLUŽEB
    const hasMappingConfiguredForLog = hasServiceMapping(services)
    if (!hasMappingConfiguredForLog && services.length > 0) {
      warnings.push('⚠️ Služby nemají nakonfigurované mapování (advancePaymentColumn). Používám fallback mapování podle názvu.')
    }
    
    // Debug: vypíšeme služby pro kontrolu mapování
    const mappedServicesLog = services.filter(s => s.advancePaymentColumn).map(s => `${s.name}→${s.advancePaymentColumn}`)
    if (mappedServicesLog.length > 0) {
      log.push(`🔗 Služby s mapováním: ${mappedServicesLog.join(', ')}`)
    } else {
      log.push(`📋 Služby v DB (bez mapování): ${services.map(s => s.name).join(', ')}`)
    }
    
    // 7. Import předpisů z JSON
    if (!jsonData.predpisy?.length) {
      return NextResponse.json({
        error: 'JSON neobsahuje žádné předpisy (predpisy)',
        log
      }, { status: 400 })
    }
    
    // 8. Vytvoříme jednotky z JSON
    const createdUnits: { id: string; unitNumber: string }[] = []
    const seenUnitNumbers = new Set<string>()
    
    for (const predpis of jsonData.predpisy) {
      const unitNumber = predpis.oznaceni
      
      // Přeskočíme duplicity
      if (seenUnitNumbers.has(unitNumber)) continue
      seenUnitNumbers.add(unitNumber)
      
      // Vytvoříme jednotku s výchozími hodnotami
      const unit = await prisma.unit.create({
        data: {
          buildingId: building.id,
          unitNumber: unitNumber,
          shareNumerator: 1,
          shareDenominator: 1,
          totalArea: 0,
        }
      })
      createdUnits.push({ id: unit.id, unitNumber: unit.unitNumber || '' })
    }
    log.push(`🆕 Vytvořeno ${createdUnits.length} jednotek z JSON`)
    
    // Mapa jednotek pro rychlý lookup
    const unitMap = new Map<string, string>() // unitNumber -> unitId
    for (const unit of createdUnits) {
      unitMap.set(unit.unitNumber, unit.id)
    }
    
    // 9. Import předpisů záloh
    const advancesToCreate: { unitId: string; serviceId: string; year: number; month: number; amount: number }[] = []
    const skippedServices: string[] = []
    
    for (const predpis of jsonData.predpisy) {
      const unitId = unitMap.get(predpis.oznaceni)
      if (!unitId) continue
      
      // Projdeme všechny služby v předpisu
      for (const [key, value] of Object.entries(predpis)) {
        if (key === 'oznaceni' || key === 'uzivatel') continue
        if (typeof value !== 'object' || value === null) continue
        
        // value je objekt {1: částka, 2: částka, ...}
        const monthlyValues = value as Record<string, number>
        
        // Najdeme službu
        const service = findServiceByPredpisKey(services, key)
        if (!service) {
          if (!skippedServices.includes(key)) {
            skippedServices.push(key)
          }
          continue
        }
        
        // Vytvoříme předpisy pro každý měsíc - přidáme do pole pro hromadný insert
        for (const [monthStr, amount] of Object.entries(monthlyValues)) {
          const month = parseInt(monthStr, 10)
          if (isNaN(month) || month < 1 || month > 12) continue
          if (typeof amount !== 'number' || amount === 0) continue
          
          advancesToCreate.push({
            unitId: unitId,
            serviceId: service.id,
            year,
            month,
            amount: Math.round(amount * 100) / 100
          })
        }
      }
    }
    
    // Hromadný insert všech předpisů najednou (mnohem rychlejší)
    // skipDuplicates = true ignoruje záznamy, které už existují
    if (advancesToCreate.length > 0) {
      await prisma.advanceMonthly.createMany({
        data: advancesToCreate,
        skipDuplicates: true
      })
    }
    
    const importedCount = advancesToCreate.length
    log.push(`✅ Importováno ${importedCount} záznamů předpisů`)
    
    if (skippedServices.length > 0) {
      warnings.push(`Služby nenalezeny v DB: ${skippedServices.join(', ')}`)
    }
    
    // Kontrola mapování služeb
    const hasMappingConfigured = hasServiceMapping(services)
    const mappedServicesCount = services.filter(s => s.advancePaymentColumn).length
    
    if (!hasMappingConfigured && services.length > 0 && skippedServices.length > 0) {
      warnings.push(`⚠️ Doporučujeme nahrát Excel s mapováním služeb pro tento dům (Nastavení → Mapování služeb)`)
    }
    
    // Struktura odpovědi kompatibilní s frontend ImportResult
    return NextResponse.json({
      message: `Import dokončen - ${importedCount} předpisů záloh importováno pro ${building.name}`,
      building: { 
        id: building.id, 
        name: building.name,
        created: buildingCreated 
      },
      year,
      advances: {
        created: importedCount,
        updated: 0, // Při tomto importu vždy mažeme a vytváříme nově
        total: importedCount
      },
      serviceMapping: {
        hasMapping: hasMappingConfigured,
        totalServices: services.length,
        mappedServices: mappedServicesCount,
        unmappedJsonKeys: skippedServices
      },
      log,
      warnings
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Neznámá chyba',
      log
    }, { status: 500 })
  }
}
