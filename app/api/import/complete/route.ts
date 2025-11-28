import { NextRequest } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'
import { CalculationMethod, DataSourceType, MeterType, Service, Meter } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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

// Mapování názvů záložek na typy měřidel
const SHEET_TO_METER_TYPE: Record<string, string> = {
  'vodoměry tuv': 'HOT_WATER',
  'vodoměry sv': 'COLD_WATER',
  'teplo': 'HEATING',
  'elektroměry': 'ELECTRICITY'
}

const METER_TYPE_LABELS: Record<string, string> = {
  'HOT_WATER': 'Teplá voda',
  'COLD_WATER': 'Studená voda',
  'HEATING': 'Teplo',
  'ELECTRICITY': 'Elektřina'
}

function normalizeHeaderCell(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Funkce pro nalezení služby podle JSON klíče předpisu
function findServiceByPredpisKey(services: Service[], predpisKey: string): Service | undefined {
  const possibleNames = PREDPISY_SERVICE_MAP[predpisKey]
  if (!possibleNames) return undefined
  
  for (const name of possibleNames) {
    const normalizedName = normalizeHeaderCell(name)
    const found = services.find(s => normalizeHeaderCell(s.name) === normalizedName)
    if (found) return found
  }
  
  // Fuzzy fallback - hledáme částečnou shodu
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

// Typy pro JSON strukturu předpisů
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
}

interface JsonData {
  house_info?: JsonHouseInfo
  vstupni_data?: JsonVstupniData
  predpisy?: JsonPredpis[]
}

// Funkce pro načtení JSON souboru s předpisy
async function loadJsonPredpisy(jsonPath: string): Promise<JsonData | null> {
  try {
    const content = await fs.readFile(jsonPath, 'utf-8')
    return JSON.parse(content) as JsonData
  } catch {
    return null
  }
}

// Funkce pro kontrolu zda JSON data odpovídají budově
function jsonMatchesBuilding(jsonData: JsonData, buildingName: string, buildingAddress: string | null): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
  
  const buildingNameNorm = normalize(buildingName)
  const buildingAddrNorm = buildingAddress ? normalize(buildingAddress) : ''
  
  // Zkusíme párovat podle house_info
  if (jsonData.house_info) {
    const jsonNazev = jsonData.house_info.nazev ? normalize(jsonData.house_info.nazev) : ''
    const jsonSidlo = jsonData.house_info.sidlo ? normalize(jsonData.house_info.sidlo) : ''
    
    // Částečná shoda názvu nebo sídla
    if (jsonNazev && (jsonNazev.includes(buildingNameNorm) || buildingNameNorm.includes(jsonNazev))) return true
    if (jsonSidlo && buildingAddrNorm && (jsonSidlo.includes(buildingAddrNorm) || buildingAddrNorm.includes(jsonSidlo))) return true
    
    // Extrahujeme ulici z adresy pro porovnání
    const extractStreet = (addr: string) => {
      const match = addr.match(/^([^,\d]+)/i)
      return match ? normalize(match[1]) : ''
    }
    
    const jsonStreet = extractStreet(jsonSidlo)
    const buildingStreet = extractStreet(buildingNameNorm) || extractStreet(buildingAddrNorm)
    
    if (jsonStreet && buildingStreet && (jsonStreet.includes(buildingStreet) || buildingStreet.includes(jsonStreet))) return true
  }
  
  // Zkusíme párovat podle vstupni_data.adresa
  if (jsonData.vstupni_data?.adresa) {
    const jsonAdresa = normalize(jsonData.vstupni_data.adresa)
    if (jsonAdresa && buildingAddrNorm && (jsonAdresa.includes(buildingAddrNorm) || buildingAddrNorm.includes(jsonAdresa))) return true
    
    // Extrahujeme ulici
    const extractStreet = (addr: string) => {
      const match = addr.match(/^([^,\d]+)/i)
      return match ? normalize(match[1]) : ''
    }
    
    const jsonStreet = extractStreet(jsonAdresa)
    const buildingStreet = extractStreet(buildingNameNorm) || extractStreet(buildingAddrNorm)
    
    if (jsonStreet && buildingStreet && (jsonStreet.includes(buildingStreet) || buildingStreet.includes(jsonStreet))) return true
  }
  
  return false
}

function parseNumberCell(value: string | undefined) {
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function stripUnitPrefixes(value: string) {
  return value
    .replace(/^(jednotka|byt|nebytový prostor|nebyt\.|ateliér|atelier|garáž|garaz|sklep|bazén|bazen)\s*(č\.?|c\.?)?\s*/gi, '')
    .replace(/^(č\.?|c\.?)\s*/gi, '')
    .trim()
}

const METHOD_RULES: Array<{ method: CalculationMethod; tests: RegExp[] }> = [
  {
    method: CalculationMethod.NO_BILLING,
    tests: [/nevyuct/, /neuctuj/, /bez vyuct/, /neuctovat/, /neuctuje/]
  },
  {
    method: CalculationMethod.METER_READING,
    tests: [
      /odecet sv/,
      /odecetsv/,
      /odecet tuv/,
      /odecty tuv/,
      /odecet/,
      /odect/,
      /spotreb/,
      /meridl/,
      /mereni/,
      /vodomer/,
      /studen/,
      /tuv/,
      /tepl/,
      /ohrev/,
      /elektr/,
      /plyn/,
      /kwh/,
      /m3/,
      /gj/,
      /kalor/,
      /patni/,
      /alokac/,
      /externi/,
      /extern/
    ]
  },
  {
    method: CalculationMethod.AREA,
    tests: [
      /m2 celkov/,
      /m2celkov/,
      /m2 celk/,
      /m 2 celk/,
      /celkov.*plocha/,
      /plocha/,
      /vymer/,
      /m2/,
      /m 2/,
      /m\^2/,
      /ctverecn/
    ]
  },
  {
    method: CalculationMethod.PERSON_MONTHS,
    tests: [/osob/, /osobo/, /os\/m/, /obyvatel/, /hlav/, /popeln/, /odpad/, /odpady/, /komunal/]
  },
  {
    method: CalculationMethod.FIXED_PER_UNIT,
    tests: [/kc\/byt/, /kc\/jed/, /pau/, /paus/, /fixn/]
  },
  {
    method: CalculationMethod.EQUAL_SPLIT,
    tests: [
      /na byt/,
      /nabyt/,
      /rovnym dilem/,
      /rovnymdilem/,
      /rovnym/,
      /rovnomer/,
      /po bytech/,
      /per flat/,
      /per unit/,
      /kazdy byt/,
      /1\/22/,
      /1\/23/,
      /1\/\d+/,
      /dilem/
    ]
  },
  {
    method: CalculationMethod.UNIT_PARAMETER,
    tests: [/parametr/, /koeficient/, /radiator/]
  },
  {
    method: CalculationMethod.OWNERSHIP_SHARE,
    tests: [/vlastnick/, /vlastni/, /podil/, /spoluvlast/, /fond oprav/]
  }
]

const METHOD_OVERRIDES: Record<string, CalculationMethod> = {
  'na byt': CalculationMethod.EQUAL_SPLIT,
  'nabyt': CalculationMethod.EQUAL_SPLIT,
  'kazdy byt': CalculationMethod.EQUAL_SPLIT,
  'rovnym dilem': CalculationMethod.EQUAL_SPLIT,
  'rovnym dilem 1/22': CalculationMethod.EQUAL_SPLIT,
  'rovnym dilem 1/23': CalculationMethod.EQUAL_SPLIT,
  'dilem': CalculationMethod.EQUAL_SPLIT,
  'vlastnicky podil': CalculationMethod.OWNERSHIP_SHARE,
  'vlastnicky podilu': CalculationMethod.OWNERSHIP_SHARE,
  'podil': CalculationMethod.OWNERSHIP_SHARE,
  'nevyuctovava se': CalculationMethod.NO_BILLING,
  'nevyuctovavat': CalculationMethod.NO_BILLING,
  'odecet sv': CalculationMethod.METER_READING,
  'odecet tuv': CalculationMethod.METER_READING,
  'odecet meridel': CalculationMethod.METER_READING,
  'externi': CalculationMethod.METER_READING,
  'extern': CalculationMethod.METER_READING,
  'm2 celkove plochy': CalculationMethod.AREA,
  'm2 celkova plocha': CalculationMethod.AREA,
  'celkova plocha': CalculationMethod.AREA,
  'plocha': CalculationMethod.AREA
}

function matchMethodFromValue(value?: string | null): CalculationMethod | null {
  const normalized = normalizeHeaderCell(String(value ?? ''))
  if (!normalized) return null
  if (METHOD_OVERRIDES[normalized]) {
    return METHOD_OVERRIDES[normalized]
  }
  for (const rule of METHOD_RULES) {
    if (rule.tests.some(pattern => pattern.test(normalized))) {
      return rule.method
    }
  }
  return null
}

function detectCalculationMethodFromCells(input: { methodCell?: string | null; unitCell?: string | null; serviceName?: string | null }): CalculationMethod | null {
  // Priority: metodika > jednotka > defaultně podle názvu služby
  const fromMethod = matchMethodFromValue(input.methodCell)
  if (fromMethod) return fromMethod
  
  const fromUnit = matchMethodFromValue(input.unitCell)
  if (fromUnit) return fromUnit
  
  // Jen pokud ani metodika ani jednotka nic neříkají, podíváme se na název služby
  // ale s omezenou sadou pravidel
  const serviceName = normalizeHeaderCell(String(input.serviceName ?? ''))
  if (serviceName) {
    if (/fond oprav/.test(serviceName)) return CalculationMethod.OWNERSHIP_SHARE
    if (/pojist/.test(serviceName)) return CalculationMethod.OWNERSHIP_SHARE
    if (/rezerv/.test(serviceName)) return CalculationMethod.OWNERSHIP_SHARE
  }
  
  return null
}

interface ImportSummary {
  building: {
    id: string
    name: string
    created: boolean
  }
  units: {
    created: number
    existing: number
    total: number
  }
  owners: {
    created: number
    existing: number
    total: number
  }
  services: {
    created: number
    existing: number
    total: number
  }
  costs: {
    created: number
    updated?: number
    skipped?: number
    total: number
  }
  readings: {
    created: number
    total: number
    details?: {
      sheetName: string
      columns: {
        unit: { letter: string; number: number; header: string }
        meter: { letter: string; number: number; header: string }
        initialReading?: { letter: string; number: number; header: string }
        finalReading?: { letter: string; number: number; header: string }
        consumption?: { letter: string; number: number; header: string }
        yearlyCost?: { letter: string; number: number; header: string }
        radioModule?: { letter: string; number: number; header: string }
        externalId?: { letter: string; number: number; header: string }
      }
    }[]
  }
  payments: {
    created: number
    total: number
  }
  costsByService?: { name: string; amount: number }[]
  advances?: { created: number; updated: number; total: number }
  errors: string[]
  warnings: string[]
}

type UnitLite = { id: string; meters?: { id: string; type: MeterType; isActive: boolean }[]; variableSymbol?: string | null }

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = async (data: any) => {
    await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ type: 'error', message: 'Neplatná data formuláře' }), { status: 400 })
  }

  (async () => {
  try {
    const file = formData.get('file')
    const buildingName = (formData.get('buildingName') as string) || ''
    const buildingId = (formData.get('buildingId') as string) || ''
    const year = (formData.get('year') as string) || ''

      console.log(`[Import] Start importu. BuildingId: '${buildingId}', BuildingName: '${buildingName}', Year: '${year}'`)

      if (!file) {
        await send({ type: 'error', message: 'Soubor s vyúčtováním nebyl přiložen.' })
        await writer.close()
        return
      }

      const fileObj = file instanceof File ? file : new File([file as unknown as Blob], 'upload.xlsx', { type: ((file as unknown) as Blob).type || 'application/octet-stream' })

      if (fileObj.size === 0) {
        await send({ type: 'error', message: 'Nahraný soubor je prázdný.' })
        await writer.close()
        return
      }

      if (fileObj.size > MAX_FILE_SIZE) {
        await send({ type: 'error', message: 'Soubor je příliš velký (limit 10 MB).' })
        await writer.close()
        return
      }

      if (!/\.xlsx?$/i.test(fileObj.name)) {
        await send({ type: 'error', message: 'Nepodporovaný formát souboru.' })
        await writer.close()
        return
      }

      await send({ type: 'progress', percentage: 5, step: 'Načítám Excel soubor...' })
      
      const buffer = Buffer.from(await fileObj.arrayBuffer())
      const workbook = read(buffer, { type: 'buffer' })

      const summary: ImportSummary = {
        building: { id: '', name: '', created: false },
        units: { created: 0, existing: 0, total: 0 },
        owners: { created: 0, existing: 0, total: 0 },
        services: { created: 0, existing: 0, total: 0 },
        costs: { created: 0, updated: 0, skipped: 0, total: 0 },
        readings: { created: 0, total: 0, details: [] },
        payments: { created: 0, total: 0 },
        costsByService: [],
        advances: { created: 0, updated: 0, total: 0 },
        errors: [],
        warnings: []
      }

      const logs: string[] = []
      const log = async (msg: string) => { 
        logs.push(msg)
        console.log(msg)
        await send({ type: 'log', message: msg })
      }

      // 1. NAJÍT NEBO VYTVOŘIT DŮM
      await send({ type: 'progress', percentage: 10, step: 'Zpracovávám budovu...' })
      
      let buildingAddress = 'Adresu upravte v detailu budovy'
      let billingPeriod = year || String(new Date().getFullYear())
      
      const inputDataSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('vstupní') || name.toLowerCase().includes('vstupni') || name.toLowerCase().includes('input')
      )
      
      let managerName: string | null = null
      let totalArea: number | null = null
      let chargeableArea: number | null = null
      let chimneysCount: number | null = null
      let totalPeople: number | null = null
      let bankAccount: string | null = null
      
      let buildingNameFromExcel: string | null = null
      
      if (inputDataSheetName) {
        const inputSheet = workbook.Sheets[inputDataSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(inputSheet, { header: 1, defval: '' })
        
        // B3 (row index 2, col index 1) -> Building Name
        if (rawData.length > 2 && rawData[2] && rawData[2][1]) {
          const nameValue = String(rawData[2][1]).trim()
          if (nameValue) buildingNameFromExcel = nameValue
        }

        // B31 (row index 30, col index 1) -> Building Address
        if (rawData.length > 30 && rawData[30] && rawData[30][1]) {
          const addressValue = String(rawData[30][1]).trim()
          if (addressValue) buildingAddress = addressValue
        }
        
        if (rawData.length > 11 && rawData[11] && rawData[11][1]) {
          const periodValue = String(rawData[11][1]).trim()
          if (periodValue) {
            const periodMatch = periodValue.match(/(\d{4})/)
            if (periodMatch) {
              billingPeriod = periodMatch[1]
              await log(`[Import] Načteno období z B12: ${billingPeriod}`)
            }
          }
        }

        // Načtení parametrů budovy (řádky 18-21)
        if (rawData.length > 17 && rawData[17] && rawData[17][1]) {
           totalArea = parseNumberCell(String(rawData[17][1])) ?? null
           if (totalArea) await log(`[Import] Načtena celková plocha: ${totalArea}`)
        }
        if (rawData.length > 18 && rawData[18] && rawData[18][1]) {
           chargeableArea = parseNumberCell(String(rawData[18][1])) ?? null
           if (chargeableArea) await log(`[Import] Načtena započitatelná plocha: ${chargeableArea}`)
        }
        if (rawData.length > 19 && rawData[19] && rawData[19][1]) {
           chimneysCount = parseNumberCell(String(rawData[19][1])) ?? null
        }
        if (rawData.length > 20 && rawData[20] && rawData[20][1]) {
           totalPeople = parseNumberCell(String(rawData[20][1])) ?? null
        }
        
        if (rawData.length > 33 && rawData[33] && rawData[33][1]) {
          managerName = String(rawData[33][1]).trim() || null
          if (managerName) await log(`[Import] Načten správce z B34: ${managerName}`)
        } else {
           // Fallback: zkusíme najít řádek s textem "Správce nemovitosti"
           const managerRowIndex = rawData.findIndex(r => r && String(r[0]).toLowerCase().includes('správce nemovitosti'))
           if (managerRowIndex !== -1 && rawData[managerRowIndex][1]) {
              managerName = String(rawData[managerRowIndex][1]).trim() || null
              if (managerName) await log(`[Import] Načten správce z řádku ${managerRowIndex + 1}: ${managerName}`)
           }
        }

        // B35 (row index 34, col index 1) -> Bank Account
        if (rawData.length > 34 && rawData[34] && rawData[34][1]) {
           const bankAccountValue = String(rawData[34][1]).trim()
           if (bankAccountValue) {
              bankAccount = bankAccountValue
              await log(`[Import] Načten bankovní účet z B35: ${bankAccount}`)
           }
        }
      }
      
      let building;

      if (buildingId) {
        console.log(`[Import] Hledám budovu podle ID: ${buildingId}`)
        building = await prisma.building.findUnique({
          where: { id: buildingId }
        })
        if (!building) {
           throw new Error(`Budova s ID ${buildingId} nebyla nalezena.`)
        }
        console.log(`[Import] Nalezena budova: ${building.name} (${building.id})`)
      } else {
        console.log(`[Import] ID budovy nezadáno, hledám podle názvu z Excelu: ${buildingNameFromExcel}`)
        const finalBuildingName = buildingName || buildingNameFromExcel || 'Importovaná budova ' + new Date().toLocaleDateString('cs-CZ')
        
        building = await prisma.building.findFirst({
          where: { name: { contains: finalBuildingName, mode: 'insensitive' } }
        })

        if (!building) {
          console.log(`[Import] Budova nenalezena, vytvářím novou: ${finalBuildingName}`)
          building = await prisma.building.create({
            data: {
              name: finalBuildingName,
              address: buildingAddress,
              city: 'Nezadáno',
              zip: '00000',
              managerName: managerName,
            }
          })
          summary.building.created = true
        } else {
          console.log(`[Import] Nalezena existující budova podle názvu: ${building.name} (${building.id})`)
        }
      }

      summary.building.id = building.id
      summary.building.name = building.name

      // Aktualizace parametrů budovy z Excelu
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildingUpdates: any = {}
      if (totalArea !== null) buildingUpdates.totalArea = totalArea
      if (chargeableArea !== null) buildingUpdates.chargeableArea = chargeableArea
      if (chimneysCount !== null) buildingUpdates.chimneysCount = chimneysCount
      if (totalPeople !== null) buildingUpdates.totalPeople = totalPeople
      if (managerName !== null && managerName !== building.managerName) buildingUpdates.managerName = managerName
      if (bankAccount !== null && bankAccount !== building.bankAccount) buildingUpdates.bankAccount = bankAccount

      if (Object.keys(buildingUpdates).length > 0) {
         building = await prisma.building.update({
            where: { id: building.id },
            data: buildingUpdates
         })
         await log(`[Import] Aktualizovány parametry budovy (plocha, osoby, atd.).`)
      }

      // NOVÁ LOGIKA: Aktualizace šablony emailu podle správce
      if (managerName) {
        const normalizedManager = managerName.toLowerCase()
        let emailBody = ''
        let smsBody = ''
        
        const commonHeader = `#osloveni#,\nzasíláme Vám v příloze vyúčtování k Vaší jednotce - #jednotka_cislo# v bytovém domě #bytovy_dum# za rok #rok#.\n\nS pozdravem,\n#spravce#\n\n`
        const smsCommon = `#osloveni# dnes Vám bylo na email #email# zasláno vyúčtování za rok #rok# k Vaší bytové jednotce #jednotka_cislo# v bytovém domě na adrese #bytovy_dum#.`

        if (normalizedManager.includes('adminreal') || normalizedManager.includes('adminre')) {
           emailBody = `${commonHeader}AdminReal s.r.o.\nVeveří 2581/102, 616 00 Brno\ntel: +420 777 338 203\n\ninfo@adminreal.cz\nwww.adminreal.cz\nwww.onlinesprava.cz`
           smsBody = `${smsCommon} AdminReal s.r.o.`
        } else if (normalizedManager.includes('brnoreal')) {
           emailBody = `${commonHeader}Brnoreal s.r.o.\nVeveří 2581/102, 616 00 Brno\ntel: +420 777 338 203\n\ninfo@brnoreal.cz\nwww.brnoreal.cz`
           smsBody = `${smsCommon} Brnoreal s.r.o.`
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        if (emailBody) updateData.emailTemplateBody = emailBody
        if (smsBody) updateData.smsTemplateBody = smsBody

        if (Object.keys(updateData).length > 0) {
           await prisma.building.update({
              where: { id: building.id },
              data: updateData
           })
           await log(`[Import] Aktualizovány šablony (Email/SMS) pro správce: ${managerName}`)
        }
      }

      // --- OPTIMALIZACE: KONTROLA ZÁMKU A HROMADNÉ MAZÁNÍ ---
      const pYear = parseInt(billingPeriod, 10)
      const existingPeriod = await prisma.billingPeriod.findUnique({
        where: { buildingId_year: { buildingId: building.id, year: pYear } }
      })

      if (existingPeriod && (existingPeriod.status === 'APPROVED' || existingPeriod.status === 'SENT')) {
        throw new Error(`Vyúčtování pro rok ${pYear} je již ve stavu ${existingPeriod.status} a nelze jej přepsat importem.`)
      }

      const billingPeriodRecord = await prisma.billingPeriod.upsert({
        where: { buildingId_year: { buildingId: building.id, year: pYear } },
        update: {},
        create: { buildingId: building.id, year: pYear }
      })
      await log(`[Import] BillingPeriod ID: ${billingPeriodRecord.id}`)

      // Hromadné smazání transakčních dat pro daný rok (zrychlení importu)
      await send({ type: 'progress', percentage: 15, step: 'Mažu stará data pro tento rok...' })
      await log(`[Cleanup] Mažu data pro rok ${pYear}...`)
      
      await prisma.$transaction([
        prisma.cost.deleteMany({ where: { buildingId: building.id, period: pYear } }),
        prisma.payment.deleteMany({ where: { unit: { buildingId: building.id }, period: pYear } }),
        // Nemazat měřidla (jsou trvalá), ale odečty pro tento rok
        prisma.meterReading.deleteMany({ where: { meter: { unit: { buildingId: building.id } }, period: pYear } }),
        prisma.advanceMonthly.deleteMany({ where: { unit: { buildingId: building.id }, year: pYear } }),
        prisma.personMonth.deleteMany({ where: { unit: { buildingId: building.id }, year: pYear } }),
        // Smazat i výsledky vyúčtování, aby se přepočetly
        prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriodRecord.id } })
      ])
      await log(`[Cleanup] Data pro rok ${pYear} smazána.`)

      // Inicializace mapy jednotek pro pozdější použití
      // Načteme všechny jednotky do paměti pro rychlé vyhledávání
      const allUnits = await prisma.unit.findMany({ 
        where: { buildingId: building.id },
        include: { meters: true }
      })
      
      const unitMap = new Map<string, UnitLite>()
      allUnits.forEach(u => {
        unitMap.set(u.unitNumber, u)
        unitMap.set(stripUnitPrefixes(u.unitNumber), u)
      })

      // 2. IMPORT VLASTNÍKŮ
      await send({ type: 'progress', percentage: 20, step: 'Importuji vlastníky a jednotky...' })
      
      const evidenceSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('evidence') || name.toLowerCase().includes('evidenc')
      )

      const ownerMap = new Map<string, { id: string; firstName: string; lastName: string }>()
      const salutationMap = new Map<string, string>()
      
      const exportSendMailSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().replace(/[\s_-]/g, '').includes('exportsendmail') ||
        (name.toLowerCase().includes('export') && name.toLowerCase().includes('send')) ||
        name.toLowerCase().includes('seznam')
      )
      
      if (exportSendMailSheetName) {
        const exportSheet = workbook.Sheets[exportSendMailSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(exportSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => 
          row.some((cell: unknown) => {
            const cellStr = String(cell).toLowerCase()
            return cellStr.includes('jednotka') || cellStr.includes('byt') || cellStr.includes('adresa')
          })
        )
        
        if (headerRowIndex !== -1) {
          const dataRows = rawData.slice(headerRowIndex + 1)
          await log(`[Export_Send_Mail/Seznam] Zpracovávám ${dataRows.length} řádků oslovení z listu ${exportSendMailSheetName}`)
          
          const isSeznam = exportSendMailSheetName.toLowerCase().includes('seznam')
          
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0) continue
            
            let unitNumber = ''
            let salutation = ''

            if (isSeznam) {
               // Seznam: Unit Number = Col L (11), Salutation = Col O (14)
               unitNumber = String(row[11] || '').trim()
               salutation = String(row[14] || '').trim()
            } else {
               // Export_Send_Mail: Unit Number = Col A (0), Salutation = Col N (13)
               unitNumber = String(row[0] || '').trim()
               salutation = String(row[13] || '').trim()
            }

            if (unitNumber && salutation) {
               salutationMap.set(unitNumber, salutation)
               // Also set for stripped version just in case
               salutationMap.set(stripUnitPrefixes(unitNumber), salutation)
            }
          }
        }
      }

      if (evidenceSheetName) {
        const evidenceSheet = workbook.Sheets[evidenceSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(evidenceSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => 
          row.some((cell: unknown) => {
            const cellStr = String(cell).toLowerCase()
            return cellStr.includes('jméno') || cellStr.includes('jmeno') || cellStr.includes('příjmení')
          })
        )

        if (headerRowIndex !== -1) {
          const dataRows = rawData.slice(headerRowIndex + 1)
          await log(`[Evidence] Zpracovávám ${dataRows.length} řádků vlastníků`)
          
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0 || !row[1]) continue

            const unitCellRaw = String(row[0] || '').trim()
            // Použijeme plný název z Excelu (např. "Jednotka č. 318/01" nebo "Bazén č. ...")
            const unitNumber = unitCellRaw
            const strippedUnitNumber = stripUnitPrefixes(unitNumber)

                        const fullName = String(row[1] || '').trim()
            const address = String(row[2] || '').trim()
            const email = String(row[3] || '').trim()
            const phone = String(row[4] || '').trim()
            const areaRaw = String(row[6] || '').trim()
            const variableSymbol = String(row[9] || '').trim()
            
            // Sloupce pro podíly: L (11) = Jmenovatel, M (12) = Čitatel, N (13) = Procento
            const shareDenominatorRaw = String(row[11] || '').trim()
            const shareNumeratorRaw = String(row[12] || '').trim()
            const ownershipShareRaw = String(row[13] || '').trim()
            
            // Načtení datumu "V evidenci od" (sloupec P = index 15) a "V evidenci do" (sloupec Q = index 16)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parseExcelDate = (val: any): Date | null => {
              if (!val) return null
              if (val instanceof Date) return val
              const num = parseFloat(val)
              if (!isNaN(num) && num > 20000) {
                // Excel date serial number conversion
                return new Date(Math.round((num - 25569) * 86400 * 1000))
              }
              // Try parsing string date "1.1.2024"
              if (typeof val === 'string') {
                const parts = val.split('.')
                if (parts.length === 3) {
                  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
                }
              }
              return null
            }

            const validFromRaw = row[15]
            const validToRaw = row[16]
            
            const validFromDate = parseExcelDate(validFromRaw)
            const validToDate = parseExcelDate(validToRaw)

            const totalArea = (() => {
              const num = parseFloat(areaRaw.replace(',', '.'))
              return Number.isFinite(num) ? num : 0
            })()

            let shareNumerator = 0, shareDenominator = 10000
            
            // 1. Zkusíme načíst přesný zlomek ze sloupců M (čitatel) a L (jmenovatel)
            const numM = parseFloat(shareNumeratorRaw.replace(/\s/g, '').replace(',', '.'))
            const denL = parseFloat(shareDenominatorRaw.replace(/\s/g, '').replace(',', '.'))
            
            if (Number.isFinite(numM) && Number.isFinite(denL) && denL > 0) {
               shareNumerator = Math.round(numM)
               shareDenominator = Math.round(denL)
            } else {
               // 2. Fallback na sloupec N (nebo starý formát 123/10000)
               if (/^\d+\s*\/\s*\d+$/.test(ownershipShareRaw)) {
                 const [a, b] = ownershipShareRaw.split('/')
                 shareNumerator = parseInt(a.trim(), 10)
                 shareDenominator = parseInt(b.trim(), 10) || 1
               } else if (ownershipShareRaw) {
                 const dec = parseFloat(ownershipShareRaw.replace(',', '.'))
                 if (Number.isFinite(dec)) {
                   shareNumerator = Math.round(dec * shareDenominator)
                 }
               }
            }

            if (!fullName || !unitNumber) continue

            const nameParts = fullName.split(' ')
            const lastName = nameParts.pop() || ''
            const firstName = nameParts.join(' ') || lastName
            const salutation = salutationMap.get(unitNumber) || null

            let owner = await prisma.owner.findFirst({
              where: {
                OR: [
                  { email: email || undefined },
                  { AND: [{ firstName: { equals: firstName, mode: 'insensitive' } }, { lastName: { equals: lastName, mode: 'insensitive' } }] }
                ]
              }
            })

            if (!owner) {
              owner = await prisma.owner.create({
                data: { firstName, lastName, email: email || null, phone: phone || null, address: address || null, salutation: salutation }
              })
              summary.owners.created++
              await log(`[Evidence] Vytvořen vlastník: ${firstName} ${lastName}`)
            } else {
              if (salutation && owner.salutation !== salutation) {
                await prisma.owner.update({ where: { id: owner.id }, data: { salutation } })
              }
              summary.owners.existing++
            }
            summary.owners.total++

            let unit = await prisma.unit.findFirst({ 
              where: { 
                buildingId: building.id, 
                OR: [
                  { unitNumber: unitNumber },
                  { unitNumber: strippedUnitNumber }
                ]
              } 
            })

            if (!unit) {
              try {
                unit = await prisma.unit.create({
                  data: {
                    buildingId: building.id,
                    unitNumber,
                    type: 'APARTMENT',
                    shareNumerator: shareNumerator || 0,
                    shareDenominator: shareDenominator || 1,
                    totalArea: totalArea || 0,
                    variableSymbol: variableSymbol || null
                  }
                })
                summary.units.created++
              } catch (e) {
                // Fallback: zkusíme najít znovu (pokud create selhal na unique constraint)
                unit = await prisma.unit.findFirst({ 
                  where: { buildingId: building.id, unitNumber } 
                })
                if (!unit) throw e
              }
            } else {
              // Pokud se název liší (např. v DB je "318/01" a v Excelu "Jednotka č. 318/01"), aktualizujeme na plný název
              if (unit.unitNumber !== unitNumber) {
                try {
                  await prisma.unit.update({
                    where: { id: unit.id },
                    data: { unitNumber: unitNumber }
                  })
                  unit.unitNumber = unitNumber
                } catch {
                  // Pokud přejmenování selže (např. cílový název už existuje), necháme původní
                  await log(`[Evidence] Varování: Nelze přejmenovat jednotku '${unit.unitNumber}' na '${unitNumber}' (duplicita).`)
                }
              }

              await prisma.unit.update({
                where: { id: unit.id },
                data: {
                  shareNumerator: shareNumerator || unit.shareNumerator,
                  shareDenominator: shareDenominator || unit.shareDenominator,
                  totalArea: totalArea || unit.totalArea,
                  variableSymbol: variableSymbol || unit.variableSymbol || null
                }
              })
              summary.units.existing++
            }
            summary.units.total++

            // Uložíme do mapy pod oběma klíči pro snadnější vyhledávání
            unitMap.set(unitNumber, { id: unit.id, variableSymbol: unit.variableSymbol || undefined })
            unitMap.set(strippedUnitNumber, { id: unit.id, variableSymbol: unit.variableSymbol || undefined })

            const yearStart = new Date(parseInt(billingPeriod, 10), 0, 1)
            const effectiveValidFrom = validFromDate || yearStart
            const effectiveValidTo = validToDate || null

            const existingOwnership = await prisma.ownership.findFirst({ where: { unitId: unit.id, ownerId: owner.id } })
            if (!existingOwnership) {
              await prisma.ownership.create({
                data: { unitId: unit.id, ownerId: owner.id, validFrom: effectiveValidFrom, validTo: effectiveValidTo, sharePercent: 100 }
              })
            } else {
              await prisma.ownership.update({
                where: { id: existingOwnership.id },
                data: { validFrom: effectiveValidFrom, validTo: effectiveValidTo, sharePercent: 100 }
              })
            }
            ownerMap.set(unitNumber, { id: owner.id, firstName, lastName })
          }
        } else {
          summary.warnings.push('Na listu "Evidence" nebyla nalezena hlavička s vlastníky.')
        }
      } else {
        summary.warnings.push('Záložka "Evidence" nebyla nalezena.')
      }

      // 3. IMPORT FAKTUR
      await send({ type: 'progress', percentage: 40, step: 'Importuji faktury a náklady...' })

      // (Mazání již proběhlo v kroku 1)
      
      const allSheets = workbook.SheetNames.map(name => `"${name}"`).join(', ')
      await log(`[Faktury SEARCH] Všechny dostupné záložky: [${allSheets}]`)
      
      const invoicesSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('faktur') || name.toLowerCase().includes('invoice')
      )
      
      if (invoicesSheetName) {
        await log(`[Faktury FOUND] Nalezena záložka: "${invoicesSheetName}"`)
        const invoicesSheet = workbook.Sheets[invoicesSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(invoicesSheet, { header: 1, defval: '' })
        
        await log(`[Faktury RAW] Celkem řádků z Excelu: ${rawData.length}`)
        
        // HARDCODED KONFIGURACE DLE POŽADAVKU UŽIVATELE
        // A (0) = Název služby
        // B (1) = Nic
        // C (2) = Způsob rozúčtování
        // D (3) = Podíl (zatím jen logujeme, případně lze využít)
        // E (4) = Náklad
        
        const idxService = 0;
        const idxMethod = 2;
        const idxShare = 3;
        const idxAmount = 4;
        const idxAdvanceCol = 12; // Sloupec M (Předpis sloupec)

        await log(`[Faktury] Používám pevnou strukturu: A=Služba, C=Metoda, D=Podíl, E=Náklad, M=Sloupec záloh`)
        
        // Vypiš prvních 5 řádků jak vypadají
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
          const row = rawData[i] as unknown[]
          await log(`[RAW EXCEL ${i}] [0]="${row[0]}" [2]="${row[2]}" [3]="${row[3]}" [4]="${row[4]}"`)
        }

        const looksLikeHeader = (value: string) => /služb|způsob|jednotk|popis|souhrn|celkem|záloha|jednotka č|jednotka c|náklad/.test(value.toLowerCase())

        let detectedStartIndex = rawData.findIndex(row => {
          const arr = row as unknown[]
          const serviceCell = String(arr[idxService] ?? '').trim()
          const methodCell = String(arr[idxMethod] ?? '').trim()
          const amountCell = String(arr[idxAmount] ?? '').trim()
          const amountVal = parseNumberCell(amountCell)
          if (!serviceCell) return false
          if (looksLikeHeader(serviceCell)) return false
          if (looksLikeHeader(methodCell)) return false // FIX: Check if method cell looks like a header
          if (/^jednotka\s*c?\.?/.test(serviceCell.toLowerCase())) return false
          if (/prázdn/i.test(serviceCell) || /součet|sum/i.test(serviceCell)) return false
          if (/služba|název|položka/i.test(serviceCell)) return false
          const normalizedMethod = normalizeHeaderCell(methodCell)
          return Boolean(amountVal !== undefined || normalizedMethod.length > 0)
        })

        if (detectedStartIndex === -1) detectedStartIndex = rawData.length > 2 ? 2 : 0

        await log(`[Faktury] Data začínají na řádku ${detectedStartIndex + 1}`)

        const dataRows = rawData.slice(detectedStartIndex)
          
        // Cache services
        const dbServices = await prisma.service.findMany({ where: { buildingId: building.id } })
        const serviceKey = (value: string) => normalizeHeaderCell(value || '')
        const serviceMap = new Map<string, Service>()
        dbServices.forEach(s => serviceMap.set(serviceKey(s.name), s))
        
        // Funkce pro hledání služby s fuzzy matchingem
        const findServiceByName = (name: string): Service | undefined => {
          const normalizedName = serviceKey(name)
          // 1. Zkus přesnou shodu
          const found = serviceMap.get(normalizedName)
          if (found) return found
          
          // 2. Zkus najít službu, která obsahuje část názvu nebo naopak
          for (const [key, service] of serviceMap.entries()) {
            if (key.includes(normalizedName) || normalizedName.includes(key)) {
              return service
            }
          }
          
          return undefined
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const costsToCreate: any[] = []

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i] as unknown[]
          if (!row || row.length === 0) continue
          
          const serviceName = String(row[idxService] ?? '').trim()
          const methodology = String(row[idxMethod] ?? '').trim()
          const shareStr = String(row[idxShare] ?? '').trim()
          const amountStr = String(row[idxAmount] ?? '0').trim()
          const advanceColRaw = String(row[idxAdvanceCol] ?? '').trim()

          // DEBUG prvních 15 řádků
          if (i < 15) {
            await log(`[Faktury DETAIL ${i}] Služba="${serviceName}" | Metoda RAW="${methodology}" | Metoda norm="${normalizeHeaderCell(methodology)}" | Podíl="${shareStr}" | Částka="${amountStr}" | ZálohaSloupec="${advanceColRaw}"`)
          }

          if (!serviceName || /prázdn/i.test(serviceName) || /^\s*$/.test(serviceName)) {
            if (i < 15) await log(`[SKIP ${i}] Prázdné jméno služby`)
            continue
          }
          
          // Skip if it looks like a header repeated
          if (/služba|název|položka/i.test(serviceName)) {
            if (i < 15) await log(`[SKIP ${i}] Vypadá jako hlavička`)
            continue
          }

          const parsedAmount = parseNumberCell(amountStr)
          const amount = parsedAmount ?? 0
          if (parsedAmount === undefined && amountStr.length > 0) {
            await log(`[Faktury WARNING ${i}] "${serviceName}" - částka není číslo: "${amountStr}", použiji 0`)
          }
          
          if (i < 15) await log(`[PARSED ${i}] Částka="${amountStr}" -> ${amount}`)

          let service = findServiceByName(serviceName)

          const inferredMethod = detectCalculationMethodFromCells({
            methodCell: methodology,
            unitCell: null, // Unit cell not used
            serviceName
          })
          const calculationMethod: CalculationMethod = inferredMethod ?? 'OWNERSHIP_SHARE'
          await log(`[Faktury] ${serviceName} → ${calculationMethod} (metoda="${methodology || '-'}", podíl="${shareStr}")`)

          const src = (() => {
              if (calculationMethod === 'NO_BILLING') {
                return { dataSourceType: 'NONE', unitAttributeName: null, measurementUnit: null, dataSourceName: null }
              }

              if (calculationMethod === 'METER_READING') {
                const meterHints = `${methodology} ${serviceName}`.toLowerCase() // Removed unitVal
                let dsName = 'Měřidla'
                let measurementUnit = 'jednotek'

                if (
                  meterHints.includes('vodomer sv') ||
                  meterHints.includes('sv voda') ||
                  meterHints.includes('studen') ||
                  meterHints.includes('pitn') ||
                  meterHints.includes('vodne')
                ) {
                  dsName = 'Vodoměry SV'
                  measurementUnit = 'm³'
                } else if (
                  meterHints.includes('vodomer tuv') ||
                  meterHints.includes('tuv') ||
                  meterHints.includes('tepla voda') ||
                  meterHints.includes('ohrev') ||
                  meterHints.includes('bojler')
                ) {
                  dsName = 'Vodoměry TUV'
                  measurementUnit = 'm³'
                } else if (
                  meterHints.includes('teplo') ||
                  meterHints.includes('vytap') ||
                  meterHints.includes('radiator') ||
                  meterHints.includes('patni') ||
                  meterHints.includes('plyn') ||
                  meterHints.includes('externi') ||
                  meterHints.includes('kalor')
                ) {
                  dsName = 'Teplo'
                  measurementUnit = 'kWh'
                } else if (meterHints.includes('elektr')) {
                  dsName = 'Elektroměry'
                  measurementUnit = 'kWh'
                }

                return { dataSourceType: 'METER_DATA', unitAttributeName: null, measurementUnit, dataSourceName: dsName }
              }

              if (calculationMethod === 'AREA') return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'CELKOVA_VYMERA', measurementUnit: 'm²', dataSourceName: null }
              if (calculationMethod === 'PERSON_MONTHS') return { dataSourceType: 'PERSON_MONTHS', unitAttributeName: null, measurementUnit: 'osobo-měsíc', dataSourceName: null }
              if (calculationMethod === 'FIXED_PER_UNIT') return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: 'ks', dataSourceName: null }
              if (calculationMethod === 'EQUAL_SPLIT') return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: 'ks', dataSourceName: null }
              if (calculationMethod === 'OWNERSHIP_SHARE') return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'VLASTNICKY_PODIL', measurementUnit: '%', dataSourceName: null }

              return { dataSourceType: null, unitAttributeName: null, measurementUnit: null, dataSourceName: null }
            })()

            if (!service) {
              const baseCode = serviceName.substring(0, 10).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'SERVICE'
              let created: Service | null = null
              for (let attempt = 0; attempt < 15 && !created; attempt++) {
                const candidate = attempt === 0 ? baseCode : `${baseCode}_${attempt}`
                try {
                  created = await prisma.service.create({
                    data: {
                      buildingId: building.id, name: serviceName, code: candidate, methodology: calculationMethod as CalculationMethod,
                      dataSourceType: (src.dataSourceType as DataSourceType) ?? undefined, 
                      dataSourceName: src.dataSourceName ?? undefined,
                      unitAttributeName: src.unitAttributeName ?? undefined,
                      measurementUnit: src.measurementUnit ?? undefined, 
                      advancePaymentColumn: advanceColRaw || null,
                      isActive: true, order: summary.services.total
                    }
                  })
                  service = created
                  serviceMap.set(serviceKey(serviceName), service)
                } catch (e) { if (e instanceof Error && e.message.includes('Unique constraint failed')) continue; throw e; }
              }
              if (!service) throw new Error(`Nepodařilo se vytvořit službu '${serviceName}'`)
              summary.services.created++
            } else {
              // EXISTUJÍCÍ SLUŽBA - ZACHOVAT uživatelské nastavení!
              // Aktualizujeme pouze název (pokud se změnil) a metodiku pouze pokud je NO_BILLING
              const shouldUpdateMethodology = service.methodology === 'NO_BILLING'
              const updateData: Record<string, unknown> = {
                name: serviceName,
                advancePaymentColumn: advanceColRaw || service.advancePaymentColumn || null
              }
              
              // Pouze pokud služba nemá nastavenou metodiku (NO_BILLING), nastavíme ji z importu
              if (shouldUpdateMethodology) {
                updateData.methodology = calculationMethod as CalculationMethod
                updateData.dataSourceType = (src.dataSourceType as DataSourceType) ?? undefined
                updateData.dataSourceName = src.dataSourceName ?? undefined
                updateData.unitAttributeName = src.unitAttributeName ?? undefined
                updateData.measurementUnit = src.measurementUnit ?? undefined
                await log(`[Faktury] AKTUALIZUJI metodiku služby "${serviceName}": ${service.methodology} → ${calculationMethod}`)
              } else {
                await log(`[Faktury] Služba "${serviceName}" ponechána s metodikou ${service.methodology} (zachováno uživatelské nastavení)`)
              }
              
              service = await prisma.service.update({
                where: { id: service.id },
                data: updateData
              })
              // Aktualizuj cache s novým názvem
              serviceMap.set(serviceKey(serviceName), service)
              summary.services.existing++
            }
            summary.services.total++

            if (amount !== 0) {
              if (i < 15) await log(`[COST PUSH ${i}] Přidávám náklad: ${serviceName} = ${amount} Kč`)
              costsToCreate.push({
                buildingId: building.id, 
                serviceId: service.id, 
                amount, 
                description: `Import z Excelu - ${serviceName}`,
                invoiceDate: new Date(`${billingPeriod}-12-31`), 
                period: parseInt(billingPeriod)
              })
            }
          }

          if (costsToCreate.length > 0) {
            await log(`[Faktury SAVE] Ukládám ${costsToCreate.length} nákladů do databáze`)
            await prisma.cost.createMany({ data: costsToCreate })
            summary.costs.created += costsToCreate.length
            summary.costs.total += costsToCreate.length
            await log(`[Faktury OK] Vytvořeno ${costsToCreate.length} nákladů.`)
          } else {
            await log(`[Faktury EMPTY] Žádné náklady k uložení (costsToCreate je prázdné)`)
          }
        }

      // 4. IMPORT ODEČTŮ
      await send({ type: 'progress', percentage: 60, step: 'Importuji odečty měřidel...' })
      
      // Cache meters
      const dbMeters = await prisma.meter.findMany({ 
        where: { unit: { buildingId: building.id } },
        include: { service: true }
      })
      const meterMap = new Map<string, Meter>()
      dbMeters.forEach(m => meterMap.set(`${m.unitId}-${m.serialNumber}`, m))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const readingsToCreate: any[] = []

      // unitMap je již inicializována nahoře
      for (const sheetName of workbook.SheetNames) {
        const normalizedSheetName = sheetName.toLowerCase().trim()
        const meterType = SHEET_TO_METER_TYPE[normalizedSheetName]
        if (!meterType) continue

        const sheet = workbook.Sheets[sheetName]
        const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => row.some((cell: unknown) => {
          const s = String(cell).toLowerCase()
          return s.includes('byt') || s.includes('jednotka') || s.includes('m³') || s.includes('kwh')
        }))

        if (headerRowIndex === -1) continue

        const dataRows = rawData.slice(headerRowIndex + 1)
        await log(`[${sheetName}] Zpracovávám ${dataRows.length} řádků odečtů`)

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[0]) continue
          const rawUnitNumber = String(row[0] || '').trim()
          const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
          
          const ownerName = String(row[1] || '').trim()
          const serialNumber = String(row[5] || '').trim()
          const startValue = parseNumberCell(String(row[6] || '')) ?? 0
          const endValue = parseNumberCell(String(row[7] || '')) ?? 0
          let consumption = parseNumberCell(String(row[8] || '')) ?? (endValue > startValue ? endValue - startValue : 0)
          const cost = parseNumberCell(String(row[9] || ''))
          const externalId = String(row[11] || '').trim()
          
          if (consumption === 0 && endValue > startValue) consumption = endValue - startValue
          if (!rawUnitNumber || rawUnitNumber === 'Bazén' || rawUnitNumber.toLowerCase().includes('celkem')) continue
          if (consumption <= 0) continue

          const unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
          
          if (!unit) {
             // Pokud jednotka není v mapě, zkusíme ji najít v DB (pro jistotu, kdyby byla vytvořena v jiném kroku a nepřidána do mapy)
             // Ale my jsme načetli všechny na začátku. Pokud tu není, tak neexistuje.
             // Ale v kroku 2 (Evidence) jsme mohli vytvořit nové jednotky a přidat je do mapy.
             // Musíme zajistit, že krok 2 přidává do mapy. (To jsem zatím neupravil, ale předpokládám, že to tam je nebo to upravím).
             // V původním kódu se unitMap plnila v kroku 2.
             // Pokud jsem krok 2 ještě neupravil, tak tam ta logika je.
             // Ale já jsem krok 2 přeskočil v editaci.
             // Takže unitMap by měla být naplněná.
             
             summary.warnings.push(`Odečty: Jednotka '${rawUnitNumber}' nebyla nalezena v evidenci.`)
             continue
          }

          // Service lookup/create
          // Zkusíme najít službu v cache (serviceMap z kroku 3, nebo dbServices)
          // Musíme zajistit, že serviceMap je dostupná. V kroku 3 jsem ji definoval lokálně.
          // Takže ji musíme definovat znovu nebo globálněji.
          
          // Zkusíme najít službu podle kódu
          let service: Service | null | undefined = undefined
          
          // Hledání v DB (protože serviceMap z kroku 3 je lokální)
          // Můžeme si udělat lokální cache pro tento blok
          
          service = await prisma.service.findUnique({ 
            where: { buildingId_code: { buildingId: building.id, code: meterType } } 
          })

          if (!service) {
             // Fallback by name
             service = await prisma.service.findFirst({ 
               where: { buildingId: building.id, name: METER_TYPE_LABELS[meterType] } 
             })
             
             if (service && service.code !== meterType) {
                // Fix code if possible
                try {
                   service = await prisma.service.update({ where: { id: service.id }, data: { code: meterType } })
                } catch {}
             }
          }

          if (!service) {
            try {
              service = await prisma.service.create({
                data: { buildingId: building.id, name: METER_TYPE_LABELS[meterType], code: meterType, methodology: 'METER_READING', measurementUnit: meterType === 'HEATING' ? 'kWh' : 'm³', isActive: true }
              })
              summary.services.created++
            } catch {
               // Race condition fallback
               service = await prisma.service.findFirst({ where: { buildingId: building.id, code: meterType } })
            }
          }
          
          if (!service) continue // Should not happen

          const effectiveSerial = serialNumber || `${rawUnitNumber}-${meterType}`
          const meterKey = `${unit.id}-${effectiveSerial}`
          let meter = meterMap.get(meterKey)

          if (!meter) {
             meter = await prisma.meter.create({
                data: {
                   unitId: unit.id,
                   serialNumber: effectiveSerial,
                   type: meterType as MeterType,
                   initialReading: startValue,
                   serviceId: service.id,
                   isActive: true,
                   installedAt: new Date(`${billingPeriod}-01-01`)
                }
             })
             meterMap.set(meterKey, meter)
          } else {
             // Update meter type if needed?
             if (meter.type !== meterType) {
                await prisma.meter.update({ where: { id: meter.id }, data: { type: meterType as MeterType } })
             }
          }

          readingsToCreate.push({
            meterId: meter.id, 
            period: parseInt(billingPeriod, 10), 
            readingDate: new Date(`${billingPeriod}-12-31`), 
            dateStart: new Date(`${billingPeriod}-01-01`),
            dateEnd: new Date(`${billingPeriod}-12-31`),
            value: endValue, 
            startValue, 
            endValue, 
            consumption, 
            precalculatedCost: cost ?? null,
            note: externalId || `Import z ${sheetName} - ${ownerName}` 
          })
        }
      }

      if (readingsToCreate.length > 0) {
         await prisma.meterReading.createMany({ data: readingsToCreate })
         summary.readings.created += readingsToCreate.length
         summary.readings.total += readingsToCreate.length
         await log(`[Odečty] Vytvořeno ${readingsToCreate.length} odečtů.`)
      }

      // 5. IMPORT PLATEB
      await send({ type: 'progress', percentage: 80, step: 'Importuji platby...' })
      
      const paymentsSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('úhrad') || name.toLowerCase().includes('uhrad') || name.toLowerCase().includes('platb')
      )

      if (paymentsSheetName) {
        const paymentsSheet = workbook.Sheets[paymentsSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(paymentsSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => row.some((cell: unknown) => String(cell).toLowerCase().includes('měsíc') || String(cell) === '01'))

        if (headerRowIndex !== -1) {
          const dataRows = rawData.slice(headerRowIndex + 1)
          await log(`[${paymentsSheetName}] Zpracovávám ${dataRows.length} řádků plateb`)
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const paymentsToCreate: any[] = []

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0 || !row[0]) continue
            const rawUnitNumber = String(row[0] || '').trim()
            const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
            
            if (!rawUnitNumber || rawUnitNumber === 'Bazén' || rawUnitNumber.toLowerCase().includes('celkem')) continue

            let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
            
            if (!unit) {
               // Fallback if not in map (should be rare if Evidence was processed)
               const foundUnit = await prisma.unit.findFirst({ 
                where: { 
                  buildingId: building.id, 
                  OR: [
                    { unitNumber: rawUnitNumber },
                    { unitNumber: strippedUnitNumber }
                  ]
                } 
              })
               
              if (!foundUnit) {
                summary.warnings.push(`Platby: Jednotka '${rawUnitNumber}' nebyla nalezena v evidenci.`)
                continue
              } else {
                unit = { id: foundUnit.id, variableSymbol: foundUnit.variableSymbol || undefined }
                unitMap.set(rawUnitNumber, unit)
                unitMap.set(strippedUnitNumber, unit)
                summary.units.existing++
              }
            }

            for (let month = 1; month <= 12; month++) {
              const amountStr = String(row[month] || '0').trim()
              const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
              if (isNaN(amount) || amount === 0) continue

              const paymentDate = new Date(parseInt(billingPeriod), month - 1, 15)
              const unitLite = unit as UnitLite
              // Použijeme VS z jednotky, nebo vygenerujeme z čísla (pokud je to číslo)
              const vs = unitLite.variableSymbol || strippedUnitNumber.replace(/[^0-9]/g, '') || `U${unitLite.id.slice(-6)}`
              
              paymentsToCreate.push({
                unitId: unitLite.id, 
                amount, 
                paymentDate, 
                variableSymbol: vs, 
                period: parseInt(billingPeriod), 
                description: `Úhrada záloh ${month.toString().padStart(2, '0')}/${billingPeriod}` 
              })
            }
          }

          if (paymentsToCreate.length > 0) {
             await prisma.payment.createMany({ data: paymentsToCreate })
             summary.payments.created += paymentsToCreate.length
             summary.payments.total += paymentsToCreate.length
             await log(`[Platby] Vytvořeno ${paymentsToCreate.length} plateb.`)
          }
        }
      }

      // 6. IMPORT OSOB
      await send({ type: 'progress', percentage: 90, step: 'Importuji počty osob...' })
      
      if (evidenceSheetName) {
        const evidenceSheet = workbook.Sheets[evidenceSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(evidenceSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => row.some((cell: unknown) => String(cell).toLowerCase().includes('jednotka')))

        if (headerRowIndex !== -1) {
          const dataRows = rawData.slice(headerRowIndex + 1)
          let personMonthsCreated = 0
          
          const personCountIdx = 13 // sloupec N
          const evidenceFromIdx = 14 // sloupec O
          const evidenceToIdx = 15   // sloupec P

          const parseEvidenceDate = (value: unknown): Date | null => {
            if (!value && value !== 0) return null
            if (value instanceof Date) return value
            if (typeof value === 'number') {
              const excelEpoch = new Date(1900, 0, 1)
              return new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
            }
            const str = String(value).trim()
            if (!str) return null
            const parsed = new Date(str)
            return Number.isNaN(parsed.getTime()) ? null : parsed
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const personMonthsToCreate: any[] = []

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0 || !row[0]) continue
            const rawUnitNumber = String(row[0] || '').trim()
            const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
            const personCount = parseInt(String(row[personCountIdx] || '0')) || 0
            if (!rawUnitNumber || personCount === 0) continue

            let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
            
            if (!unit) {
              const found = await prisma.unit.findFirst({ 
                where: { 
                  buildingId: building.id, 
                  OR: [
                    { unitNumber: rawUnitNumber },
                    { unitNumber: strippedUnitNumber }
                  ]
                } 
              })
              if (found) { 
                unit = { id: found.id }
                unitMap.set(rawUnitNumber, unit)
                unitMap.set(strippedUnitNumber, unit)
              }
            }
            if (!unit) continue

            // Update unit residents (current state)
            await prisma.unit.update({ where: { id: (unit as UnitLite).id }, data: { residents: personCount } })

            const billingYear = parseInt(billingPeriod, 10)
            const yearStartBoundary = new Date(billingYear, 0, 1)
            const yearEndBoundary = new Date(billingYear, 11, 31)

            let startDate = parseEvidenceDate(row[evidenceFromIdx]) || yearStartBoundary
            let endDate = parseEvidenceDate(row[evidenceToIdx]) || yearEndBoundary

            if (startDate < yearStartBoundary) startDate = new Date(yearStartBoundary)
            if (endDate > yearEndBoundary) endDate = new Date(yearEndBoundary)
            if (startDate > endDate) continue

            const currentDate = new Date(startDate)
            while (currentDate <= endDate) {
              const year = currentDate.getFullYear()
              const month = currentDate.getMonth() + 1
              
              personMonthsToCreate.push({
                unitId: (unit as UnitLite).id,
                year,
                month,
                personCount
              })
              
              personMonthsCreated++
              currentDate.setMonth(currentDate.getMonth() + 1)
            }
          }
          
          if (personMonthsToCreate.length > 0) {
             await prisma.personMonth.createMany({ data: personMonthsToCreate })
             await log(`[Evidence - Osoby] Vytvořeno ${personMonthsCreated} záznamů osobo-měsíců`)
          }
        }
      }

      // 7. IMPORT PŘEDPISŮ
      await send({ type: 'progress', percentage: 95, step: 'Importuji předpisy záloh...' })
      
      // Rok pro předpisy
      const periodYear = billingPeriodRecord?.year ?? parseInt(billingPeriod, 10)
      
      // --- PRIORITA 1: Zkusíme načíst předpisy z JSON souboru ---
      let jsonPredpisyImported = false
      const jsonFileName = `${billingPeriod}.json` // např. "2024.json"
      const jsonPath = path.join(process.cwd(), 'public', 'import', jsonFileName)
      
      await log(`[Předpis] Hledám JSON soubor: ${jsonPath}`)
      
      const jsonData = await loadJsonPredpisy(jsonPath)
      
      if (jsonData?.predpisy && jsonData.predpisy.length > 0) {
        // KONTROLA: Zkontrolujeme zda JSON odpovídá importované budově
        const jsonMatchesBldg = jsonMatchesBuilding(jsonData, building.name, building.address)
        
        if (!jsonMatchesBldg) {
          const jsonBuildingInfo = jsonData.house_info?.nazev || jsonData.vstupni_data?.adresa || 'neznámá'
          await log(`[Předpis] ⚠️ JSON soubor je pro jinou budovu (${jsonBuildingInfo}), přeskakuji JSON import`)
          await log(`[Předpis] Aktuální budova: ${building.name} (${building.address || 'bez adresy'})`)
        } else {
          await log(`[Předpis] ✓ JSON soubor odpovídá budově ${building.name}`)
        
        await log(`[Předpis] Nalezen JSON soubor s ${jsonData.predpisy.length} jednotkami`)
        
        // Načteme všechny služby pro budovu
        const allServices = await prisma.service.findMany({ where: { buildingId: building.id } })
        await log(`[Předpis] Nalezeno ${allServices.length} služeb v DB`)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const advancesToCreate: any[] = []
        let matchedServices = 0
        let unmatchedKeys: string[] = []
        
        for (const predpis of jsonData.predpisy) {
          // Najdeme jednotku podle oznaceni (např. "Byt č. 1513/01")
          const unitOznaceni = predpis.oznaceni
          const strippedOznaceni = stripUnitPrefixes(unitOznaceni)
          const unit = unitMap.get(unitOznaceni) || unitMap.get(strippedOznaceni)
          
          if (!unit) {
            await log(`[Předpis JSON] Jednotka nenalezena: "${unitOznaceni}"`)
            continue
          }
          
          // Procházíme všechny klíče v predpisu (kromě oznaceni a uzivatel)
          for (const [key, value] of Object.entries(predpis)) {
            if (key === 'oznaceni' || key === 'uzivatel') continue
            if (typeof value !== 'object' || value === null) continue
            
            // value je Record<string, number> s měsíci jako klíči
            const monthlyData = value as Record<string, number>
            
            // Najdeme službu podle klíče
            const service = findServiceByPredpisKey(allServices, key)
            if (!service) {
              if (!unmatchedKeys.includes(key)) {
                unmatchedKeys.push(key)
              }
              continue
            }
            
            matchedServices++
            
            // Přidáme zálohy pro každý měsíc
            for (const [monthStr, amount] of Object.entries(monthlyData)) {
              const month = parseInt(monthStr, 10)
              if (isNaN(month) || month < 1 || month > 12) continue
              if (amount <= 0) continue
              
              advancesToCreate.push({
                unitId: unit.id,
                serviceId: service.id,
                year: periodYear,
                month: month,
                amount: amount
              })
            }
          }
        }
        
        if (unmatchedKeys.length > 0) {
          await log(`[Předpis JSON] Nenalezené služby pro klíče: ${unmatchedKeys.join(', ')}`)
        }
        
        if (advancesToCreate.length > 0) {
          // Smažeme staré zálohy pro tuto budovu a období
          await prisma.advanceMonthly.deleteMany({
            where: {
              unit: { buildingId: building.id },
              year: periodYear
            }
          })
          
          await prisma.advanceMonthly.createMany({
            data: advancesToCreate
          })
          
          summary.advances = { created: advancesToCreate.length, updated: 0, total: advancesToCreate.length }
          await log(`[Předpis JSON] Úspěšně importováno ${advancesToCreate.length} záznamů záloh z JSON (${matchedServices} mapování služeb)`)
          jsonPredpisyImported = true
        } else {
          await log(`[Předpis JSON] Žádné zálohy k importu z JSON`)
        }
        } // konec else (jsonMatchesBldg)
      } else {
        await log(`[Předpis] JSON soubor nenalezen nebo neobsahuje předpisy, používám Excel`)
      }
      
      // --- FALLBACK: Excel import (pouze pokud JSON nebylo úspěšné) ---
      if (!jsonPredpisyImported) {
      
      let advancesSheetName = workbook.SheetNames.find(name => {
        const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
        return n === 'předpis po mesici' || n === 'predpis po mesici'
      })

      if (!advancesSheetName) {
         advancesSheetName = workbook.SheetNames.find(name => {
            const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
            return n.includes('zálohy') || n.includes('zalohy')
         })
      }


      if (advancesSheetName) {
        await log(`[Předpis] Začínám zpracování listu "${advancesSheetName}"...`)

        try {
          const advancesSheet = workbook.Sheets[advancesSheetName]
          const rawData = utils.sheet_to_json<unknown[]>(advancesSheet, { header: 1, defval: null })
          
          // Zkusíme najít řádek s hlavičkou (očekáváme "Celkem" nebo měsíce)
          let monthHeaderRow = rawData[1] as unknown[] | undefined
          
          // Pokud řádek 1 neobsahuje "Celkem", zkusíme řádek 0
          if (!monthHeaderRow || !monthHeaderRow.some(c => String(c).toLowerCase().includes('celkem') || String(c).toLowerCase().includes('součet'))) {
             const row0 = rawData[0] as unknown[] | undefined
             if (row0 && row0.some(c => String(c).toLowerCase().includes('celkem') || String(c).toLowerCase().includes('součet'))) {
                monthHeaderRow = row0
             }
          }

          const normalizeAdvanceColumnIndex = (colIndex: number) => {
            if (!monthHeaderRow || colIndex < 0) return colIndex
            const headerCell = String(monthHeaderRow[colIndex] ?? '').trim().toLowerCase()
            if (!headerCell) return colIndex
            const isTotalColumn = headerCell.includes('celkem') || headerCell.includes('součet') || headerCell.includes('suma')
            if (!isTotalColumn) return colIndex

            let looksLikeMonthBlock = true
            for (let offset = 1; offset <= 12; offset++) {
              const headerVal = String(monthHeaderRow[colIndex - offset] ?? '').trim().replace(/\.$/, '')
              const valNum = parseInt(headerVal, 10)
              if (isNaN(valNum) || valNum !== 13 - offset) {
                looksLikeMonthBlock = false
                break
              }
            }
            if (looksLikeMonthBlock) {
              const normalized = colIndex - 12
              return normalized >= 0 ? normalized : 0
            }
            return colIndex
          }
          
          const serviceMapping: { serviceId: string, colIndex: number, serviceName: string }[] = []
          
          // --- NOVÁ LOGIKA 0: Mapování přímo z hlavičky listu "Předpis po měsíci" (řádek 1) ---
          // V řádku 1 jsou názvy služeb (např. "Vodné a stočné", "Teplo") přímo ve sloupcích
          // kde jsou i data záloh. Sloupce mají strukturu: 12 měsíců + celkem.
          {
            const headerRow = rawData[0] as unknown[] | undefined
            if (headerRow && headerRow.length > 0) {
              const services = await prisma.service.findMany({ where: { buildingId: building.id } })
              const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ')
              
              await log(`[Předpis] Hledám názvy služeb v řádku 1 listu "${advancesSheetName}"...`)
              
              for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
                const cellValue = String(headerRow[colIdx] ?? '').trim()
                if (!cellValue || cellValue.length < 3) continue
                
                // Přeskočíme buňky které vypadají jako čísla měsíců nebo "celkem"
                if (/^\d+$/.test(cellValue)) continue
                if (/^(celkem|součet|suma|měsíc|mesic|seznam)$/i.test(cellValue)) continue
                
                // Hledáme službu s odpovídajícím názvem
                const normalizedCell = normalize(cellValue)
                let matchedService = services.find(s => normalize(s.name) === normalizedCell)
                
                // Fuzzy matching - pokud není přesná shoda
                if (!matchedService) {
                  matchedService = services.find(s => {
                    const sName = normalize(s.name)
                    return sName.includes(normalizedCell) || normalizedCell.includes(sName)
                  })
                }
                
                if (matchedService) {
                  // Najdeme sloupec s "celkem" pro tuto službu (obvykle 13 sloupců doprava)
                  // nebo použijeme přímo tento sloupec jako začátek bloku měsíců
                  const colLetter = utils.encode_col(colIdx)
                  
                  // Zkontrolujeme, jestli už nemáme mapování pro tuto službu
                  const existingMapping = serviceMapping.find(m => m.serviceId === matchedService!.id)
                  if (!existingMapping) {
                    serviceMapping.push({ 
                      serviceId: matchedService.id, 
                      colIndex: colIdx, 
                      serviceName: matchedService.name 
                    })
                    await log(`[Předpis] Mapování z hlavičky: "${cellValue}" -> služba "${matchedService.name}" (sloupec ${colLetter}, index ${colIdx})`)
                    
                    // Aktualizujeme službu v DB s advancePaymentColumn
                    await prisma.service.update({
                      where: { id: matchedService.id },
                      data: { advancePaymentColumn: colLetter }
                    })
                  }
                }
              }
              
              await log(`[Předpis] Nalezeno ${serviceMapping.length} služeb z hlavičky listu.`)
            }
          }
          
          // --- NOVÁ LOGIKA 1: Mapování přes "Vstupní data" (fallback) ---
          const inputSheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('vstupní') || name.toLowerCase().includes('vstupni') || name.toLowerCase().includes('input')
          )
          
          if (serviceMapping.length === 0 && inputSheetName) {
             const inputSheet = workbook.Sheets[inputSheetName]
             const inputData = utils.sheet_to_json<unknown[]>(inputSheet, { header: 1, defval: '' })
             
             // Očekáváme:
             // Řádek 31 (index 30): Názvy služeb
             // Řádek 30 (index 29): Odkaz na sloupec v "Předpis po měsíci" (např. "JC", "AB")
             

             if (inputData.length > 30) {
                const nameRow = inputData[30] as string[] // Row 31
                const refRow = inputData[29] as string[]  // Row 30
                
                const services = await prisma.service.findMany({ where: { buildingId: building.id } })
                const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ')
                
                // Procházíme sloupce S (index 18) až AN (index 39), ale raději dynamicky dál
                const startCol = 18 // S
                const endCol = Math.min(nameRow.length, 100) // Rozumný limit
                
                for (let c = startCol; c < endCol; c++) {
                   const serviceName = String(nameRow[c] || '').trim()
                   const colRef = String(refRow[c] || '').trim()
                   

                   if (serviceName && colRef) {
                      // Najít službu
                      let service = services.find(s => normalize(s.name) === normalize(serviceName))
                      
                      if (!service) {
                         if (normalize(serviceName).includes('ohrev') && normalize(serviceName).includes('vod')) {
                            service = services.find(s => normalize(s.name).includes('ohrev') && normalize(s.name).includes('vod'))
                         }
                      }
                      
                      if (service) {
                         // Extrahovat písmeno sloupce z reference (např. "JC" z "JC" nebo "JC:JN")
                         const startColLetter = colRef.split(':')[0].replace(/[^A-Z]/g, '')
                     if (startColLetter) {
                       try {
                         const decodedIndex = utils.decode_col(startColLetter)
                         const colIndex = normalizeAdvanceColumnIndex(decodedIndex)
                         serviceMapping.push({ serviceId: service.id, colIndex, serviceName })
                         await log(`[Předpis] Mapování (Vstupní data): ${serviceName} -> Sloupec ${startColLetter} (index ${colIndex})`)
                       } catch {
                               await log(`[Předpis] Chyba při dekódování sloupce '${startColLetter}' pro službu ${serviceName}`)
                            }
                         }
                      }
                   }
             }
          }
          }
          // --- NOVÁ LOGIKA 2: Mapování z definice služeb (sloupec M ve Fakturách) ---
          // Toto má přednost nebo doplňuje mapování z Vstupních dat
          const servicesWithAdvanceCol = await prisma.service.findMany({
             where: { buildingId: building.id, advancePaymentColumn: { not: null } }
          })
          
          if (servicesWithAdvanceCol.length > 0) {
             await log(`[Předpis] Nalezeno ${servicesWithAdvanceCol.length} služeb s definovaným sloupcem záloh (z Faktur).`)
             
             for (const s of servicesWithAdvanceCol) {
                if (s.advancePaymentColumn) {
                   try {
                      // Očekáváme formát "BN" nebo "N"
                      // utils.decode_col("A") = 0
                      let colIndex = -1
                      // Pokud je to číslo (např. "12"), použijeme ho přímo
                      if (/^\d+$/.test(s.advancePaymentColumn)) {
                        colIndex = parseInt(s.advancePaymentColumn, 10)
                      } else {
                                               // Jinak dekódujeme písmeno (např. "M" -> 12)
                        colIndex = utils.decode_col(s.advancePaymentColumn)
                      }
                      colIndex = normalizeAdvanceColumnIndex(colIndex)
                      
                      if (colIndex >= 0) {
                        const existing = serviceMapping.find(m => m.serviceId === s.id)
                        if (existing) {
                           existing.colIndex = colIndex
                           await log(`[Předpis] Aktualizuji mapování pro ${s.name}: ${s.advancePaymentColumn} -> index ${colIndex}`)
                        } else {
                           serviceMapping.push({ serviceId: s.id, colIndex, serviceName: s.name })
                           await log(`[Předpis] Přidávám mapování pro ${s.name}: ${s.advancePaymentColumn} -> index ${colIndex}`)
                        }
                      }
                   } catch {
                      await log(`[Předpis] Chyba dekódování sloupce '${s.advancePaymentColumn}' pro službu ${s.name}`)
                   }
                }
             }
          }

          if (serviceMapping.length > 0) {
             // POUŽITÍ NOVÉHO MAPOVÁNÍ S BULK INSERTEM
             await log(`[Předpis] Používám mapování z listu "Vstupní data" (${serviceMapping.length} služeb)`)
             
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const advancesToCreate: any[] = []
             const serviceIds = new Set<string>()
             serviceMapping.forEach(m => serviceIds.add(m.serviceId))

             // Iterujeme přes řádky Excelu jen jednou
             for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
                const row = rawData[rowIndex] as unknown[]
                if (!row || row.length === 0) continue
                
                const cellValue = String(row[0] ?? '').trim()
                if (!cellValue) continue

                const stripped = stripUnitPrefixes(cellValue)
                const unit = unitMap.get(cellValue) || unitMap.get(stripped)
                
                if (!unit) continue

                for (const mapping of serviceMapping) {
                   for (let month = 1; month <= 12; month++) {
                      const monthColIndex = mapping.colIndex + (month - 1)
                      let amount = 0
                      if (monthColIndex < row.length) {
                         amount = parseFloat(String(row[monthColIndex] ?? '').replace(',', '.').replace(/\s/g, '')) || 0
                      }

                      if (amount > 0) {
                         advancesToCreate.push({
                            unitId: unit.id,
                            serviceId: mapping.serviceId,
                            year: periodYear,
                            month: month,
                            amount: amount
                         })
                      }
                   }
                }
             }

             // Hromadné vložení (mazání již proběhlo globálně)
             if (advancesToCreate.length > 0) {
                await prisma.advanceMonthly.createMany({
                   data: advancesToCreate
                })
                summary.advances = { created: advancesToCreate.length, updated: 0, total: advancesToCreate.length }
                await log(`[Předpis] Hromadně vloženo ${advancesToCreate.length} záznamů záloh.`)
             }

          } else {
          // --- STARÁ LOGIKA (FALLBACK) ---
          const fakturySheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'faktury')
          
          // Zkusíme najít názvy služeb přímo v hlavičce listu "Předpis po mesici"
          const headerRow = rawData[0] as string[]
          const serviceColumnsFromHeader: { colIndex: number, name: string }[] = []
          
          if (headerRow && headerRow.length > 0) {
             for (let i = 0; i < headerRow.length; i++) {
                const val = String(headerRow[i] || '').trim()
                if (val && val.length > 2 && !val.match(/^\d+$/)) { // Ignorovat čísla a prázdné
                   serviceColumnsFromHeader.push({ colIndex: i, name: val })
                }
             }
          }

          if (serviceColumnsFromHeader.length > 0) {
             await log(`[Předpis] Nalezeno ${serviceColumnsFromHeader.length} služeb v hlavičce: ${serviceColumnsFromHeader.map(s => s.name).join(', ')}`)
             
             const services = await prisma.service.findMany({ where: { buildingId: building.id } })
             const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
             summary.advances = { created: 0, updated: 0, total: 0 }
             
             const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
             
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const advancesToCreate: any[] = []

             for (const colInfo of serviceColumnsFromHeader) {
                const normalizedHeaderName = normalize(colInfo.name)
                // Zkusíme najít službu
                let service = services.find(s => normalize(s.name) === normalizedHeaderName)
                
                // Fuzzy match pro "Ohřev teplé vody" vs "Ohřev TUV" atd.
                if (!service) {
                   if (normalizedHeaderName.includes('ohrev') && normalizedHeaderName.includes('vod')) {
                      service = services.find(s => normalize(s.name).includes('ohrev') && normalize(s.name).includes('vod'))
                   }
                }

                if (!service) {
                   await log(`[Předpis] Varování: Služba '${colInfo.name}' z hlavičky nebyla nalezena v DB.`)
                   continue
                }

                // Zkusíme ověřit, zda pod tím jsou čísla 1..12
                const subHeaderRow = rawData[1] as unknown[]
                let startMonthColIndex = colInfo.colIndex
                
                // Hledáme "1" v okolí
                if (String(subHeaderRow[colInfo.colIndex]).trim() !== '1') {
                   // Zkusíme najít '1' v následujících pár sloupcích
                   for(let k=0; k<5; k++) {
                      if (String(subHeaderRow[colInfo.colIndex + k]).trim() === '1') {
                         startMonthColIndex = colInfo.colIndex + k
                         break
                      }
                   }
                }

                for (const unit of units) {
                   const stripped = stripUnitPrefixes(unit.unitNumber)
                   const possibleNames = [unit.unitNumber, stripped, `Jednotka č. ${stripped}`, `Bazén č. ${stripped}`, `Byt č. ${stripped}`]
                   
                   let unitRow = null
                   for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
                      const cellValue = String(rawData[rowIndex]?.[0] ?? '').trim()
                      if (possibleNames.some(pn => normalize(cellValue) === normalize(pn))) {
                         unitRow = rawData[rowIndex]
                         break
                      }
                   }
                   
                   if (!unitRow) continue

                   for (let month = 1; month <= 12; month++) {
                      const monthColIndex = startMonthColIndex + (month - 1)
                      let amount = 0
                      if (monthColIndex < unitRow.length) {
                         amount = parseFloat(String(unitRow[monthColIndex] ?? '').replace(',', '.').replace(/\s/g, '')) || 0
                      }

                      if (amount > 0) {
                         advancesToCreate.push({
                            unitId: unit.id,
                            serviceId: service.id,
                            year: periodYear,
                            month,
                            amount
                         })
                      }
                   }
                }
             }
             
             if (advancesToCreate.length > 0) {
                await prisma.advanceMonthly.createMany({ data: advancesToCreate })
                summary.advances.created += advancesToCreate.length
                summary.advances.total += advancesToCreate.length
             }

          } else if (fakturySheetName && periodYear) {
            // FALLBACK na starou logiku, pokud se nepodaří najít hlavičky
            const fakturySheet = workbook.Sheets[fakturySheetName]
            const fakturyData = utils.sheet_to_json<unknown[]>(fakturySheet, { header: 1, defval: null })
            const serviceNamesFromFaktury: string[] = []
            for (let i = 3; i < Math.min(fakturyData.length, 20); i++) {
              const serviceName = String(fakturyData[i]?.[0] ?? '').trim()
              if (serviceName) serviceNamesFromFaktury.push(serviceName)
            }

            const services = await prisma.service.findMany({ where: { buildingId: building.id } })
            const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
            summary.advances = { created: 0, updated: 0, total: 0 }

            const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
            const serviceNameMap = new Map<string, { id: string; name: string }>()
            services.forEach(s => serviceNameMap.set(normalize(s.name), { id: s.id, name: s.name }))

            const celkemColumns: number[] = []
            const maxServices = Math.min(serviceNamesFromFaktury.length, 20)
            for (let i = 0; i < maxServices; i++) {
              const celkemCol = 1 + (i * 13) + 12
              if (celkemCol < (rawData[1]?.length || 0)) celkemColumns.push(celkemCol)
            }

            const headerMap: { [key: number]: { serviceId: string; serviceName: string } } = {}
            for (let i = 0; i < celkemColumns.length; i++) {
              if (i >= serviceNamesFromFaktury.length) continue
              const serviceName = serviceNamesFromFaktury[i]
              const foundService = serviceNameMap.get(normalize(serviceName))
              if (foundService) headerMap[celkemColumns[i]] = { serviceId: foundService.id, serviceName: foundService.name }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const advancesToCreate: any[] = []

            for (const unit of units) {
              const stripped = stripUnitPrefixes(unit.unitNumber)
              const possibleNames = [
                unit.unitNumber,
                stripped,
                `Jednotka č. ${stripped}`,
                `Bazén č. ${stripped}`,
                `Byt č. ${stripped}`
              ]
              let unitRow = null
              for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
                const cellValue = String(rawData[rowIndex]?.[0] ?? '').trim()
                if (possibleNames.some(pn => normalize(cellValue) === normalize(pn))) {
                  unitRow = rawData[rowIndex]
                  break
                }
              }
              
              if (!unitRow) continue

              for (const colIndexStr of Object.keys(headerMap)) {
                const celkemColIndex = Number(colIndexStr)
                const mapping = headerMap[celkemColIndex]
                
                for (let month = 1; month <= 12; month++) {
                  const monthOffset = 13 - month
                  const monthColIndex = celkemColIndex - monthOffset
                  
                  let amount = 0
                  if (monthColIndex >= 0 && monthColIndex < unitRow.length) {
                    amount = parseFloat(String(unitRow[monthColIndex] ?? '').replace(',', '.').replace(/\s/g, '')) || 0
                  }

                  if (amount > 0) {
                    advancesToCreate.push({
                      unitId: unit.id,
                      serviceId: mapping.serviceId,
                      year: periodYear,
                      month,
                      amount
                    })
                  }
                }
              }
            }
            
            if (advancesToCreate.length > 0) {
               await prisma.advanceMonthly.createMany({ data: advancesToCreate })
               summary.advances.created += advancesToCreate.length
               summary.advances.total += advancesToCreate.length
            }
          }
          }
          } catch (e) {
          summary.errors.push(`Předpisy: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      
      } // konec if (!jsonPredpisyImported)

      // 7b. IMPORT PŘEDPISŮ (CELKEM - Predpisy_celkem)
      // ZAKÁZÁNO NA ŽÁDOST UŽIVATELE - Celkové zálohy se počítají součtem jednotlivých služeb
      /*
      const advancesTotalSheetName = workbook.SheetNames.find(name => {
        const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
        return n === 'predpisy_celkem' || n === 'předpisy_celkem' || n === 'predpisy celkem' || n === 'předpisy celkem'
      })

      if (advancesTotalSheetName) {
        await log(`[Předpis] Nalezen list "${advancesTotalSheetName}", zpracovávám celkové zálohy...`)
        try {
          const sheet = workbook.Sheets[advancesTotalSheetName]
          const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
          const periodYear = billingPeriodRecord?.year

          if (periodYear) {
            // Najdeme nebo vytvoříme službu "Celková záloha"
            // Nejprve hledáme podle kódu, který je unikátní
            let totalService = await prisma.service.findUnique({
              where: { buildingId_code: { buildingId: building.id, code: 'TOTAL_ADVANCE' } }
            })

            if (!totalService) {
              // Pokud nenajdeme podle kódu, zkusíme podle názvu (pro zpětnou kompatibilitu)
              totalService = await prisma.service.findFirst({
                where: { buildingId: building.id, name: 'Celková záloha' }
              })

              if (totalService) {
                // Pokud najdeme podle názvu, aktualizujeme kód na standardní 'TOTAL_ADVANCE'
                // (víme, že kód 'TOTAL_ADVANCE' je volný, jinak by ho našel první dotaz)
                totalService = await prisma.service.update({
                  where: { id: totalService.id },
                  data: { code: 'TOTAL_ADVANCE' }
                })
              } else {
                // Pokud nenajdeme ani podle názvu, vytvoříme novou službu
                totalService = await prisma.service.create({
                  data: {
                    buildingId: building.id,
                    name: 'Celková záloha',
                    code: 'TOTAL_ADVANCE',
                    methodology: 'OWNERSHIP_SHARE',
                    isActive: true,
                    order: 0
                  }
                })
                summary.services.created++
              }
            }

            // Najdeme indexy sloupců
            // Očekáváme: A=Označení, B=1, C=2 ... M=12, N=Celkem
            // Indexy: 0=Označení, 1=Leden ... 12=Prosinec
            
            // Pro jistotu zkusíme najít hlavičku
            let headerRowIndex = 0
            let month1Index = 1 // Default B
            
            // Zkusíme najít řádek, kde je "1", "2", "3"..."
            for(let r=0; r<Math.min(rawData.length, 10); r++) {
              const row = rawData[r] as unknown[]
              if (row && row.some(c => String(c).trim() === '1') && row.some(c => String(c).trim() === '12')) {
                headerRowIndex = r
                month1Index = row.findIndex(c => String(c).trim() === '1')
                break
              }
            }

            const dataRows = rawData.slice(headerRowIndex + 1)
            await log(`[Předpis] Zpracovávám ${dataRows.length} řádků z listu ${advancesTotalSheetName}`)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const advancesToCreate: any[] = []

            for (const row of dataRows) {
              if (!row || row.length === 0) continue
              const rawUnitNumber = String(row[0] || '').trim()
              if (!rawUnitNumber || rawUnitNumber.toLowerCase() === 'oznaceni' || rawUnitNumber.toLowerCase().includes('celkem')) continue

              const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
              let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)

              if (!unit) {
                const found = await prisma.unit.findFirst({ 
                  where: { 
                    buildingId: building.id, 
                    OR: [
                      { unitNumber: rawUnitNumber },
                      { unitNumber: strippedUnitNumber }
                    ]
                  } 
                })
                if (found) {
                  unit = { id: found.id }
                  unitMap.set(rawUnitNumber, unit)
                  unitMap.set(strippedUnitNumber, unit)
                }
              }

              if (!unit) continue

              for (let month = 1; month <= 12; month++) {
                const colIndex = month1Index + (month - 1)
                let amount = 0
                if (colIndex < row.length) {
                  const val = row[colIndex]
                  if (typeof val === 'number') amount = val
                  else if (typeof val === 'string') amount = parseFloat(val.replace(/\s/g, '').replace(',', '.'))
                }

                if (!isNaN(amount) && amount > 0) {
                   advancesToCreate.push({
                      unitId: (unit as UnitLite).id,
                      serviceId: totalService.id,
                      year: periodYear,
                      month: month,
                      amount: amount
                   })
                }
              }
            }

            // Hromadné smazání a vložení pro celkové zálohy
            await prisma.advanceMonthly.deleteMany({
               where: {
                  unit: { buildingId: building.id },
                  year: periodYear,
                  serviceId: totalService.id
               }
            })
            
            if (advancesToCreate.length > 0) {
               await prisma.advanceMonthly.createMany({
                  data: advancesToCreate
               })
               if (summary.advances) {
                  summary.advances.updated += advancesToCreate.length
                  summary.advances.total += advancesToCreate.length
               }
               await log(`[Předpis] Hromadně vloženo ${advancesToCreate.length} záznamů celkových záloh.`)
            }
          }
        } catch (e) {
          summary.errors.push(`Předpisy (Celkem): ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      */

      // 8. NÁKLADY NA DŮM
      try {
      const costSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('náklady na dům'))
      if (costSheetName) {
        const sheet = workbook.Sheets[costSheetName]
        const rawRows = utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
        const headerIdx = rawRows.findIndex(r => r.some(c => String(c).toLowerCase().includes('položka')))

        if (headerIdx !== -1) {
          const periodYear = parseInt(billingPeriod, 10)
          if (Number.isFinite(periodYear)) {
            const services = await prisma.service.findMany({ where: { buildingId: building.id } })
            let created = 0, updated = 0, skipped = 0
            for (const row of rawRows.slice(headerIdx + 1)) {
              const serviceName = String(row[1] ?? '').trim()
              const amount = parseFloat(String(row[5] ?? '').replace(/\s/g, '').replace(',', '.'))
              if (!serviceName || !Number.isFinite(amount) || amount <= 0) { skipped++; continue }
              const service = services.find(s => s.name.trim() === serviceName)
              if (!service) { skipped++; continue }
              const existing = await prisma.cost.findFirst({ where: { serviceId: service.id, period: periodYear } })
              if (existing) {
                await prisma.cost.update({ where: { id: existing.id }, data: { amount } })
                updated++
              } else {
                await prisma.cost.create({ data: { buildingId: building.id, serviceId: service.id, amount, description: `Import z listu ${costSheetName}`, invoiceDate: new Date(), period: periodYear } })
                created++
              }
            }
            summary.costs = { created, updated, skipped, total: created + updated }
          }
        }
      }

      // 9. IMPORT PARAMETRŮ
      await send({ type: 'progress', percentage: 98, step: 'Importuji parametry jednotek...' })
      
      const paramsSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('parametry') || name.toLowerCase().includes('parameters')
      )

      if (paramsSheetName) {
        const paramsSheet = workbook.Sheets[paramsSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(paramsSheet, { header: 1, defval: '' })
        
        // Find header row (row with "Jednotka" or similar)
        const headerRowIndex = rawData.findIndex(row => row.some((cell: unknown) => {
           const s = String(cell).toLowerCase()
           return s.includes('jednotka') || s.includes('byt')
        }))

        if (headerRowIndex !== -1) {
           const headerRow = rawData[headerRowIndex] as string[]
           const dataRows = rawData.slice(headerRowIndex + 1)
           
           // Identify parameter columns (all columns except the unit column)
           const unitColIndex = headerRow.findIndex(c => String(c).toLowerCase().includes('jednotka') || String(c).toLowerCase().includes('byt'))
           
           if (unitColIndex !== -1) {
              const paramCols = headerRow.map((col, idx) => ({ name: String(col).trim(), index: idx })).filter(c => c.index !== unitColIndex && c.name)
              

              await log(`[Parametry] Nalezeno ${paramCols.length} parametrů: ${paramCols.map(c => c.name).join(', ')}`)

              for (const row of dataRows) {
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 const r = row as any[]
                 const rawUnitNumber = String(r[unitColIndex] || '').trim()
                 const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
                 if (!rawUnitNumber) continue

                 let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
                 
                 if (!unit) {
                    const found = await prisma.unit.findFirst({ 
                      where: { 
                        buildingId: building.id, 
                        OR: [
                          { unitNumber: rawUnitNumber },
                          { unitNumber: strippedUnitNumber }
                        ]
                      } 
                    })
                    if (found) { 
                      unit = { id: found.id }
                      unitMap.set(rawUnitNumber, unit)
                      unitMap.set(strippedUnitNumber, unit)
                    }
                 }
                 if (!unit) continue

                 for (const col of paramCols) {
                    const valStr = String(r[col.index] || '').replace(',', '.').replace(/\s/g, '')
                    const val = parseFloat(valStr)
                    
                    if (!isNaN(val)) {
                       await prisma.unitParameter.upsert({
                          where: { unitId_name: { unitId: (unit as UnitLite).id, name: col.name } },
                          update: { value: val },
                          create: { unitId: (unit as UnitLite).id, name: col.name, value: val }
                       })
                    }
                 }
              }
           }
        }
      }
      } catch (e) {
        summary.errors.push(`Náklady na dům: ${e instanceof Error ? e.message : String(e)}`)
      }

      // 10. AKTUALIZACE POŘADÍ SLUŽEB (dle listu "Vyúčtování byt - 1.část")
      await send({ type: 'progress', percentage: 99, step: 'Aktualizuji pořadí služeb...' })
      
      const sortingSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('vyúčtování byt') || 
        name.toLowerCase().includes('vyuctovani byt') ||
        name.toLowerCase().includes('výsledky')
      )

      if (sortingSheetName) {
         await log(`[Řazení] Načítám pořadí z listu "${sortingSheetName}"`)
         const sheet = workbook.Sheets[sortingSheetName]
         const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
         
         // Hledáme řádek s hlavičkou "Položka" nebo "Služba"
         const headerRowIndex = rawData.findIndex(row => row.some((cell: unknown) => {
            const s = String(cell).toLowerCase()
            return s.includes('položka') || s.includes('polozka') || s.includes('služba') || s.includes('sluzba')
         }))

         if (headerRowIndex !== -1) {
            const services = await prisma.service.findMany({ where: { buildingId: building.id } })
            const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
            
            let orderCounter = 1
            // Procházíme řádky pod hlavičkou
            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
               const row = rawData[i] as unknown[]
               if (!row || row.length === 0) continue
               
               // Předpokládáme, že název služby je v prvním sloupci (index 0)
               const serviceName = String(row[0] || '').trim()
               
               // Ignorujeme prázdné řádky, "Celkem", "Přeplatek" atd.
               if (!serviceName || 
                   serviceName.toLowerCase().includes('celkem') || 
                   serviceName.toLowerCase().includes('přeplatek') ||
                   serviceName.toLowerCase().includes('nedoplatek') ||
                   serviceName.toLowerCase().includes('prázdné') ||
                   serviceName === '0') continue

               const normalizedName = normalize(serviceName)
               
               // Najdeme službu
               const service = services.find(s => normalize(s.name) === normalizedName)
               
               if (service) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const updateData: any = { order: orderCounter++ }

                  // AKTUALIZACE METODIKY (pokud je ve sloupci C - index 2)
                  // ALE POUZE pokud služba nemá uživatelsky nastavené dataSourceColumn nebo dataSourceName
                  const hasUserConfig = service.dataSourceColumn || service.dataSourceName
                  
                  if (row.length > 2 && !hasUserConfig) {
                     const methodRaw = String(row[2] || '').trim()
                     if (methodRaw) {
                        const method = matchMethodFromValue(methodRaw)
                        if (method) {
                           updateData.methodology = method
                           await log(`[Metodika] Služba '${service.name}' -> ${method} (z Excelu: '${methodRaw}')`)

                           // Aktualizace DataSourceType podle metodiky
                           // eslint-disable-next-line @typescript-eslint/no-explicit-any
                           let src: any = { dataSourceType: null, unitAttributeName: null, measurementUnit: null, dataSourceName: null }
                           

                           if (method === 'NO_BILLING') {
                              src = { dataSourceType: 'NONE', unitAttributeName: null, measurementUnit: null, dataSourceName: null }
                           } else if (method === 'METER_READING') {
                              const meterHints = `${methodRaw} ${serviceName}`.toLowerCase()
                              let dsName = 'Měřidla'
                              let measurementUnit = 'jednotek'

                              if (meterHints.includes('vodomer sv') || meterHints.includes('sv voda') || meterHints.includes('studen') || meterHints.includes('pitn') || meterHints.includes('vodne')) {
                                 dsName = 'Vodoměry SV'; measurementUnit = 'm³'
                              } else if (meterHints.includes('vodomer tuv') || meterHints.includes('tuv') || meterHints.includes('tepla voda') || meterHints.includes('ohrev') || meterHints.includes('bojler')) {
                                 dsName = 'Vodoměry TUV'; measurementUnit = 'm³'
                              } else if (meterHints.includes('teplo') || meterHints.includes('vytap') || meterHints.includes('radiator') || meterHints.includes('patni') || meterHints.includes('plyn') || meterHints.includes('externi') || meterHints.includes('kalor')) {
                                 dsName = 'Teplo'; measurementUnit = 'kWh'
                              } else if (meterHints.includes('elektr')) {
                                 dsName = 'Elektroměry'; measurementUnit = 'kWh'
                              }
                              src = { dataSourceType: 'METER_DATA', unitAttributeName: null, measurementUnit, dataSourceName: dsName }
                           } else if (method === 'AREA') {
                              src = { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'CELKOVA_VYMERA', measurementUnit: 'm²', dataSourceName: null }
                           } else if (method === 'PERSON_MONTHS') {
                              src = { dataSourceType: 'PERSON_MONTHS', unitAttributeName: null, measurementUnit: 'osobo-měsíc', dataSourceName: null }
                           } else if (method === 'FIXED_PER_UNIT' || method === 'EQUAL_SPLIT') {
                              src = { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: 'ks', dataSourceName: null }
                           } else if (method === 'OWNERSHIP_SHARE') {
                              src = { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'VLASTNICKY_PODIL', measurementUnit: '%', dataSourceName: null }
                           }

                           if (src.dataSourceType) {
                              updateData.dataSourceType = src.dataSourceType
                              updateData.dataSourceName = src.dataSourceName
                              updateData.unitAttributeName = src.unitAttributeName
                              updateData.measurementUnit = src.measurementUnit
                           }
                        }
                     }
                  } else if (hasUserConfig) {
                     await log(`[Metodika] Služba '${service.name}' má uživatelské nastavení - ponecháno`)
                  }

                  await prisma.service.update({
                     where: { id: service.id },
                     data: updateData
                  })
                  await log(`[Řazení] Služba '${service.name}' nastavena na pozici ${orderCounter - 1}`)
               } else {
                  await log(`[Řazení] Služba '${serviceName}' (norm: ${normalizedName}) nebyla nalezena v DB.`)
               }
            }
            await log(`[Řazení] Aktualizováno pořadí pro ${orderCounter - 1} služeb.`)
         } else {
             // Fallback: Pokud nenajdeme vertikální seznam, zkusíme horizontální (pro list "Výsledky")
             const headerRowIndexHorizontal = rawData.findIndex(row => row.some((cell: unknown) => {
                const s = String(cell).toLowerCase()
                return s.includes('jednotka') || s.includes('byt')
             }))

             if (headerRowIndexHorizontal !== -1) {
                const headerRow = rawData[headerRowIndexHorizontal] as string[]
                const services = await prisma.service.findMany({ where: { buildingId: building.id } })
                const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
                
                let orderCounter = 1
                for (let i = 0; i < headerRow.length; i++) {
                   const colName = String(headerRow[i] || '').trim()
                   if (!colName || colName.toLowerCase().includes('jednotka') || colName.toLowerCase().includes('celkem')) continue
                   
                   const normalizedColName = normalize(colName)
                   const service = services.find(s => normalize(s.name) === normalizedColName)
                   
                   if (service) {
                      await prisma.service.update({
                         where: { id: service.id },
                         data: { order: orderCounter++ }
                      })
                   }
                }
                await log(`[Řazení] Aktualizováno pořadí (horizontální) pro ${orderCounter - 1} služeb.`)
             }
         }
      }

      await send({ type: 'progress', percentage: 100, step: 'Hotovo!' })
      await send({ type: 'result', data: { success: true, message: 'Import dokončen', summary, logs } })
      await writer.close()

  } catch (error) {
    console.error('[Complete import]', error)
    let message = error instanceof Error ? error.message : String(error)
    if (message.includes('Unique constraint failed')) message = 'Duplicitní data v databázi.'
    await send({ type: 'error', message })
    await writer.close()
  }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked'
    }
  })
}
