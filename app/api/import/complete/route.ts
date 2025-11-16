import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'
import { MeterType } from '@prisma/client'

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
  errors: string[]
  warnings: string[]
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const buildingName = formData.get('buildingName') as string
    const year = formData.get('year') as string

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Soubor s vyúčtováním nebyl přiložen. Nahrajte prosím XLS/XLSX soubor.' 
      }, { status: 400 })
    }

    if (!year) {
      return NextResponse.json({ 
        success: false, 
        message: 'Není vyplněn rok vyúčtování. Zadejte prosím rok (např. 2024).' 
      }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Nahraný soubor je prázdný. Zkontrolujte prosím, že v něm jsou data.' 
      }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        success: false, 
        message: 'Soubor je příliš velký (limit 10 MB). Rozdělte ho prosím na menší části.' 
      }, { status: 413 })
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Nepodporovaný formát souboru. Nahrajte prosím soubor typu XLS nebo XLSX.' 
      }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer, { type: 'buffer' })

    const summary: ImportSummary = {
      building: { id: '', name: '', created: false },
      units: { created: 0, existing: 0, total: 0 },
      owners: { created: 0, existing: 0, total: 0 },
      services: { created: 0, existing: 0, total: 0 },
      costs: { created: 0, total: 0 },
      readings: { created: 0, total: 0, details: [] },
      payments: { created: 0, total: 0 },
      errors: [],
      warnings: []
    }

    // 1. NAJÍT NEBO VYTVOŘIT DŮM
    const finalBuildingName = buildingName || 'Importovaná budova ' + new Date().toLocaleDateString('cs-CZ')
    
    // Načíst adresu ze záložky "Vstupní data" z buňky B3
    let buildingAddress = 'Adresu upravte v detailu budovy'
    const inputDataSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('vstupní') || name.toLowerCase().includes('vstupni') || name.toLowerCase().includes('input')
    )
    
    if (inputDataSheetName) {
      const inputSheet = workbook.Sheets[inputDataSheetName]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(inputSheet, { header: 1, defval: '' })
      // B3 = row index 2, column index 1
      if (rawData.length > 2 && rawData[2] && rawData[2][1]) {
        const addressValue = String(rawData[2][1]).trim()
        if (addressValue) {
          buildingAddress = addressValue
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

    const ownerMap = new Map<string, any>()

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
        console.log(`[Evidence] Zpracovávám ${dataRows.length} řádků vlastníků`)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[1]) continue
          
          const unitNumber = String(row[0] || '').trim()
          const fullName = String(row[1] || '').trim()
          const address = String(row[2] || '').trim()
          const email = String(row[3] || '').trim()
          const phone = String(row[4] || '').trim()
          
          if (!fullName || !unitNumber) continue

          // Rozdělit jméno na křestní jméno a příjmení
          const nameParts = fullName.split(' ')
          const lastName = nameParts.pop() || ''
          const firstName = nameParts.join(' ') || lastName

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
                address: address || null
              }
            })
            summary.owners.created++
            console.log(`[Evidence] Vytvořen vlastník: ${firstName} ${lastName}`)
          } else {
            summary.owners.existing++
          }
          summary.owners.total++

          // Uložit mapování jednotka -> vlastník
          ownerMap.set(unitNumber, owner)
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
      
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => String(cell).includes('Jednotka') || String(cell).includes('318'))
      )

      if (headerRowIndex !== -1) {
        const dataRows = rawData.slice(headerRowIndex + 1)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[0]) continue
          
          const serviceName = String(row[0] || '').trim()
          const methodology = String(row[2] || '').trim()
          const amountStr = String(row[4] || '0').trim()
          
          if (!serviceName || serviceName === 'Prázdné') continue
          if (!amountStr || amountStr === '0' || amountStr === '0,00') continue
          
          const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
          
          if (isNaN(amount) || amount === 0) {
            summary.errors.push(`Faktury řádek ${i + headerRowIndex + 2}: Neplatná částka "${amountStr}" pro službu "${serviceName}"`)
            continue
          }

          // Najít nebo vytvořit službu
          let service = await prisma.service.findFirst({
            where: {
              buildingId: building.id,
              name: {
                equals: serviceName,
                mode: 'insensitive'
              }
            }
          })

          if (!service) {
            const baseCode = serviceName.substring(0, 10).toUpperCase().replace(/\s/g, '_').replace(/[^A-Z0-9_]/g, '')
            let uniqueCode = baseCode
            let counter = 1
            
            let existingService = await prisma.service.findFirst({
              where: { buildingId: building.id, code: uniqueCode }
            })
            
            while (existingService) {
              uniqueCode = `${baseCode}_${counter}`
              counter++
              existingService = await prisma.service.findFirst({
                where: { buildingId: building.id, code: uniqueCode }
              })
            }
            
            service = await prisma.service.create({
              data: {
                buildingId: building.id,
                name: serviceName,
                code: uniqueCode,
                methodology: methodology || 'vlastnický podíl',
                measurementUnit: methodology.includes('měřidlo') ? 'kWh' : null,
                isActive: true,
                order: summary.services.total
              }
            })
            summary.services.created++
          } else {
            summary.services.existing++
          }
          summary.services.total++

          // Vytvořit náklad
          await prisma.cost.create({
            data: {
              buildingId: building.id,
              serviceId: service.id,
              amount,
              description: `Import z Excelu - ${serviceName}`,
              invoiceDate: new Date(`${year}-12-31`),
              period: parseInt(year)
            }
          })
          summary.costs.created++
          summary.costs.total++
        }
      } else {
        summary.warnings.push('Na listu "' + invoicesSheetName + '" nebyla nalezena hlavička s fakturami.')
      }
    } else {
      summary.warnings.push('Záložka "Faktury" nebyla nalezena. Náklady nebyly importovány.')
    }

    // 3. IMPORT ODEČTŮ
    const unitMap = new Map<string, any>()
    
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
      const simplified = headerRowCells.map((cell: any) => normalizeHeaderCell(String(cell ?? '')))

      const findColumn = (patterns: RegExp[]) =>
        simplified.findIndex(cell => patterns.some(p => p.test(cell)))

      const buildDescriptor = (idx: number, originalHeaders: any[]) => {
        if (idx < 0) return null
        return {
          letter: columnIndexToLetter(idx),
          number: idx + 1,
          header: String(originalHeaders[idx] ?? '')
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
        summary.readings.details?.push({
          sheetName,
          columns: colMeta as any
        })
      }

      const dataRows = rawData.slice(headerRowIndex + 1)
      console.log(`[${sheetName}] Zpracovávám ${dataRows.length} řádků odečtů`)

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        if (!row || row.length === 0 || !row[0]) continue

        const unitNumber = String(row[0] || '').trim()
        const ownerName = String(row[1] || '').trim()

        const initialReading = parseNumberCell(String(row[initialIdx] || '')) ?? 0
        const finalReading = parseNumberCell(String(row[finalIdx] || '')) ?? 0
        let consumption = parseNumberCell(String(row[consumptionIdx] || '')) ?? 0

        const yearlyCost = costCol >= 0 ? parseNumberCell(String(row[costCol] || '')) : undefined
        const radioModule = moduleCol >= 0 ? String(row[moduleCol] || '').trim() : undefined
        const externalId = idCol >= 0 ? String(row[idCol] || '').trim() : undefined

        // Vypočítat spotřebu, pokud není zadaná
        if (consumption === 0 && finalReading > initialReading) {
          consumption = finalReading - initialReading
        }

        // Přeskočit neplatné řádky
        if (!unitNumber || unitNumber === 'Bazén' || unitNumber.toLowerCase().includes('celkem')) continue
        if (consumption <= 0) {
          console.log(`[${sheetName}] Přeskakuji jednotku ${unitNumber} - nulová spotřeba`)
          continue
        }

        // Najít nebo vytvořit jednotku
        let unit = unitMap.get(unitNumber)
        
        if (!unit) {
          unit = await prisma.unit.findFirst({
            where: {
              buildingId: building.id,
              unitNumber
            },
            include: { meters: true }
          })

          if (!unit) {
            unit = await prisma.unit.create({
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
            summary.units.created++

            // Vytvořit vazbu vlastník -> jednotka, pokud existuje
            const owner = ownerMap.get(unitNumber)
            if (owner) {
              await prisma.ownership.create({
                data: {
                  unitId: unit.id,
                  ownerId: owner.id,
                  validFrom: new Date(`${year}-01-01`),
                  sharePercent: 100
                }
              })
              console.log(`[Ownership] Přiřazen vlastník ${owner.firstName} ${owner.lastName} k jednotce ${unitNumber}`)
            }
          } else {
            summary.units.existing++
          }
          summary.units.total++
          unitMap.set(unitNumber, unit)
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
              methodology: 'měřidla',
              measurementUnit: meterType === 'HEATING' ? 'kWh' : meterType.includes('WATER') ? 'm³' : 'kWh',
              isActive: true
            }
          })
          summary.services.created++
          summary.services.total++
        }

        // Najít nebo vytvořit měřidlo
        let meter = unit.meters?.find((m: { type: MeterType; isActive: boolean }) => m.type === meterType && m.isActive)

        if (!meter) {
          meter = await prisma.meter.create({
            data: {
              unitId: unit.id,
              serialNumber: `${unitNumber}-${meterType}`,
              type: meterType as MeterType,
              initialReading,
              serviceId: service.id,
              isActive: true,
              installedAt: new Date(`${year}-01-01`)
            }
          })
        }

        // Vytvořit odečet
        await prisma.meterReading.create({
          data: {
            meterId: meter.id,
            readingDate: new Date(`${year}-12-31`),
            value: finalReading,
            consumption,
            period: parseInt(year),
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
        console.log(`[${paymentsSheetName}] Zpracovávám ${dataRows.length} řádků plateb`)
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          if (!row || row.length === 0 || !row[0]) continue
          
          const unitNumber = String(row[0] || '').trim()
          if (!unitNumber || unitNumber === 'Bazén' || unitNumber.toLowerCase().includes('celkem')) continue

          console.log(`[Platby] Zpracovávám jednotku ${unitNumber}`)

          // Najít jednotku
          let unit = unitMap.get(unitNumber)
          if (!unit) {
            unit = await prisma.unit.findFirst({
              where: {
                buildingId: building.id,
                unitNumber
              }
            })

            if (!unit) {
              unit = await prisma.unit.create({
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
              summary.units.created++
              summary.units.total++
            } else {
              if (!unitMap.has(unitNumber)) {
                summary.units.existing++
                summary.units.total++
              }
            }
            unitMap.set(unitNumber, unit)
          }

          // Projít měsíce (sloupce B-M = indexy 1-12)
          for (let month = 1; month <= 12; month++) {
            const amountStr = String(row[month] || '0').trim()
            const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
            
            if (isNaN(amount) || amount === 0) continue

            console.log(`[Platby] Jednotka ${unitNumber}, měsíc ${month}: ${amount} Kč`)

            // Vytvořit platbu pro daný měsíc
            const paymentDate = new Date(parseInt(year), month - 1, 15)
            
            await prisma.payment.create({
              data: {
                unitId: unit.id,
                amount,
                paymentDate,
                variableSymbol: unit.variableSymbol,
                period: parseInt(year),
                description: `Úhrada záloh ${month.toString().padStart(2, '0')}/${year}`
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

    return NextResponse.json({
      success: true,
      message: `Úspěšně importováno kompletní vyúčtování pro rok ${year}`,
      summary
    })

  } catch (error) {
    console.error('[Complete import]', error)
    
    let message = error instanceof Error ? error.message : String(error)

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

    return NextResponse.json(
      {
        success: false,
        message: message,
      },
      { status: 500 }
    )
  }
}
