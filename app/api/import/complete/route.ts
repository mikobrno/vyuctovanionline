import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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

function columnIndexToLetter(index: number) {
  let column = ''
  let n = index + 1
  while (n > 0) {
    const remainder = (n - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    n = Math.floor((n - 1) / 26)
  }
  return column
}

function parseNumberCell(value: string | undefined) {
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
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

type UnitLite = { id: string; meters?: { id: string; type: Prisma.MeterType; isActive: boolean }[]; variableSymbol?: string }

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const buildingName = (formData.get('buildingName') as string) || ''
    const year = (formData.get('year') as string) || ''

    if (!file) {
      return NextResponse.json({
        success: false,
        message: 'Soubor s vyúčtováním nebyl přiložen. Nahrajte prosím XLS/XLSX soubor.'
      }, { status: 400 })
    }

    // Next.js může vrátit hodnotu jako Blob místo File – převedeme na File kvůli názvu/validaci
    const fileObj = file instanceof File ? file : new File([file as unknown as Blob], 'upload.xlsx', { type: ((file as unknown) as Blob).type || 'application/octet-stream' })

    // Rok lze odvodit z Excelu (Vstupní data!B12), proto není povinný v parametru

    if (fileObj.size === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Nahraný soubor je prázdný. Zkontrolujte prosím, že v něm jsou data.' 
      }, { status: 400 })
    }

    if (fileObj.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        success: false, 
        message: 'Soubor je příliš velký (limit 10 MB). Rozdělte ho prosím na menší části.' 
      }, { status: 413 })
    }

    if (!/\.xlsx?$/i.test(fileObj.name)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Nepodporovaný formát souboru. Nahrajte prosím soubor typu XLS nebo XLSX.' 
      }, { status: 400 })
    }

    const buffer = Buffer.from(await fileObj.arrayBuffer())
    const workbook = read(buffer, { type: 'buffer' })

    const summary: ImportSummary = {
      building: { id: '', name: '', created: false },
      units: { created: 0, existing: 0, total: 0 },
      owners: { created: 0, existing: 0, total: 0 },
      services: { created: 0, existing: 0, total: 0 },
      costs: { created: 0, total: 0 },
      readings: { created: 0, total: 0, details: [] },
      payments: { created: 0, total: 0 },
      costsByService: [],
      advances: { created: 0, updated: 0, total: 0 },
      errors: [],
      warnings: []
    }

    // Akumulované logy pro zobrazení v UI
    const logs: string[] = []
    const log = (msg: string) => { logs.push(msg); console.log(msg) }

    // 1. NAJÍT NEBO VYTVOŘIT DŮM
    const finalBuildingName = buildingName || 'Importovaná budova ' + new Date().toLocaleDateString('cs-CZ')
    
    // Načíst adresu a období ze záložky "Vstupní data"
    let buildingAddress = 'Adresu upravte v detailu budovy'
    let billingPeriod = year || String(new Date().getFullYear())
    
    const inputDataSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('vstupní') || name.toLowerCase().includes('vstupni') || name.toLowerCase().includes('input')
    )
    
    let managerName: string | null = null
    
    if (inputDataSheetName) {
      const inputSheet = workbook.Sheets[inputDataSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(inputSheet, { header: 1, defval: '' })
      
      // B3 = row index 2, column index 1 (adresa)
      if (rawData.length > 2 && rawData[2] && rawData[2][1]) {
        const addressValue = String(rawData[2][1]).trim()
        if (addressValue) {
          buildingAddress = addressValue
        }
      }
      
      // B12 = row index 11, column index 1 (období)
      if (rawData.length > 11 && rawData[11] && rawData[11][1]) {
        const periodValue = String(rawData[11][1]).trim()
        if (periodValue) {
          // Očekáváme formát RRRR nebo číslo roku
          const periodMatch = periodValue.match(/(\d{4})/)
          if (periodMatch) {
            billingPeriod = periodMatch[1]
            log(`[Import] Načteno období z B12: ${billingPeriod}`)
          }
        }
      }
      
      // B34 = row index 33, column index 1 (správce)
      if (rawData.length > 33 && rawData[33] && rawData[33][1]) {
        managerName = String(rawData[33][1]).trim() || null
        if (managerName) {
          log(`[Import] Načten správce z B34: ${managerName}`)
        }
      }
    }
    
    let building = await prisma.building.findFirst({
      where: {
        name: {
          contains: finalBuildingName,
          mode: 'insensitive'
        }
      }
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

    summary.building.id = building.id
    summary.building.name = building.name

    // 2. IMPORT VLASTNÍKŮ ZE ZÁLOŽKY "EVIDENCE"
    const evidenceSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('evidence') || name.toLowerCase().includes('evidenc')
    )

    const ownerMap = new Map<string, { id: string; firstName: string; lastName: string }>()
    
    // Načíst oslovení ze záložky "Export_Send_Mail"
    const salutationMap = new Map<string, string>()
    const exportSendMailSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().replace(/[\s_-]/g, '').includes('exportsendmail') ||
      (name.toLowerCase().includes('export') && name.toLowerCase().includes('send'))
    )
    
    if (exportSendMailSheetName) {
      const exportSheet = workbook.Sheets[exportSendMailSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(exportSheet, { header: 1, defval: '' })
      
      // Najít řádek s hlavičkou
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('jednotka') || cellStr.includes('byt')
        })
      )
      
      if (headerRowIndex !== -1) {
        const dataRows = rawData.slice(headerRowIndex + 1)
        log(`[Export_Send_Mail] Zpracovávám ${dataRows.length} řádků oslovení`)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0) continue
          
          const unitNumber = String(row[0] || '').trim() // sloupec A
          const salutation = String(row[13] || '').trim() // sloupec N (index 13)
          
          if (unitNumber && salutation) {
            salutationMap.set(unitNumber, salutation)
          }
        }
        log(`[Export_Send_Mail] Načteno ${salutationMap.size} oslovení`)
      }
    } else {
      log('[Import] Záložka "Export_Send_Mail" nebyla nalezena.')
    }

    if (evidenceSheetName) {
      const evidenceSheet = workbook.Sheets[evidenceSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(evidenceSheet, { header: 1, defval: '' })
      
      // Najít řádek s hlavičkou
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('jméno') || cellStr.includes('jmeno') || cellStr.includes('příjmení') || cellStr.includes('prijmeni')
        })
      )

      if (headerRowIndex !== -1) {
        const dataRows = rawData.slice(headerRowIndex + 1)
        log(`[Evidence] Zpracovávám ${dataRows.length} řádků vlastníků`)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[1]) continue
          
          const unitNumber = String(row[0] || '').trim()
          const fullName = String(row[1] || '').trim()
          const address = String(row[2] || '').trim()
          const email = String(row[3] || '').trim() // sloupec D (index 3)
          const phone = String(row[4] || '').trim()
          
          if (!fullName || !unitNumber) continue

          // Rozdělit jméno na křestní jméno a příjmení
          const nameParts = fullName.split(' ')
          const lastName = nameParts.pop() || ''
          const firstName = nameParts.join(' ') || lastName
          
          // Získat oslovení pro tuto jednotku
          const salutation = salutationMap.get(unitNumber) || null

          // Zkontrolovat, zda vlastník již existuje (podle jména a emailu)
          let owner = await prisma.owner.findFirst({
            where: {
              OR: [
                { email: email || undefined },
                {
                  AND: [
                    { firstName: { equals: firstName, mode: 'insensitive' } },
                    { lastName: { equals: lastName, mode: 'insensitive' } }
                  ]
                }
              ]
            }
          })

          if (!owner) {
            owner = await prisma.owner.create({
              data: {
                firstName,
                lastName,
                email: email || null,
                phone: phone || null,
                address: address || null,
                salutation: salutation
              }
            })
            summary.owners.created++
            log(`[Evidence] Vytvořen vlastník: ${firstName} ${lastName}`)
          } else {
            // Aktualizovat oslovení pokud bylo načteno
            if (salutation && owner.salutation !== salutation) {
              await prisma.owner.update({
                where: { id: owner.id },
                data: { salutation }
              })
            }
            summary.owners.existing++
          }
          summary.owners.total++

          // Uložit mapování jednotka -> vlastník
          ownerMap.set(unitNumber, { id: owner.id, firstName, lastName })
        }
      } else {
        summary.warnings.push('Na listu "Evidence" nebyla nalezena hlavička s vlastníky.')
      }
    } else {
      summary.warnings.push('Záložka "Evidence" nebyla nalezena. Vlastníci nebudou importováni.')
    }

    // 3. IMPORT FAKTUR (NÁKLADŮ)
    const invoicesSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('faktur') || name.toLowerCase().includes('invoice')
    )

    if (invoicesSheetName) {
      const invoicesSheet = workbook.Sheets[invoicesSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(invoicesSheet, { header: 1, defval: '' })

      // Najdi hlavičku podle textu sloupců
      const headerRowIndex = rawData.findIndex(row => {
        const norm = (row as unknown[]).map(c => normalizeHeaderCell(String(c ?? '')))
        const hasMethod = norm.some(c => /zpusob|metod|rozuct/.test(c))
        const hasAmount = norm.some(c => /naklad.*rok|naklad za rok|celkem.*rok/.test(c))
        return hasMethod && hasAmount
      })

      if (headerRowIndex !== -1) {
        const header = (rawData[headerRowIndex] || []).map(c => String(c ?? ''))
        const normHeader = header.map(c => normalizeHeaderCell(c))
        const findIdx = (...pats: RegExp[]) => normHeader.findIndex(h => pats.some(p => p.test(h)))

        const idxService = findIdx(/sluzb|polozk|popis|nazev/) >= 0 ? findIdx(/sluzb|polozk|popis|nazev/) : 0
        const idxMethod = findIdx(/zpusob|metod|rozuct/)
        const idxAmountSpecific = findIdx(/naklad.*rok|naklad za rok/)
        const idxAmountFallback = findIdx(/naklad|celkem/)
        const idxAmount = idxAmountSpecific >= 0 ? idxAmountSpecific : idxAmountFallback

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

          // Najít nebo vytvořit službu
          let service = await prisma.service.findFirst({
            where: { buildingId: building.id, name: { equals: serviceName, mode: 'insensitive' } }
          })

          const m = methodology.toLowerCase()
          const calculationMethod = m.includes('měřidl') || m.includes('odečet') ? 'METER_READING' :
                                    (m.includes('plocha') || m.includes('výměr') || m.includes('vyměr')) ? 'AREA' :
                                    (m.includes('osob') || m.includes('osobo')) ? 'PERSON_MONTHS' :
                                    (m.includes('byt') || m.includes('jednotk')) ? 'FIXED_PER_UNIT' :
                                    m.includes('rovn') ? 'EQUAL_SPLIT' :
                                    (m.includes('podil') || m.includes('podíl')) ? 'OWNERSHIP_SHARE' : 'OWNERSHIP_SHARE'

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
            const baseCode = serviceName.substring(0, 10).toUpperCase().replace(/\s/g, '_').replace(/[^A-Z0-9_]/g, '')
            let uniqueCode = baseCode
            let counter = 1
            while (await prisma.service.findFirst({ where: { buildingId: building.id, code: uniqueCode } })) {
              uniqueCode = `${baseCode}_${counter++}`
            }
            service = await prisma.service.create({
              data: {
                buildingId: building.id,
                name: serviceName,
                code: uniqueCode,
                methodology: calculationMethod as Prisma.CalculationMethod,
                dataSourceType: (src.dataSourceType as Prisma.DataSourceType) ?? undefined,
                unitAttributeName: src.unitAttributeName ?? undefined,
                measurementUnit: src.measurementUnit ?? undefined,
                isActive: true,
                order: summary.services.total
              }
            })
            summary.services.created++
          } else {
            await prisma.service.update({
              where: { id: service.id },
              data: {
                methodology: calculationMethod as Prisma.CalculationMethod,
                dataSourceType: (src.dataSourceType as Prisma.DataSourceType) ?? undefined,
                unitAttributeName: src.unitAttributeName ?? undefined,
                measurementUnit: src.measurementUnit ?? undefined,
              }
            })
            summary.services.existing++
          }
          summary.services.total++

          await prisma.cost.create({
            data: {
              buildingId: building.id,
              serviceId: service.id,
              amount,
              description: `Import z Excelu - ${serviceName}`,
              invoiceDate: new Date(`${billingPeriod}-12-31`),
              period: parseInt(billingPeriod)
            }
          })
          summary.costs.created++
          summary.costs.total++
        }
      } else {
        summary.warnings.push(`Na listu "${invoicesSheetName}" se nepodařilo najít hlavičku (očekáváno např. \"Způsob rozúčtování\", \"Náklad za rok\").`)
      }
    } else {
      summary.warnings.push('Záložka "Faktury" nebyla nalezena. Náklady nebyly importovány.')
    }

    // 3. IMPORT ODEČTŮ
    const unitMap = new Map<string, UnitLite>()
    
    for (const sheetName of workbook.SheetNames) {
      const normalizedSheetName = sheetName.toLowerCase().trim()
      const meterType = SHEET_TO_METER_TYPE[normalizedSheetName]

      if (!meterType) continue

      const sheet = workbook.Sheets[sheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('byt') || cellStr.includes('jednotka') || cellStr.includes('m³') || cellStr.includes('kwh')
        })
      )

      if (headerRowIndex === -1) {
        summary.warnings.push(`${sheetName}: Nepodařilo se najít hlavičku s odečty. Zkontrolujte, že list obsahuje sloupce 'Byt' nebo 'Jednotka'.`)
        continue
      }

      const headerRowCells = rawData[headerRowIndex] || []
      const simplified = headerRowCells.map((cell: unknown) => normalizeHeaderCell(String(cell ?? '')))

      const findColumn = (patterns: RegExp[]) =>
        simplified.findIndex(cell => patterns.some(p => p.test(cell)))

      const buildDescriptor = (idx: number, originalHeaders: unknown[]) => {
        if (idx < 0) return null
        return {
          letter: columnIndexToLetter(idx),
          number: idx + 1,
          header: String((originalHeaders as unknown[])[idx] ?? '')
        }
      }

      const initialCol = findColumn([/pocatecni/, /start/, /initial/])
      const finalCol = findColumn([/odecet/, /final/, /konec/])
      const consumptionCol = findColumn([/spotreba/, /odectena/, /consumption/])
      const costCol = findColumn([/naklad/, /naklad za rok/, /rocni/, /celkem/])
      const moduleCol = findColumn([/radio/, /modul/, /radiovy/])
      const idCol = findColumn([/^id$/, /identifikace/, /cislo modulu/])

      const initialIdx = initialCol >= 0 ? initialCol : (meterType === 'HEATING' ? 5 : 6)
      const finalIdx = finalCol >= 0 ? finalCol : (meterType === 'HEATING' ? 6 : 7)
      const consumptionIdx = consumptionCol >= 0 ? consumptionCol : 8

      const colMeta = {
        unit: buildDescriptor(0, headerRowCells),
        meter: buildDescriptor(1, headerRowCells),
        initialReading: buildDescriptor(initialIdx, headerRowCells),
        finalReading: buildDescriptor(finalIdx, headerRowCells),
        consumption: buildDescriptor(consumptionIdx, headerRowCells),
        yearlyCost: costCol >= 0 ? buildDescriptor(costCol, headerRowCells) : undefined,
        radioModule: moduleCol >= 0 ? buildDescriptor(moduleCol, headerRowCells) : undefined,
        externalId: idCol >= 0 ? buildDescriptor(idCol, headerRowCells) : undefined
      }

      if (colMeta.unit && colMeta.meter && colMeta.initialReading && colMeta.consumption) {
        const columns = {
          unit: colMeta.unit,
          meter: colMeta.meter,
          initialReading: colMeta.initialReading ?? undefined,
          finalReading: colMeta.finalReading ?? undefined,
          consumption: colMeta.consumption ?? undefined,
          yearlyCost: colMeta.yearlyCost ?? undefined,
          radioModule: colMeta.radioModule ?? undefined,
          externalId: colMeta.externalId ?? undefined,
        }
        summary.readings.details?.push({
          sheetName,
          columns: columns as {
            unit: { letter: string; number: number; header: string }
            meter: { letter: string; number: number; header: string }
            initialReading?: { letter: string; number: number; header: string }
            finalReading?: { letter: string; number: number; header: string }
            consumption?: { letter: string; number: number; header: string }
            yearlyCost?: { letter: string; number: number; header: string }
            radioModule?: { letter: string; number: number; header: string }
            externalId?: { letter: string; number: number; header: string }
          }
        })
      }

      const dataRows = rawData.slice(headerRowIndex + 1)
      log(`[${sheetName}] Zpracovávám ${dataRows.length} řádků odečtů`)

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        if (!row || row.length === 0 || !row[0]) continue

        const unitNumber = String(row[0] || '').trim()
        const ownerName = String(row[1] || '').trim()

        const initialReading = parseNumberCell(String(row[initialIdx] || '')) ?? 0
        const finalReading = parseNumberCell(String(row[finalIdx] || '')) ?? 0
        let consumption = parseNumberCell(String(row[consumptionIdx] || '')) ?? 0

        // Optional columns parsed above nejsou dále používány

        // Vypočítat spotřebu, pokud není zadaná
        if (consumption === 0 && finalReading > initialReading) {
          consumption = finalReading - initialReading
        }

        // Přeskočit neplatné řádky
        if (!unitNumber || unitNumber === 'Bazén' || unitNumber.toLowerCase().includes('celkem')) continue
        if (consumption <= 0) {
          log(`[${sheetName}] Přeskakuji jednotku ${unitNumber} - nulová spotřeba`)
          continue
        }

        // Najít nebo vytvořit jednotku
        let unit = unitMap.get(unitNumber)
        
        if (!unit) {
          const found = await prisma.unit.findFirst({
            where: {
              buildingId: building.id,
              unitNumber
            },
            include: { meters: true }
          })

          if (!found) {
            const created = await prisma.unit.create({
              data: {
                buildingId: building.id,
                unitNumber,
                type: 'APARTMENT',
                shareNumerator: 100,
                shareDenominator: 10000,
                totalArea: 50,
                variableSymbol: unitNumber.replace(/[^0-9]/g, ''),
              },
              include: { meters: true }
            })
            unit = { id: created.id, meters: created.meters, variableSymbol: created.variableSymbol || undefined }
            summary.units.created++

            // Vytvořit vazbu vlastník -> jednotka, pokud existuje
            const owner = ownerMap.get(unitNumber)
            if (owner) {
              await prisma.ownership.create({
                data: {
                  unitId: unit.id,
                  ownerId: owner.id,
                  validFrom: new Date(`${billingPeriod}-01-01`),
                  sharePercent: 100
                }
              })
              log(`[Ownership] Přiřazen vlastník ${owner.firstName} ${owner.lastName} k jednotce ${unitNumber}`)
            }
          } else {
            unit = { id: found.id, meters: found.meters }
            summary.units.existing++
          }
          summary.units.total++
          if (unit) unitMap.set(unitNumber, unit)
        }

        // Najít nebo vytvořit službu pro měřidlo
        let service = await prisma.service.findFirst({
          where: {
            buildingId: building.id,
            name: METER_TYPE_LABELS[meterType]
          }
        })

        if (!service) {
          service = await prisma.service.create({
            data: {
              buildingId: building.id,
              name: METER_TYPE_LABELS[meterType],
              code: meterType,
              methodology: 'METER_READING',
              measurementUnit: meterType === 'HEATING' ? 'kWh' : meterType.includes('WATER') ? 'm³' : 'kWh',
              isActive: true
            }
          })
          summary.services.created++
          summary.services.total++
        }

        // Najít nebo vytvořit měřidlo
        let meter = unit.meters?.find((m: { id: string; type: Prisma.MeterType; isActive: boolean }) => m.type === meterType && m.isActive)

        if (!meter) {
          meter = await prisma.meter.create({
            data: {
              unitId: unit.id,
              serialNumber: `${unitNumber}-${meterType}`,
              type: meterType as Prisma.MeterType,
              initialReading,
              serviceId: service.id,
              isActive: true,
              installedAt: new Date(`${billingPeriod}-01-01`)
            }
          })
        }

        // Vytvořit odečet - použít období z B12
        await prisma.meterReading.create({
          data: {
            meterId: (meter as { id: string }).id,
            readingDate: new Date(`${billingPeriod}-12-31`),
            value: finalReading,
            consumption,
            period: parseInt(billingPeriod),
            note: `Import z Excelu - ${ownerName}`
          }
        })
        summary.readings.created++
        summary.readings.total++
      }
    }

    // 4. IMPORT PLATEB (ÚHRAD)
    const paymentsSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('úhrad') || name.toLowerCase().includes('uhrad') || name.toLowerCase().includes('platb')
    )

    if (paymentsSheetName) {
      const paymentsSheet = workbook.Sheets[paymentsSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(paymentsSheet, { header: 1, defval: '' })
      
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('měsíc') || cellStr.includes('byt') || cellStr.includes('jednotka') || cellStr === '01' || cellStr === '1'
        })
      )

      if (headerRowIndex !== -1) {
        const dataRows = rawData.slice(headerRowIndex + 1)
        log(`[${paymentsSheetName}] Zpracovávám ${dataRows.length} řádků plateb`)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[0]) continue
          
          const unitNumber = String(row[0] || '').trim()
          if (!unitNumber || unitNumber === 'Bazén' || unitNumber.toLowerCase().includes('celkem')) continue

          console.log(`[Platby] Zpracovávám jednotku ${unitNumber}`)

          // Najít jednotku
          let unit = unitMap.get(unitNumber)
          if (!unit) {
            const foundUnit = await prisma.unit.findFirst({
              where: {
                buildingId: building.id,
                unitNumber
              }
            })

            if (!foundUnit) {
              const createdUnit = await prisma.unit.create({
                data: {
                  buildingId: building.id,
                  unitNumber,
                  type: 'APARTMENT',
                  shareNumerator: 100,
                  shareDenominator: 10000,
                  totalArea: 50,
                  variableSymbol: unitNumber.replace(/[^0-9]/g, ''),
                }
              })
              unit = { id: createdUnit.id, variableSymbol: createdUnit.variableSymbol || undefined }
              summary.units.created++
              summary.units.total++
            } else {
              unit = { id: foundUnit.id, variableSymbol: foundUnit.variableSymbol || undefined }
              if (!unitMap.has(unitNumber)) {
                summary.units.existing++
                summary.units.total++
              }
            }
            if (unit) unitMap.set(unitNumber, unit)
          }

          // Projít měsíce (sloupce B-M = indexy 1-12)
          for (let month = 1; month <= 12; month++) {
            const amountStr = String(row[month] || '0').trim()
            const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
            
            if (isNaN(amount) || amount === 0) continue

            console.log(`[Platby] Jednotka ${unitNumber}, měsíc ${month}: ${amount} Kč`)

            // Vytvořit platbu pro daný měsíc - použít období z B12
            const paymentDate = new Date(parseInt(billingPeriod), month - 1, 15)
            
            const unitLite = unit as UnitLite
            const vs = unitLite.variableSymbol || unitNumber.replace(/[^0-9]/g, '') || `U${unitLite.id.slice(-6)}`
            await prisma.payment.create({
              data: {
                unitId: unitLite.id,
                amount,
                paymentDate,
                variableSymbol: vs,
                period: parseInt(billingPeriod),
                description: `Úhrada záloh ${month.toString().padStart(2, '0')}/${billingPeriod}`
              }
            })
            summary.payments.created++
            summary.payments.total++
          }
        }
      } else {
        summary.warnings.push('Na listu "' + paymentsSheetName + '" nebyla nalezena hlavička s platbami.')
      }
    } else {
      summary.warnings.push('Záložka "Úhrady" nebyla nalezena. Platby nebyly importovány.')
    }

    // 6. IMPORT POČTU OSOB (OSOBO-MĚSÍCŮ) ZE ZÁLOŽKY "EVIDENCE"
    if (evidenceSheetName) {
      const evidenceSheet = workbook.Sheets[evidenceSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(evidenceSheet, { header: 1, defval: '' })
      
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('jednotka') || cellStr.includes('byt')
        })
      )

      if (headerRowIndex !== -1) {
        // Najít sloupce: N = Počet osob (index 13), O = Evidence od (index 14), P = Evidence do (index 15)
        const personCountIdx = 13  // sloupec N
        const evidenceFromIdx = 14 // sloupec O
        const evidenceToIdx = 15   // sloupec P
        
        const dataRows = rawData.slice(headerRowIndex + 1)
        log(`[Evidence - Osoby] Zpracovávám ${dataRows.length} řádků`)
        
        let personMonthsCreated = 0
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[0]) continue
          
          const unitNumber = String(row[0] || '').trim()
          const personCountStr = String(row[personCountIdx] || '0').trim()
          const evidenceFrom = row[evidenceFromIdx] // datum od
          const evidenceTo = row[evidenceToIdx]     // datum do
          
          if (!unitNumber) continue
          
          const personCount = parseInt(personCountStr) || 0
          if (personCount === 0) continue
          
          // Najít jednotku
          let unit = unitMap.get(unitNumber)
          if (!unit) {
            const foundUnit = await prisma.unit.findFirst({
              where: {
                buildingId: building.id,
                unitNumber
              }
            })
            if (foundUnit) {
              unit = { id: foundUnit.id }
              unitMap.set(unitNumber, unit)
            }
          }
          
          if (!unit) {
            summary.warnings.push(`Evidence - Osoby: Jednotka ${unitNumber} nebyla nalezena`)
            continue
          }
          
          // Aktualizovat počet obyvatel v Unit
          await prisma.unit.update({
            where: { id: (unit as UnitLite).id },
            data: { residents: personCount }
          })
          
          // Pokud jsou zadána data Evidence od/do, vypočítat měsíce
          let startDate: Date | null = null
          let endDate: Date | null = null
          
          // Parsovat datum Evidence od
          if (evidenceFrom) {
            if (typeof evidenceFrom === 'number') {
              // Excel serial date
              const excelEpoch = new Date(1900, 0, 1)
              startDate = new Date(excelEpoch.getTime() + (evidenceFrom - 2) * 24 * 60 * 60 * 1000)
            } else if (evidenceFrom instanceof Date) {
              startDate = evidenceFrom
            } else {
              const dateStr = String(evidenceFrom).trim()
              if (dateStr) {
                startDate = new Date(dateStr)
              }
            }
          }
          
          // Parsovat datum Evidence do
          if (evidenceTo) {
            if (typeof evidenceTo === 'number') {
              const excelEpoch = new Date(1900, 0, 1)
              endDate = new Date(excelEpoch.getTime() + (evidenceTo - 2) * 24 * 60 * 60 * 1000)
            } else if (evidenceTo instanceof Date) {
              endDate = evidenceTo
            } else {
              const dateStr = String(evidenceTo).trim()
              if (dateStr) {
                endDate = new Date(dateStr)
              }
            }
          }
          
          // Pokud nejsou data, použít celý rok
          if (!startDate) {
            startDate = new Date(parseInt(billingPeriod), 0, 1) // 1.1.
          }
          if (!endDate) {
            endDate = new Date(parseInt(billingPeriod), 11, 31) // 31.12.
          }
          
          // Vytvořit PersonMonth záznamy pro každý měsíc v období
          const currentDate = new Date(startDate)
          while (currentDate <= endDate) {
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth() + 1
            
            // Zkontrolovat, zda záznam již existuje
            const existing = await prisma.personMonth.findUnique({
              where: {
                unitId_year_month: {
                  unitId: (unit as UnitLite).id,
                  year,
                  month
                }
              }
            })
            
            if (!existing) {
              await prisma.personMonth.create({
                data: {
                  unitId: (unit as UnitLite).id,
                  year,
                  month,
                  personCount
                }
              })
              personMonthsCreated++
            }
            
            // Posunout o měsíc
            currentDate.setMonth(currentDate.getMonth() + 1)
          }
          
          console.log(`[Evidence - Osoby] Jednotka ${unitNumber}: ${personCount} osob, od ${startDate.toLocaleDateString('cs-CZ')} do ${endDate.toLocaleDateString('cs-CZ')}`)
        }
        
        log(`[Evidence - Osoby] Vytvořeno ${personMonthsCreated} záznamů osobo-měsíců`)
        summary.warnings.push(`Importováno ${personMonthsCreated} záznamů počtu osob`)
      }
    }

    // 7. IMPORT PŘEDPISU ZÁLOH ZE ZÁLOŽKY "PŘEDPIS PO MĚSÍCI"
    const advancesSheetName = workbook.SheetNames.find(name => {
      const n = name.toLowerCase()
      return n.includes('předpis') || n.includes('predpis') || n.includes('měsíc') || n.includes('mesic') || n.includes('advance')
    })

    if (advancesSheetName) {
      const advancesSheet = workbook.Sheets[advancesSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(advancesSheet, { header: 1, defval: '' })

      // Najdi řádek se sloupci měsíců (obsahuje mnoho hodnot 1..12)
      const monthRx = /^(0?[1-9]|1[0-2])$|leden|unor|únor|brezen|březen|duben|kveten|květen|cervenec|červenec|cerven|červen|srpen|zari|září|rijen|říjen|listopad|prosinec/
      const headerRowIndex = rawData.findIndex(row => {
        const norm = (row as unknown[]).map(c => normalizeHeaderCell(String(c ?? '')))
        const matched = norm.filter(c => monthRx.test(c)).length
        return matched >= 6
      })

      if (headerRowIndex !== -1) {
        const header = rawData[headerRowIndex] || []
        const norm = (header as unknown[]).map(c => normalizeHeaderCell(String(c ?? '')))

        // Heuristika pro sloupec jednotky: najdi sloupec s nejvíce neprázdnými stringy v následujících řádcích
        let unitIdx = 0
        let bestScore = -1
        for (let col = 0; col < norm.length; col++) {
          let score = 0
          for (let r = headerRowIndex + 1; r < Math.min(rawData.length, headerRowIndex + 40); r++) {
            const v = rawData[r]?.[col]
            if (v && isNaN(Number(String(v).replace(/\s/g, '')))) score++
          }
          if (score > bestScore) { bestScore = score; unitIdx = col }
        }

        // Řádek s názvy služeb bývá nad řádkem s měsíci (kvůli sloučení buněk)
        const labelRowIndexCandidates = [headerRowIndex - 1, headerRowIndex - 2]
        let labelRowIndex = labelRowIndexCandidates.find(i => i >= 0 && rawData[i] && (rawData[i] as unknown[]).some(c => String(c ?? '').trim() !== ''))
        if (typeof labelRowIndex !== 'number') labelRowIndex = headerRowIndex - 1
        const labelRow = (rawData[labelRowIndex] || []) as unknown[]
        const labelNorm = labelRow.map(c => normalizeHeaderCell(String(c ?? '')))

        type ServiceBlock = { name: string; startCol: number; monthCols: number[] }
        const blocks: ServiceBlock[] = []

        // Najdi začátky bloků: sloupec, kde je v hlavičce "1" a v řádku nad tím nějaký název
        for (let c = unitIdx + 1; c < norm.length; c++) {
          const h = norm[c]
          if (/^(0?1|leden)$/.test(h)) {
            // Název služby – vezmi buď přímo v tomto sloupci, nebo nejbližší nenulový vlevo v labelNorm
            let serviceName = labelNorm[c] || ''
            if (!serviceName) {
              for (let k = c; k >= unitIdx + 1; k--) {
                if (labelNorm[k]) { serviceName = labelNorm[k]; break }
              }
            }
            serviceName = serviceName || 'Neznama sluzba'

            // Vytvoř mapu 12 měsíců (očekáváme sekvenci 1..12)
            const monthCols: number[] = []
            for (let m = 0; m < 12; m++) {
              const col = c + m
              const hv = normalizeHeaderCell(String(norm[col] ?? ''))
              const expected = String(m + 1)
              if (hv === expected || hv === expected.padStart(2, '0') || monthRx.test(hv)) {
                monthCols.push(col)
              }
            }
            if (monthCols.length >= 6) {
              blocks.push({ name: serviceName, startCol: c, monthCols })
              // posuň se za blok
              c += Math.max(0, monthCols.length - 1)
            }
          }
        }

        log(`[Předpis] Nalezeno ${blocks.length} bloků služeb`)
        const dataRows = rawData.slice(headerRowIndex + 1)
        let advancesCreated = 0
        let advancesUpdated = 0

        const normName = (s: string) => normalizeHeaderCell(s)
        const existingServices = await prisma.service.findMany({ where: { buildingId: building.id } })
        const getService = async (name: string) => {
          const n = normName(name)
          let svc = existingServices.find((s: { name: string }) => normName(s.name) === n || normName(s.name).includes(n) || n.includes(normName(s.name)))
          if (svc) return svc
          // vytvoř pokud chybí
          const baseCode = name.substring(0, 10).toUpperCase().replace(/\s/g, '_').replace(/[^A-Z0-9_]/g, '')
          let uniqueCode = baseCode; let cnt = 1
          while (await prisma.service.findFirst({ where: { buildingId: building.id, code: uniqueCode } })) uniqueCode = `${baseCode}_${cnt++}`
          svc = await prisma.service.create({
            data: {
              buildingId: building.id,
              name,
              code: uniqueCode,
              methodology: 'OWNERSHIP_SHARE' as unknown as Prisma.CalculationMethod,
              dataSourceType: 'UNIT_COUNT' as unknown as Prisma.DataSourceType,
              isActive: true
            }
          })
          existingServices.push(svc)
          return svc
        }

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i] as unknown[]
          const unitNumber = String(row[unitIdx] ?? '').trim()
          if (!unitNumber) continue

          let unit = unitMap.get(unitNumber)
          if (!unit) {
            const found = await prisma.unit.findFirst({ where: { buildingId: building.id, unitNumber } })
            if (found) { unit = { id: found.id }; unitMap.set(unitNumber, unit) }
          }
          if (!unit) { continue }

          for (const block of blocks) {
            // vezmi první nenulovou měsíční hodnotu
            let monthlyAmount = 0
            for (const col of block.monthCols) {
              const v = String(row[col] ?? '').trim()
              const num = parseFloat(v.replace(/\s/g, '').replace(',', '.'))
              if (Number.isFinite(num) && num !== 0) { monthlyAmount = num; break }
            }
            if (!monthlyAmount) continue

            const service = await getService(block.name)
            let ap = await prisma.advancePayment.findUnique({ where: { serviceId_year: { serviceId: service.id, year: parseInt(billingPeriod) } } })
            if (!ap) ap = await prisma.advancePayment.create({ data: { serviceId: service.id, year: parseInt(billingPeriod) } })
            const key = { advancePaymentId_unitId: { advancePaymentId: ap.id, unitId: (unit as UnitLite).id } }
            const existing = await prisma.advancePaymentRecord.findUnique({ where: key })
            if (!existing) { await prisma.advancePaymentRecord.create({ data: { advancePaymentId: ap.id, unitId: (unit as UnitLite).id, monthlyAmount } }); advancesCreated++ }
            else { await prisma.advancePaymentRecord.update({ where: key, data: { monthlyAmount } }); advancesUpdated++ }
          }
        }

        log(`[Předpis] Vytvořeno ${advancesCreated}, aktualizováno ${advancesUpdated} záznamů předpisů záloh`)
        summary.advances = { created: advancesCreated, updated: advancesUpdated, total: advancesCreated + advancesUpdated }
      } else {
        summary.warnings.push('Na listu "' + advancesSheetName + '" nebyla nalezena čitelná hlavička s měsíci (1..12).')
      }
    } else {
      summary.warnings.push('Záložka "Předpis po měsíci" nebyla nalezena. Předpisy záloh nebyly importovány.')
    }

    return NextResponse.json({
      success: true,
      message: `Úspěšně importováno kompletní vyúčtování pro rok ${billingPeriod}`,
      summary,
      logs
    })

  } catch (error) {
    console.error('[Complete import]', error)
    
    let message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    // Přeložit časté databázové chyby do češtiny
    if (message.includes('Unique constraint failed')) {
      if (message.includes('unitNumber')) {
        message = 'V souboru jsou duplicitní čísla jednotek. Každá jednotka musí mít unikátní číslo v rámci domu (např. 318/01, 318/02). Zkontrolujte prosím sloupec "Byt" v Excelu.'
      } else if (message.includes('code')) {
        message = 'Duplicitní kód služby. Služba s tímto kódem již existuje v databázi.'
      } else {
        message = 'Duplicitní data v databázi. Zkontrolujte prosím, že importovaná data jsou unikátní.'
      }
    } else if (message.includes('Foreign key')) {
      message = 'Chyba propojení dat – budova nebo související záznam nebyl nalezen v databázi.'
    } else if (message.includes('Invalid')) {
      message = 'Neplatný formát dat v Excelu. Zkontrolujte prosím, že všechny sloupce mají správný formát.'
    }

    return NextResponse.json({ success: false, message, debugStack: stack }, { status: 500 })
  }
}
