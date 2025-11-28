import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalculationMethod, MeterType } from '@prisma/client'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Normalizace textu pro porovnávání
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Mapování JSON klíčů predpisů na možné názvy služeb v DB
const PREDPISY_SERVICE_MAP: Record<string, string[]> = {
  elektrika: ['elektrika', 'elektricka energie', 'elektrická energie', 'elektrina', 'elektrické'],
  uklid: ['uklid', 'úklid', 'uklid bytoveho domu', 'úklid bytového domu'],
  komin: ['komin', 'komín', 'kominy', 'komíny'],
  vytah: ['vytah', 'výtah', 'pravidelna udrzba vytah', 'pravidelná údržba výtah'],
  voda: ['voda', 'studena voda', 'studená voda', 'vodne', 'vodné', 'vodne a stocne'],
  sprava: ['sprava', 'správa', 'sprava domu', 'správa domu'],
  opravy: ['opravy', 'fond oprav', 'fond opravy'],
  teplo: ['teplo', 'vytapeni', 'vytápění'],
  tuv: ['tuv', 'teplá voda', 'tepla voda', 'ohrev', 'ohřev', 'ohrev teple vody', 'ohřev teplé vody'],
  pojisteni: ['pojisteni', 'pojištění', 'pojisteni domu', 'pojištění domu'],
  ostatni_sklep: ['ostatni sklep', 'ostatní sklep', 'ostatni naklady garaz', 'ostatní náklady garáž'],
  internet: ['internet'],
  ostatni_upc: ['ostatni upc', 'ostatní upc', 'upc'],
  sta: ['sta', 'antena', 'anténa', 'spolecna antena', 'společná anténa'],
  spolecne_naklady: ['spolecne naklady', 'společné náklady'],
  statutari: ['statutari', 'statutární', 'odmena vyboru', 'odměna výboru'],
  najemne: ['najemne', 'nájemné', 'ostatni najemne', 'ostatní nájemné'],
  sluzby: ['sluzby', 'služby'],
  ostatni_sluzby: ['ostatni sluzby', 'ostatní služby', 'ostatni sluzby 2'],
  poplatek_pes: ['poplatek pes', 'poplatek za psa', 'tvorba na splatku', 'tvorba na splátku', 'uver', 'úvěr']
}

// Detekce metodiky výpočtu z pole "jednotka"
function detectMethodology(jednotka: string | null | undefined): CalculationMethod {
  if (!jednotka) return CalculationMethod.OWNERSHIP_SHARE
  
  const normalized = normalize(jednotka)
  
  if (normalized.includes('nevyuct') || normalized === '') {
    return CalculationMethod.NO_BILLING
  }
  if (normalized.includes('externi') || normalized.includes('extern')) {
    return CalculationMethod.METER_READING
  }
  if (normalized.includes('pocet osob') || normalized.includes('osobo')) {
    return CalculationMethod.PERSON_MONTHS
  }
  if (normalized.includes('na byt') || normalized.includes('nabyt') || normalized.includes('rovnym dilem')) {
    return CalculationMethod.EQUAL_SPLIT
  }
  if (normalized.includes('vlastnick') || normalized.includes('podil')) {
    return CalculationMethod.OWNERSHIP_SHARE
  }
  if (normalized.includes('m2') || normalized.includes('plocha') || normalized.includes('vymera')) {
    return CalculationMethod.AREA
  }
  
  return CalculationMethod.OWNERSHIP_SHARE
}

// Parsování vlastnického podílu z formátu "677/5903"
function parseOwnershipShare(podilDum: string | null | undefined): { numerator: number; denominator: number } {
  if (!podilDum) return { numerator: 0, denominator: 10000 }
  
  const match = podilDum.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (match) {
    return {
      numerator: parseInt(match[1], 10),
      denominator: parseInt(match[2], 10)
    }
  }
  
  // Zkusíme parsovat jako číslo (procento)
  const num = parseFloat(podilDum.replace(',', '.'))
  if (!isNaN(num)) {
    return { numerator: Math.round(num * 100), denominator: 10000 }
  }
  
  return { numerator: 0, denominator: 10000 }
}

// Parsování datumu z formátu "1.1.2024" nebo "01.01.2024"
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('.')
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day)
    }
  }
  return null
}

// Parsování jména na firstName a lastName
function parseName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] }
  }
  // Tituly na začátku
  const titles = ['Mgr.', 'Ing.', 'Bc.', 'RNDr.', 'PhDr.', 'MUDr.', 'JUDr.', 'Dr.', 'Prof.', 'Doc.']
  let startIndex = 0
  while (startIndex < parts.length && titles.some(t => t.toLowerCase() === parts[startIndex].toLowerCase())) {
    startIndex++
  }
  
  if (startIndex >= parts.length) {
    return { firstName: '', lastName: trimmed }
  }
  
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(startIndex, parts.length - 1).join(' ')
  return { firstName, lastName }
}

// Odstranění prefixu z čísla jednotky pro normalizaci
function stripUnitPrefix(unitNumber: string): string {
  return unitNumber
    .replace(/^(jednotka|byt|nebytový prostor|nebyt\.|ateliér|atelier|garáž|garaz|sklep|bazén|bazen)\s*(č\.?|c\.?)?\s*/gi, '')
    .replace(/^(č\.?|c\.?)\s*/gi, '')
    .trim()
}

// Typy pro JSON strukturu
interface JsonHouseInfo {
  nazev: string
  sidlo: string
}

interface JsonFaktura {
  jednotka?: string | null
  podil?: string | number | null
  cena?: number | string | null
  // Ostatní pole ignorujeme - počítá systém
}

interface JsonFakturaItem {
  name: string
  faktura: JsonFaktura | null
}

interface JsonUhrada {
  oznaceni: string
  platby: number[]
}

interface JsonVstupniData {
  spravce?: string
  cislo_uctu_dum?: string
  predcisli_spolecenstvi?: string
  cislo_uctu_spolecenstvi?: string
  kod_banky_spolecenstvi?: string
  rok?: string | number
  pocet_jednotek?: number
  cena_bvak?: string | number
  plocha_domu?: number
  plocha_domu_zapoc?: number
  adresa?: string
  reklamace?: string
  vyuctovani_do?: string
}

interface JsonMeridlo {
  typ?: string
  datum_odectu?: string
  meridlo?: string
  pocatecni_hodnota?: number
  koncova_hodnota?: number
  rocni_naklad?: number
  radio_module?: string | null
  import_id?: string | null
}

interface JsonMeridlaUnit {
  oznaceni: string
  tuv?: JsonMeridlo[]
  sv?: JsonMeridlo[]
  teplo?: JsonMeridlo[]
  elektro?: JsonMeridlo[]
  parking?: JsonMeridlo[]
  vytahy_meridla?: number[]
}

interface JsonPocetOsob {
  oznaceni: string
  uzivatel: string
  pocet_osob_by_month: Record<string, number>
}

interface JsonEvidence {
  oznaceni: string
  uzivatel: string
  bydliste?: string
  email?: string
  telefon?: string
  osloveni?: string
  kominy?: number | string
  vymera?: number
  vymera_zapocitatelna?: number
  podil_dum?: string
  vs?: number | string
  vs_modified?: string
  od?: string
  do?: string
  bankovni_spojeni?: string
}

interface JsonPredpis {
  oznaceni: string
  uzivatel: string
  [key: string]: string | Record<string, number> | undefined
}

interface JsonVytah {
  oznaceni: string
  vytah: string | number
}

interface JsonData {
  house_info: JsonHouseInfo
  faktury: JsonFakturaItem[]
  uhrady: JsonUhrada[]
  vstupni_data: JsonVstupniData
  meridla: JsonMeridlaUnit[]
  pocet_osob: JsonPocetOsob[]
  evidence: JsonEvidence[]
  predpisy: JsonPredpis[]
  vytahy?: JsonVytah[]
  params?: {
    param_names: string[]
    data: { oznaceni: string; params: (string | number)[] }[]
  }
}

interface ImportSummary {
  building: { id: string; name: string; created: boolean }
  units: { created: number; existing: number; total: number }
  owners: { created: number; existing: number; total: number }
  services: { created: number; existing: number; total: number }
  costs: { created: number; total: number }
  readings: { created: number; total: number }
  payments: { created: number; total: number }
  advances: { created: number; total: number }
  personMonths: { created: number; total: number }
  errors: string[]
  warnings: string[]
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (data: unknown) => {
    await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return new Response(JSON.stringify({ type: 'error', message: 'Neplatná data formuláře' }), { status: 400 })
  }

  (async () => {
    try {
      const file = formData.get('file')
      const buildingIdParam = (formData.get('buildingId') as string) || ''
      
      await send({ type: 'progress', percentage: 5, step: 'Načítám JSON soubor...' })

      if (!file) {
        await send({ type: 'error', message: 'JSON soubor nebyl přiložen.' })
        await writer.close()
        return
      }

      const fileObj = file instanceof File ? file : new File([file as unknown as Blob], 'upload.json', { type: 'application/json' })

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

      // Parsování JSON
      let jsonData: JsonData
      try {
        const text = await fileObj.text()
        jsonData = JSON.parse(text)
      } catch {
        await send({ type: 'error', message: 'Neplatný JSON formát.' })
        await writer.close()
        return
      }

      const summary: ImportSummary = {
        building: { id: '', name: '', created: false },
        units: { created: 0, existing: 0, total: 0 },
        owners: { created: 0, existing: 0, total: 0 },
        services: { created: 0, existing: 0, total: 0 },
        costs: { created: 0, total: 0 },
        readings: { created: 0, total: 0 },
        payments: { created: 0, total: 0 },
        advances: { created: 0, total: 0 },
        personMonths: { created: 0, total: 0 },
        errors: [],
        warnings: []
      }

      const logs: string[] = []
      const log = async (msg: string) => {
        logs.push(msg)
        console.log(msg)
        await send({ type: 'log', message: msg })
      }

      // 1. BUDOVA
      await send({ type: 'progress', percentage: 10, step: 'Zpracovávám budovu...' })
      
      const buildingName = jsonData.house_info?.nazev || 'Importovaná budova'
      const buildingAddress = jsonData.house_info?.sidlo || jsonData.vstupni_data?.adresa || 'Nezadáno'
      const rok = typeof jsonData.vstupni_data?.rok === 'string' 
        ? parseInt(jsonData.vstupni_data.rok, 10) 
        : jsonData.vstupni_data?.rok || new Date().getFullYear()

      // Složení bankovního účtu
      let bankAccount = jsonData.vstupni_data?.cislo_uctu_dum || ''
      if (jsonData.vstupni_data?.cislo_uctu_spolecenstvi) {
        const predcisli = jsonData.vstupni_data.predcisli_spolecenstvi || ''
        const cislo = jsonData.vstupni_data.cislo_uctu_spolecenstvi
        const kod = jsonData.vstupni_data.kod_banky_spolecenstvi || ''
        bankAccount = predcisli && predcisli !== '000000' 
          ? `${predcisli}-${cislo}/${kod}`
          : `${cislo}/${kod}`
      }

      let building
      if (buildingIdParam) {
        building = await prisma.building.findUnique({ where: { id: buildingIdParam } })
        if (!building) {
          await send({ type: 'error', message: `Budova s ID ${buildingIdParam} nebyla nalezena.` })
          await writer.close()
          return
        }
        await log(`[Budova] Použita existující budova: ${building.name}`)
      } else {
        // Hledání podle názvu
        building = await prisma.building.findFirst({
          where: { name: { contains: buildingName.substring(0, 30), mode: 'insensitive' } }
        })

        if (!building) {
          building = await prisma.building.create({
            data: {
              name: buildingName,
              address: buildingAddress,
              city: 'Nezadáno',
              zip: '00000',
              managerName: jsonData.vstupni_data?.spravce || null,
              bankAccount,
              totalArea: jsonData.vstupni_data?.plocha_domu || null,
              chargeableArea: jsonData.vstupni_data?.plocha_domu_zapoc || null
            }
          })
          summary.building.created = true
          await log(`[Budova] Vytvořena nová budova: ${building.name}`)
        } else {
          // Aktualizace existující budovy
          building = await prisma.building.update({
            where: { id: building.id },
            data: {
              managerName: jsonData.vstupni_data?.spravce || building.managerName,
              bankAccount: bankAccount || building.bankAccount,
              totalArea: jsonData.vstupni_data?.plocha_domu || building.totalArea,
              chargeableArea: jsonData.vstupni_data?.plocha_domu_zapoc || building.chargeableArea
            }
          })
          await log(`[Budova] Aktualizována budova: ${building.name}`)
        }
      }

      summary.building.id = building.id
      summary.building.name = building.name

      // Billing Period
      const billingPeriod = await prisma.billingPeriod.upsert({
        where: { buildingId_year: { buildingId: building.id, year: rok } },
        update: {},
        create: { buildingId: building.id, year: rok }
      })
      await log(`[BillingPeriod] Rok: ${rok}, ID: ${billingPeriod.id}`)

      // Smazání starých dat pro tento rok
      await send({ type: 'progress', percentage: 15, step: 'Mažu stará data...' })
      await prisma.$transaction([
        prisma.cost.deleteMany({ where: { buildingId: building.id, period: rok } }),
        prisma.payment.deleteMany({ where: { unit: { buildingId: building.id }, period: rok } }),
        prisma.meterReading.deleteMany({ where: { meter: { unit: { buildingId: building.id } }, period: rok } }),
        prisma.advanceMonthly.deleteMany({ where: { unit: { buildingId: building.id }, year: rok } }),
        prisma.personMonth.deleteMany({ where: { unit: { buildingId: building.id }, year: rok } }),
        prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
      ])
      await log(`[Cleanup] Stará data pro rok ${rok} smazána.`)

      // 2. JEDNOTKY A VLASTNÍCI (z evidence)
      await send({ type: 'progress', percentage: 20, step: 'Importuji jednotky a vlastníky...' })
      
      const unitMap = new Map<string, { id: string; variableSymbol?: string | null }>()

      for (const ev of jsonData.evidence || []) {
        const unitNumber = ev.oznaceni
        const strippedUnit = stripUnitPrefix(unitNumber)
        const { firstName, lastName } = parseName(ev.uzivatel || '')
        const { numerator, denominator } = parseOwnershipShare(ev.podil_dum)
        
        // Vlastník
        let owner = await prisma.owner.findFirst({
          where: {
            OR: [
              { email: ev.email || undefined },
              { AND: [
                { firstName: { equals: firstName, mode: 'insensitive' } },
                { lastName: { equals: lastName, mode: 'insensitive' } }
              ]}
            ]
          }
        })

        if (!owner) {
          owner = await prisma.owner.create({
            data: {
              firstName,
              lastName,
              email: ev.email || null,
              phone: ev.telefon || null,
              address: ev.bydliste || null,
              salutation: ev.osloveni || null,
              bankAccount: ev.bankovni_spojeni || null
            }
          })
          summary.owners.created++
          await log(`[Owner] Vytvořen: ${firstName} ${lastName}`)
        } else {
          // Aktualizace
          await prisma.owner.update({
            where: { id: owner.id },
            data: {
              phone: ev.telefon || owner.phone,
              address: ev.bydliste || owner.address,
              salutation: ev.osloveni || owner.salutation,
              bankAccount: ev.bankovni_spojeni || owner.bankAccount
            }
          })
          summary.owners.existing++
        }
        summary.owners.total++

        // Jednotka
        let unit = await prisma.unit.findFirst({
          where: {
            buildingId: building.id,
            OR: [
              { unitNumber },
              { unitNumber: strippedUnit }
            ]
          }
        })

        const variableSymbol = ev.vs ? String(ev.vs) : null
        // vs_modified uložíme jako poznámku (nebo do nového pole, pokud existuje)

        if (!unit) {
          unit = await prisma.unit.create({
            data: {
              buildingId: building.id,
              unitNumber,
              type: 'APARTMENT',
              shareNumerator: numerator,
              shareDenominator: denominator,
              totalArea: ev.vymera || 0,
              floorArea: ev.vymera_zapocitatelna || ev.vymera || 0,
              variableSymbol
            }
          })
          summary.units.created++
          await log(`[Unit] Vytvořena: ${unitNumber}`)
        } else {
          unit = await prisma.unit.update({
            where: { id: unit.id },
            data: {
              unitNumber, // Aktualizace na plný název
              shareNumerator: numerator || unit.shareNumerator,
              shareDenominator: denominator || unit.shareDenominator,
              totalArea: ev.vymera || unit.totalArea,
              floorArea: ev.vymera_zapocitatelna || unit.floorArea,
              variableSymbol: variableSymbol || unit.variableSymbol
            }
          })
          summary.units.existing++
        }
        summary.units.total++

        unitMap.set(unitNumber, { id: unit.id, variableSymbol: unit.variableSymbol })
        unitMap.set(strippedUnit, { id: unit.id, variableSymbol: unit.variableSymbol })

        // Ownership
        const validFrom = parseDate(ev.od) || new Date(rok, 0, 1)
        const validTo = parseDate(ev.do)

        const existingOwnership = await prisma.ownership.findFirst({
          where: { unitId: unit.id, ownerId: owner.id }
        })

        if (!existingOwnership) {
          await prisma.ownership.create({
            data: {
              unitId: unit.id,
              ownerId: owner.id,
              validFrom,
              validTo,
              sharePercent: 100
            }
          })
        } else {
          await prisma.ownership.update({
            where: { id: existingOwnership.id },
            data: { validFrom, validTo }
          })
        }
      }

      // 3. SLUŽBY A NÁKLADY (z faktury)
      await send({ type: 'progress', percentage: 40, step: 'Importuji služby a náklady...' })
      
      const serviceMap = new Map<string, string>() // normalized name -> service ID
      const dbServices = await prisma.service.findMany({ where: { buildingId: building.id } })
      dbServices.forEach(s => serviceMap.set(normalize(s.name), s.id))

      for (const fakturaItem of jsonData.faktury || []) {
        if (!fakturaItem.name || fakturaItem.name.trim() === '') continue

        const serviceName = fakturaItem.name.trim()
        const normalizedName = normalize(serviceName)
        const faktura = fakturaItem.faktura

        // Detekce metodiky
        const methodology = detectMethodology(faktura?.jednotka)

        // Najít nebo vytvořit službu
        let serviceId = serviceMap.get(normalizedName)

        if (!serviceId) {
          // Zkusit fuzzy match
          for (const [key, id] of serviceMap.entries()) {
            if (key.includes(normalizedName) || normalizedName.includes(key)) {
              serviceId = id
              break
            }
          }
        }

        if (!serviceId) {
          // Vytvořit novou službu
          const code = serviceName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 20) || 'SERVICE'
          
          let created = false
          for (let attempt = 0; attempt < 10 && !created; attempt++) {
            const candidate = attempt === 0 ? code : `${code}_${attempt}`
            try {
              const newService = await prisma.service.create({
                data: {
                  buildingId: building.id,
                  name: serviceName,
                  code: candidate,
                  methodology,
                  isActive: true,
                  showOnStatement: true,
                  order: summary.services.total
                }
              })
              serviceId = newService.id
              serviceMap.set(normalizedName, serviceId)
              summary.services.created++
              created = true
              await log(`[Service] Vytvořena: ${serviceName} (${methodology})`)
            } catch (e) {
              if (e instanceof Error && e.message.includes('Unique constraint')) continue
              throw e
            }
          }
        } else {
          // Existující služba - ZACHOVAT uživatelské nastavení!
          // Aktualizujeme pouze methodology pokud služba nemá žádnou nastavenou
          const existingService = await prisma.service.findUnique({ where: { id: serviceId } })
          if (existingService && existingService.methodology === 'NO_BILLING') {
            // Pouze pokud je služba nastavena jako "nevyúčtovává se", aktualizujeme metodiku
            await prisma.service.update({
              where: { id: serviceId },
              data: { methodology }
            })
            await log(`[Service] Aktualizována metodika: ${serviceName} -> ${methodology}`)
          }
          // Jinak ponecháme všechna existující nastavení (isActive, dataSourceColumn, showOnStatement atd.)
          summary.services.existing++
        }
        summary.services.total++

        // Náklad (Cost)
        if (serviceId && faktura?.cena) {
          const amount = typeof faktura.cena === 'string' 
            ? parseFloat(faktura.cena.replace(/\s/g, '').replace(',', '.'))
            : faktura.cena

          if (amount && amount > 0) {
            await prisma.cost.create({
              data: {
                buildingId: building.id,
                serviceId,
                amount,
                description: `Import z JSON - ${serviceName}`,
                invoiceDate: new Date(rok, 11, 31),
                period: rok
              }
            })
            summary.costs.created++
            summary.costs.total++
          }
        }
      }

      // 4. PLATBY (z uhrady)
      await send({ type: 'progress', percentage: 55, step: 'Importuji platby...' })
      
      const paymentsToCreate: {
        unitId: string
        amount: number
        paymentDate: Date
        variableSymbol: string
        period: number
        description: string
      }[] = []

      for (const uhrada of jsonData.uhrady || []) {
        const unit = unitMap.get(uhrada.oznaceni) || unitMap.get(stripUnitPrefix(uhrada.oznaceni))
        if (!unit) {
          summary.warnings.push(`Platby: Jednotka '${uhrada.oznaceni}' nenalezena.`)
          continue
        }

        for (let month = 0; month < 12; month++) {
          const amount = uhrada.platby[month]
          if (amount && amount !== 0) {
            paymentsToCreate.push({
              unitId: unit.id,
              amount,
              paymentDate: new Date(rok, month, 15),
              variableSymbol: unit.variableSymbol || stripUnitPrefix(uhrada.oznaceni).replace(/[^0-9]/g, ''),
              period: rok,
              description: `Úhrada záloh ${(month + 1).toString().padStart(2, '0')}/${rok}`
            })
          }
        }
      }

      if (paymentsToCreate.length > 0) {
        await prisma.payment.createMany({ data: paymentsToCreate, skipDuplicates: true })
        summary.payments.created = paymentsToCreate.length
        summary.payments.total = paymentsToCreate.length
        await log(`[Payments] Vytvořeno ${paymentsToCreate.length} plateb.`)
      }

      // 5. ODEČTY MĚŘIDEL (z meridla)
      await send({ type: 'progress', percentage: 65, step: 'Importuji odečty měřidel...' })

      const METER_TYPE_MAP: Record<string, MeterType> = {
        tuv: 'HOT_WATER',
        sv: 'COLD_WATER',
        teplo: 'HEATING',
        elektro: 'ELECTRICITY'
      }

      for (const meridlaUnit of jsonData.meridla || []) {
        const unit = unitMap.get(meridlaUnit.oznaceni) || unitMap.get(stripUnitPrefix(meridlaUnit.oznaceni))
        if (!unit) continue

        for (const [key, meterType] of Object.entries(METER_TYPE_MAP)) {
          const meters = meridlaUnit[key as keyof JsonMeridlaUnit] as JsonMeridlo[] | undefined
          if (!meters || !Array.isArray(meters)) continue

          for (let idx = 0; idx < meters.length; idx++) {
            const m = meters[idx]
            // SerialNumber musí být unikátní pro každý typ měřidla!
            // Pokud je m.meridlo "0" nebo prázdné, použijeme kombinaci jednotka-typ-index
            const baseSerial = m.meridlo && m.meridlo !== '0' ? m.meridlo : `${unit.id}-${key}-${idx}`
            const serialNumber = baseSerial
            
            // Najít nebo vytvořit měřidlo (hledáme podle serialNumber A typu!)
            let meter = await prisma.meter.findFirst({
              where: { unitId: unit.id, serialNumber, type: meterType }
            })

            if (!meter) {
              // Zkusíme najít podle typu (bez ohledu na serialNumber) - pro případ že existuje měřidlo s jiným serialNumber
              meter = await prisma.meter.findFirst({
                where: { unitId: unit.id, type: meterType }
              })
              
              if (!meter) {
                meter = await prisma.meter.create({
                  data: {
                    unitId: unit.id,
                    serialNumber,
                    type: meterType,
                    initialReading: m.pocatecni_hodnota || 0,
                    isActive: true
                  }
                })
              }
            }

            // Odečet
            if (m.rocni_naklad !== undefined || m.koncova_hodnota !== undefined) {
              await prisma.meterReading.create({
                data: {
                  meterId: meter.id,
                  period: rok,
                  readingDate: new Date(rok, 11, 31),
                  value: m.koncova_hodnota || 0,
                  startValue: m.pocatecni_hodnota || 0,
                  endValue: m.koncova_hodnota || 0,
                  consumption: (m.koncova_hodnota || 0) - (m.pocatecni_hodnota || 0),
                  precalculatedCost: m.rocni_naklad || null,
                  note: m.import_id || null
                }
              })
              summary.readings.created++
              summary.readings.total++
            }
          }
        }
      }
      await log(`[Readings] Vytvořeno ${summary.readings.created} odečtů.`)

      // 6. POČET OSOB (z pocet_osob)
      await send({ type: 'progress', percentage: 75, step: 'Importuji počty osob...' })

      const personMonthsToCreate: {
        unitId: string
        year: number
        month: number
        personCount: number
      }[] = []

      for (const osoby of jsonData.pocet_osob || []) {
        const unit = unitMap.get(osoby.oznaceni) || unitMap.get(stripUnitPrefix(osoby.oznaceni))
        if (!unit) continue

        for (const [monthStr, count] of Object.entries(osoby.pocet_osob_by_month || {})) {
          const month = parseInt(monthStr, 10)
          const personCount = typeof count === 'number' ? count : parseInt(String(count), 10)
          
          if (month >= 1 && month <= 12 && personCount >= 0) {
            personMonthsToCreate.push({
              unitId: unit.id,
              year: rok,
              month,
              personCount: Math.round(personCount)
            })
          }
        }
      }

      if (personMonthsToCreate.length > 0) {
        await prisma.personMonth.createMany({ data: personMonthsToCreate, skipDuplicates: true })
        summary.personMonths.created = personMonthsToCreate.length
        summary.personMonths.total = personMonthsToCreate.length
        await log(`[PersonMonths] Vytvořeno ${personMonthsToCreate.length} záznamů osob.`)
      }

      // 7. PŘEDPISY ZÁLOH (z predpisy)
      await send({ type: 'progress', percentage: 85, step: 'Importuji předpisy záloh...' })

      const advancesToCreate: {
        unitId: string
        serviceId: string
        year: number
        month: number
        amount: number
      }[] = []

      // Načíst všechny služby pro budovu
      const allServices = await prisma.service.findMany({ where: { buildingId: building.id } })
      
      // Vytvořit mapování JSON klíč -> service ID
      const predpisyServiceIdMap = new Map<string, string>()
      
      for (const [jsonKey, possibleNames] of Object.entries(PREDPISY_SERVICE_MAP)) {
        for (const service of allServices) {
          const normalizedServiceName = normalize(service.name)
          if (possibleNames.some(pn => normalizedServiceName.includes(normalize(pn)) || normalize(pn).includes(normalizedServiceName))) {
            predpisyServiceIdMap.set(jsonKey, service.id)
            break
          }
        }
      }

      await log(`[Advances] Namapováno ${predpisyServiceIdMap.size} služeb z predpisů.`)

      for (const predpis of jsonData.predpisy || []) {
        const unit = unitMap.get(predpis.oznaceni) || unitMap.get(stripUnitPrefix(predpis.oznaceni))
        if (!unit) continue

        for (const [jsonKey, serviceId] of predpisyServiceIdMap.entries()) {
          const monthlyData = predpis[jsonKey]
          if (!monthlyData || typeof monthlyData !== 'object') continue

          for (const [monthStr, amount] of Object.entries(monthlyData as Record<string, number>)) {
            const month = parseInt(monthStr, 10)
            const value = typeof amount === 'number' ? amount : parseFloat(String(amount))

            if (month >= 1 && month <= 12 && !isNaN(value) && isFinite(value) && value > 0) {
              advancesToCreate.push({
                unitId: unit.id,
                serviceId,
                year: rok,
                month,
                amount: value
              })
            }
          }
        }
      }

      if (advancesToCreate.length > 0) {
        await prisma.advanceMonthly.createMany({ data: advancesToCreate, skipDuplicates: true })
        summary.advances.created = advancesToCreate.length
        summary.advances.total = advancesToCreate.length
        await log(`[Advances] Vytvořeno ${advancesToCreate.length} záznamů záloh.`)
      }

      // 8. PARAMETRY JEDNOTEK (z params)
      await send({ type: 'progress', percentage: 95, step: 'Importuji parametry...' })

      if (jsonData.params?.param_names && jsonData.params?.data) {
        const paramNames = jsonData.params.param_names

        for (const paramData of jsonData.params.data) {
          const unit = unitMap.get(paramData.oznaceni) || unitMap.get(stripUnitPrefix(paramData.oznaceni))
          if (!unit) continue

          for (let i = 0; i < paramNames.length && i < paramData.params.length; i++) {
            const paramName = paramNames[i]
            const paramValue = paramData.params[i]
            
            const numValue = typeof paramValue === 'number' ? paramValue : parseFloat(String(paramValue).replace(',', '.'))
            
            if (!isNaN(numValue)) {
              await prisma.unitParameter.upsert({
                where: { unitId_name: { unitId: unit.id, name: paramName } },
                update: { value: numValue },
                create: { unitId: unit.id, name: paramName, value: numValue }
              })
            }
          }
        }
        await log(`[Params] Zpracovány parametry jednotek.`)
      }

      // HOTOVO
      await send({ type: 'progress', percentage: 100, step: 'Import dokončen!' })
      await send({ type: 'result', data: { success: true, message: 'JSON import dokončen', summary, logs } })
      await writer.close()

    } catch (error) {
      console.error('[JSON Import Error]', error)
      const message = error instanceof Error ? error.message : String(error)
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
