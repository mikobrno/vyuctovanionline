import { NextRequest } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'
import { CalculationMethod, DataSourceType, MeterType, Service } from '@prisma/client'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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

type UnitLite = { id: string; meters?: { id: string; type: MeterType; isActive: boolean }[]; variableSymbol?: string }

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = async (data: any) => {
    await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
  }

  // Spustit zpracování na pozadí
  (async () => {
    try {
      const formData = await req.formData()
      const file = formData.get('file')
      const buildingName = (formData.get('buildingName') as string) || ''
      const buildingId = (formData.get('buildingId') as string) || ''
      const year = (formData.get('year') as string) || ''

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
      
      if (inputDataSheetName) {
        const inputSheet = workbook.Sheets[inputDataSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(inputSheet, { header: 1, defval: '' })
        
        if (rawData.length > 2 && rawData[2] && rawData[2][1]) {
          const addressValue = String(rawData[2][1]).trim()
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
        
        if (rawData.length > 33 && rawData[33] && rawData[33][1]) {
          managerName = String(rawData[33][1]).trim() || null
          if (managerName) await log(`[Import] Načten správce z B34: ${managerName}`)
        }
      }
      
      let building;

      if (buildingId) {
        building = await prisma.building.findUnique({
          where: { id: buildingId }
        })
        if (!building) {
           throw new Error(`Budova s ID ${buildingId} nebyla nalezena.`)
        }
      } else {
        const finalBuildingName = buildingName || 'Importovaná budova ' + new Date().toLocaleDateString('cs-CZ')
        
        building = await prisma.building.findFirst({
          where: { name: { contains: finalBuildingName, mode: 'insensitive' } }
        })

        if (!building) {
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
        }
      }

      summary.building.id = building.id
      summary.building.name = building.name

      const billingPeriodRecord = await prisma.billingPeriod.upsert({
        where: { buildingId_year: { buildingId: building.id, year: parseInt(billingPeriod, 10) } },
        update: {},
        create: { buildingId: building.id, year: parseInt(billingPeriod, 10) }
      })
      await log(`[Import] BillingPeriod ID: ${billingPeriodRecord.id}`)

      // Inicializace mapy jednotek pro pozdější použití
      const unitMap = new Map<string, UnitLite>()

      // 2. IMPORT VLASTNÍKŮ
      await send({ type: 'progress', percentage: 20, step: 'Importuji vlastníky a jednotky...' })
      
      const evidenceSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('evidence') || name.toLowerCase().includes('evidenc')
      )

      const ownerMap = new Map<string, { id: string; firstName: string; lastName: string }>()
      const salutationMap = new Map<string, string>()
      
      const exportSendMailSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().replace(/[\s_-]/g, '').includes('exportsendmail') ||
        (name.toLowerCase().includes('export') && name.toLowerCase().includes('send'))
      )
      
      if (exportSendMailSheetName) {
        const exportSheet = workbook.Sheets[exportSendMailSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(exportSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => 
          row.some((cell: unknown) => {
            const cellStr = String(cell).toLowerCase()
            return cellStr.includes('jednotka') || cellStr.includes('byt')
          })
        )
        
        if (headerRowIndex !== -1) {
          const dataRows = rawData.slice(headerRowIndex + 1)
          await log(`[Export_Send_Mail] Zpracovávám ${dataRows.length} řádků oslovení`)
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0) continue
            const unitNumber = String(row[0] || '').trim()
            const salutation = String(row[13] || '').trim()
            if (unitNumber && salutation) salutationMap.set(unitNumber, salutation)
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
                data: { validFrom: effectiveValidFrom, validTo: effectiveValidTo }
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

      // Smazání existujících nákladů a plateb pro tento rok před importem, aby nedocházelo k duplicitám
      const pYear = parseInt(billingPeriod);
      if (!isNaN(pYear)) {
        await prisma.cost.deleteMany({ where: { buildingId: building.id, period: pYear } });
        await prisma.payment.deleteMany({ where: { unit: { buildingId: building.id }, period: pYear } });
        await log(`[Cleanup] Smazány staré náklady a platby pro rok ${pYear}`);
      }
      
      const invoicesSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('faktur') || name.toLowerCase().includes('invoice')
      )

      if (invoicesSheetName) {
        const invoicesSheet = workbook.Sheets[invoicesSheetName]
        const rawData = utils.sheet_to_json<unknown[]>(invoicesSheet, { header: 1, defval: '' })
        const headerRowIndex = rawData.findIndex(row => {
          const norm = (row as unknown[]).map(c => normalizeHeaderCell(String(c ?? '')))
          return norm.some(c => /zpusob|metod|rozuct/.test(c)) && norm.some(c => /naklad.*rok|naklad za rok|celkem.*rok/.test(c))
        })

        if (headerRowIndex !== -1) {
          const header = (rawData[headerRowIndex] || []).map(c => String(c ?? ''))
          const normHeader = header.map(c => normalizeHeaderCell(c))
          const findIdx = (...pats: RegExp[]) => normHeader.findIndex(h => pats.some(p => p.test(h)))

          const idxService = findIdx(/sluzb|polozk|popis|nazev/) >= 0 ? findIdx(/sluzb|polozk|popis|nazev/) : 0
          const idxMethod = findIdx(/zpusob|metod|rozuct/)
          const idxAmount = findIdx(/naklad.*rok|naklad za rok/) >= 0 ? findIdx(/naklad.*rok|naklad za rok/) : findIdx(/naklad|celkem/)

          const dataRows = rawData.slice(headerRowIndex + 1)
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] as unknown[]
            if (!row || row.length === 0) continue
            const serviceName = String(row[idxService] ?? '').trim()
            const methodology = idxMethod >= 0 ? String(row[idxMethod] ?? '').trim() : ''
            const amountStr = idxAmount >= 0 ? String(row[idxAmount] ?? '0').trim() : '0'

            if (!serviceName || /prázdn/i.test(serviceName) || /^\s*$/.test(serviceName)) continue
            const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
            if (!Number.isFinite(amount) || amount === 0) continue

            let service = await prisma.service.findFirst({
              where: { buildingId: building.id, name: { equals: serviceName, mode: 'insensitive' } }
            })

            const m = methodology.toLowerCase()
            const calculationMethod = m.includes('měřidl') || m.includes('odečet') ? 'METER_READING' :
                                      (m.includes('plocha') || m.includes('výměr')) ? 'AREA' :
                                      (m.includes('osob')) ? 'PERSON_MONTHS' :
                                      (m.includes('byt') || m.includes('jednotk')) ? 'FIXED_PER_UNIT' :
                                      m.includes('rovn') ? 'EQUAL_SPLIT' :
                                      (m.includes('podil')) ? 'OWNERSHIP_SHARE' : 'OWNERSHIP_SHARE'

            const src = (() => {
              if (calculationMethod === 'METER_READING') return { dataSourceType: 'METER_DATA', unitAttributeName: null, measurementUnit: null }
              if (calculationMethod === 'AREA') return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'CELKOVA_VYMERA', measurementUnit: 'm²' }
              if (calculationMethod === 'PERSON_MONTHS') return { dataSourceType: 'PERSON_MONTHS', unitAttributeName: null, measurementUnit: 'osobo-měsíc' }
              if (calculationMethod === 'FIXED_PER_UNIT') return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: null }
              if (calculationMethod === 'EQUAL_SPLIT') return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: null }
              if (calculationMethod === 'OWNERSHIP_SHARE') return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'VLASTNICKY_PODIL', measurementUnit: null }
              return { dataSourceType: null, unitAttributeName: null, measurementUnit: null }
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
                      dataSourceType: (src.dataSourceType as DataSourceType) ?? undefined, unitAttributeName: src.unitAttributeName ?? undefined,
                      measurementUnit: src.measurementUnit ?? undefined, isActive: true, order: summary.services.total
                    }
                  })
                  service = created
                } catch (e) { if (e instanceof Error && e.message.includes('Unique constraint failed')) continue; throw e; }
              }
              if (!service) throw new Error(`Nepodařilo se vytvořit službu '${serviceName}'`)
              summary.services.created++
            } else {
              await prisma.service.update({
                where: { id: service.id },
                data: { methodology: calculationMethod as CalculationMethod, dataSourceType: (src.dataSourceType as DataSourceType) ?? undefined }
              })
              summary.services.existing++
            }
            summary.services.total++

            await prisma.cost.create({
              data: {
                buildingId: building.id, serviceId: service.id, amount, description: `Import z Excelu - ${serviceName}`,
                invoiceDate: new Date(`${billingPeriod}-12-31`), period: parseInt(billingPeriod)
              }
            })
            summary.costs.created++
            summary.costs.total++
          }
        }
      }

      // 4. IMPORT ODEČTŮ
      await send({ type: 'progress', percentage: 60, step: 'Importuji odečty měřidel...' })
      
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

          let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
          
          if (!unit) {
            const found = await prisma.unit.findFirst({ 
              where: { 
                buildingId: building.id, 
                OR: [
                  { unitNumber: rawUnitNumber },
                  { unitNumber: strippedUnitNumber }
                ]
              }, 
              include: { meters: true } 
            })
            
            if (!found) {
              summary.warnings.push(`Odečty: Jednotka '${rawUnitNumber}' nebyla nalezena v evidenci.`)
              continue
            } else {
              unit = { id: found.id, meters: found.meters }
              unitMap.set(rawUnitNumber, unit)
              unitMap.set(strippedUnitNumber, unit)
              summary.units.existing++
            }
            summary.units.total++
          }

          // Nejprve zkusíme najít službu podle kódu (to je bezpečnější)
          let service = await prisma.service.findUnique({ 
            where: { buildingId_code: { buildingId: building.id, code: meterType } } 
          })

          // Pokud nenajdeme podle kódu, zkusíme podle názvu (pro zpětnou kompatibilitu)
          if (!service) {
            service = await prisma.service.findFirst({ 
              where: { buildingId: building.id, name: METER_TYPE_LABELS[meterType] } 
            })
            
            // Pokud najdeme podle názvu, ale kód nesedí (což by nemělo nastat, pokud jsme nenašli podle kódu),
            // tak bychom měli aktualizovat kód, ale to může kolidovat.
            // V tomto případě (nenašli jsme podle kódu, ale podle názvu), tak služba má asi jiný kód.
            // My ale chceme pro měřidla používat standardní kódy.
            // Takže pokud má služba jiný kód, tak ji asi necháme být a vytvoříme novou? 
            // Ne, to by udělalo duplicitu v názvu (pokud není unikátní) nebo bordel.
            // Raději předpokládejme, že pokud jsme nenašli podle kódu, tak služba pro tento typ měřidla ještě není "správně" definovaná.
            
            if (service) {
               // Našli jsme službu se správným názvem, ale jiným kódem.
               // Zkusíme jí nastavit správný kód.
               try {
                 service = await prisma.service.update({
                   where: { id: service.id },
                   data: { code: meterType }
                 })
               } catch (e) {
                 // Pokud aktualizace selže (např. kód už existuje - což by nemělo, když jsme ho nenašli findUnique),
                 // tak to ignorujeme a použijeme službu tak jak je.
               }
            }
          }

          if (!service) {
            try {
              service = await prisma.service.upsert({
                where: { buildingId_code: { buildingId: building.id, code: meterType } },
                update: {},
                create: { buildingId: building.id, name: METER_TYPE_LABELS[meterType], code: meterType, methodology: 'METER_READING', measurementUnit: meterType === 'HEATING' ? 'kWh' : 'm³', isActive: true }
              })
              summary.services.created++
            } catch (e) {
              // Fallback if upsert fails (e.g. name collision?)
              service = await prisma.service.findFirst({ where: { buildingId: building.id, code: meterType } })
              if (!service) throw e
            }
            summary.services.total++
          }

          const effectiveSerial = serialNumber || `${rawUnitNumber}-${meterType}`
          const meter = await prisma.meter.upsert({
            where: { unitId_serialNumber: { unitId: unit.id, serialNumber: effectiveSerial } },
            update: { type: meterType as MeterType, isActive: true },
            create: { unitId: unit.id, serialNumber: effectiveSerial, type: meterType as MeterType, initialReading: startValue, serviceId: service.id, isActive: true, installedAt: new Date(`${billingPeriod}-01-01`) }
          })

          const existingReading = await prisma.meterReading.findFirst({ where: { meterId: meter.id, period: parseInt(billingPeriod, 10) } })
          
          const readingData = {
            readingDate: new Date(`${billingPeriod}-12-31`), 
            dateStart: new Date(`${billingPeriod}-01-01`),
            dateEnd: new Date(`${billingPeriod}-12-31`),
            value: endValue, 
            startValue, 
            endValue, 
            consumption, 
            precalculatedCost: cost ?? null,
            note: externalId || `Import z ${sheetName} - ${ownerName}` 
          }

          if (!existingReading) {
            await prisma.meterReading.create({
              data: { 
                meterId: meter.id, 
                period: parseInt(billingPeriod, 10), 
                ...readingData
              }
            })
            summary.readings.created++
          } else {
            await prisma.meterReading.update({
              where: { id: existingReading.id },
              data: readingData
            })
          }
          summary.readings.total++
        }
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
          
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0 || !row[0]) continue
            const rawUnitNumber = String(row[0] || '').trim()
            const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
            
            if (!rawUnitNumber || rawUnitNumber === 'Bazén' || rawUnitNumber.toLowerCase().includes('celkem')) continue

            let unit = unitMap.get(rawUnitNumber) || unitMap.get(strippedUnitNumber)
            
            if (!unit) {
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
              await prisma.payment.create({
                data: { unitId: unitLite.id, amount, paymentDate, variableSymbol: vs, period: parseInt(billingPeriod), description: `Úhrada záloh ${month.toString().padStart(2, '0')}/${billingPeriod}` }
              })
              summary.payments.created++
              summary.payments.total++
            }
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
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || row.length === 0 || !row[0]) continue
            const rawUnitNumber = String(row[0] || '').trim()
            const strippedUnitNumber = stripUnitPrefixes(rawUnitNumber)
            const personCount = parseInt(String(row[13] || '0')) || 0
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

            await prisma.unit.update({ where: { id: (unit as UnitLite).id }, data: { residents: personCount } })
            
            const startDate = new Date(parseInt(billingPeriod), 0, 1)
            const endDate = new Date(parseInt(billingPeriod), 11, 31)
            const currentDate = new Date(startDate)
            while (currentDate <= endDate) {
              const year = currentDate.getFullYear()
              const month = currentDate.getMonth() + 1
              await prisma.personMonth.upsert({
                where: { unitId_year_month: { unitId: (unit as UnitLite).id, year, month } },
                update: { personCount },
                create: { unitId: (unit as UnitLite).id, year, month, personCount }
              })
              personMonthsCreated++
              currentDate.setMonth(currentDate.getMonth() + 1)
            }
          }
          await log(`[Evidence - Osoby] Vytvořeno ${personMonthsCreated} záznamů osobo-měsíců`)
        }
      }

      // 7. IMPORT PŘEDPISŮ
      await send({ type: 'progress', percentage: 95, step: 'Importuji předpisy záloh...' })
      
      const advancesSheetName = workbook.SheetNames.find(name => {
        const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
        return n === 'předpis po mesici' || n === 'predpis po mesici'
      })

      if (advancesSheetName) {
        await log(`[Předpis] Začínám zpracování listu "${advancesSheetName}"...`)
        try {
          const advancesSheet = workbook.Sheets[advancesSheetName]
          const rawData = utils.sheet_to_json<unknown[]>(advancesSheet, { header: 1, defval: null })
          const periodYear = billingPeriodRecord?.year
          
          // --- NOVÁ LOGIKA: Mapování přes "Vstupní data" ---
          const inputSheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('vstupní') || name.toLowerCase().includes('vstupni') || name.toLowerCase().includes('input')
          )
          
          const serviceMapping: { serviceId: string, colIndex: number, serviceName: string }[] = []
          
          if (inputSheetName) {
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
                               const colIndex = utils.decode_col(startColLetter)
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

             // Hromadné smazání a vložení
             if (serviceIds.size > 0) {
                await prisma.advanceMonthly.deleteMany({
                   where: {
                      unit: { buildingId: building.id },
                      year: periodYear,
                      serviceId: { in: Array.from(serviceIds) }
                   }
                })
                
                if (advancesToCreate.length > 0) {
                   await prisma.advanceMonthly.createMany({
                      data: advancesToCreate
                   })
                   summary.advances = { created: advancesToCreate.length, updated: 0, total: advancesToCreate.length }
                   await log(`[Předpis] Hromadně vloženo ${advancesToCreate.length} záznamů záloh.`)
                }
             }

          } else {
          // --- STARÁ LOGIKA (FALLBACK) ---
          const fakturySheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'faktury')
          
          // Zkusíme najít názvy služeb přímo v hlavičce listu "Předpis po mesici"
          // Předpokládáme, že v prvním řádku (index 0) jsou názvy služeb nad bloky měsíců
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
             
             const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ')
             
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

                // Předpokládáme, že měsíce začínají pod názvem služby nebo o 1 sloupec vedle?
                // Stará logika: 1 + (i * 13) + 12 = Celkem. Tedy blok má 13 sloupců.
                // Pokud je název služby v prvním sloupci bloku (Leden), tak měsíce jsou colIndex, colIndex+1...
                // Pokud je název služby nad "Celkem" (což je nepravděpodobné), tak musíme couvat.
                // Většinou je název služby sloučený přes buňky nad měsíci.
                // Excel parser vrátí hodnotu v první buňce sloučené oblasti.
                // Takže colInfo.colIndex je začátek bloku.
                
                // Zkusíme ověřit, zda pod tím jsou čísla 1..12
                // Řádek 1 (index 1) by měl obsahovat měsíce
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

                   // Smazat starý souhrnný záznam
                   try {
                      await prisma.advanceMonthly.delete({
                         where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: service.id, year: periodYear, month: 0 } }
                      })
                   } catch {}

                   for (let month = 1; month <= 12; month++) {
                      const monthColIndex = startMonthColIndex + (month - 1)
                      let amount = 0
                      if (monthColIndex < unitRow.length) {
                         amount = parseFloat(String(unitRow[monthColIndex] ?? '').replace(',', '.').replace(/\s/g, '')) || 0
                      }

                      if (amount > 0) {
                         await prisma.advanceMonthly.upsert({
                            where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: service.id, year: periodYear, month } },
                            update: { amount },
                            create: { unitId: unit.id, serviceId: service.id, year: periodYear, month, amount }
                         })
                         summary.advances.updated++
                      } else {
                         try {
                            await prisma.advanceMonthly.delete({
                               where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: service.id, year: periodYear, month } }
                            })
                         } catch {}
                      }
                   }
                }
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

            const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ')
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
                
                // Smazat starý souhrnný záznam (month=0), pokud existuje, abychom neměli duplicity
                try {
                  await prisma.advanceMonthly.delete({
                    where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month: 0 } }
                  })
                  } catch {
                    // Ignorovat chybu, pokud záznam neexistuje
                  }                for (let month = 1; month <= 12; month++) {
                  // Měsíce jsou před sloupcem Celkem.
                  // Leden (1) je o 12 sloupců zpět (offset 12)
                  // Prosinec (12) je o 1 sloupec zpět (offset 1)
                  const monthOffset = 13 - month
                  const monthColIndex = celkemColIndex - monthOffset
                  
                  let amount = 0
                  if (monthColIndex >= 0 && monthColIndex < unitRow.length) {
                    amount = parseFloat(String(unitRow[monthColIndex] ?? '').replace(',', '.').replace(/\s/g, '')) || 0
                  }

                  if (amount > 0) {
                    await prisma.advanceMonthly.upsert({
                      where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month } },
                      update: { amount },
                      create: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month, amount }
                    })
                    summary.advances.updated++ // Nerozlišujeme přesně created/updated u upsertu v tomto kontextu
                  } else {
                     // Pokud je částka 0, smažeme existující záznam
                     try {
                       await prisma.advanceMonthly.delete({
                          where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month } }
                       })
                       summary.advances.updated++
                     } catch {}
                  }
                }
              }
            }
            summary.advances.total = summary.advances.created + summary.advances.updated
          }
          } // End of else (fallback)
        } catch (e) {
          summary.errors.push(`Předpisy: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      // 7b. IMPORT PŘEDPISŮ (CELKEM - Predpisy_celkem)
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
            
            // Zkusíme najít řádek, kde je "1", "2", "3"...
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

      // 8. NÁKLADY NA DŮM
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
