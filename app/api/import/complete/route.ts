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
            } else {
              // Pokud se název liší (např. v DB je "318/01" a v Excelu "Jednotka č. 318/01"), aktualizujeme na plný název
              if (unit.unitNumber !== unitNumber) {
                await prisma.unit.update({
                  where: { id: unit.id },
                  data: { unitNumber: unitNumber }
                })
                unit.unitNumber = unitNumber
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

          let service = await prisma.service.findFirst({ where: { buildingId: building.id, name: METER_TYPE_LABELS[meterType] } })
          if (!service) {
            service = await prisma.service.create({
              data: { buildingId: building.id, name: METER_TYPE_LABELS[meterType], code: meterType, methodology: 'METER_READING', measurementUnit: meterType === 'HEATING' ? 'kWh' : 'm³', isActive: true }
            })
            summary.services.created++
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
              const existing = await prisma.personMonth.findUnique({ where: { unitId_year_month: { unitId: (unit as UnitLite).id, year, month } } })
              if (!existing) {
                await prisma.personMonth.create({ data: { unitId: (unit as UnitLite).id, year, month, personCount } })
                personMonthsCreated++
              }
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
          
          const fakturySheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'faktury')
          if (fakturySheetName && periodYear) {
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
                } catch (e) {
                  // Ignorovat chybu, pokud záznam neexistuje
                }

                for (let month = 1; month <= 12; month++) {
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
                    const existing = await prisma.advanceMonthly.findUnique({
                      where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month } }
                    }).catch(() => null)

                    if (!existing) {
                      await prisma.advanceMonthly.create({
                        data: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month, amount }
                      })
                      summary.advances.created++
                    } else {
                      await prisma.advanceMonthly.update({ where: { id: existing.id }, data: { amount } })
                      summary.advances.updated++
                    }
                  } else {
                     // Pokud je částka 0, ale existuje záznam, měli bychom ho smazat nebo nastavit na 0?
                     // Raději nastavíme na 0, aby bylo jasné, že tam nic není.
                     // Nebo smažeme, aby to nezabíralo místo.
                     // Pro konzistenci s "upsert" logikou výše, pokud je 0, neděláme nic (nebo bychom mohli smazat).
                     // Ale pokud uživatel opravuje import a změnil částku na 0, měli bychom to reflektovat.
                     const existing = await prisma.advanceMonthly.findUnique({
                      where: { unitId_serviceId_year_month: { unitId: unit.id, serviceId: mapping.serviceId, year: periodYear, month } }
                    }).catch(() => null)
                    
                    if (existing) {
                       await prisma.advanceMonthly.delete({ where: { id: existing.id } })
                       summary.advances.updated++
                    }
                  }
                }
              }
            }
            summary.advances.total = summary.advances.created + summary.advances.updated
          }
        } catch (e) {
          summary.errors.push(`Předpisy: ${e instanceof Error ? e.message : String(e)}`)
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
