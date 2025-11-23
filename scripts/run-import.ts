
import { read, utils } from 'xlsx'
import { prisma } from '../lib/prisma'
import { CalculationMethod, DataSourceType, MeterType, Service } from '@prisma/client'
import fs from 'fs'
import path from 'path'

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

async function runImport() {
  try {
    const fileName = 'vyuctovani2024 (20).xlsx'
    const buildingName = 'Kníničky 318'
    const filePath = path.join(process.cwd(), 'public', fileName)

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`)
        return
    }

    const buffer = fs.readFileSync(filePath)
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

    // Akumulované logy pro zobrazení v UI
    const logs: string[] = []
    const log = (msg: string) => { logs.push(msg); console.log(msg) }

    // 1. NAJÍT NEBO VYTVOŘIT DŮM
    const finalBuildingName = buildingName || 'Importovaná budova ' + new Date().toLocaleDateString('cs-CZ')
    
    // Načíst adresu a období ze záložky "Vstupní data"
    let buildingAddress = 'Adresu upravte v detailu budovy'
    let billingPeriod = String(new Date().getFullYear())
    
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

    // BillingPeriod záznam (potřebný pro výpočty)
    const billingPeriodRecord = await prisma.billingPeriod.upsert({
      where: { buildingId_year: { buildingId: building.id, year: parseInt(billingPeriod, 10) } },
      update: {},
      create: { buildingId: building.id, year: parseInt(billingPeriod, 10) }
    })
    // ID období lze použít v dalších částech (zatím neukládáme do meterReading, protože schéma má jen numeric period)
    log(`[Import] BillingPeriod ID: ${billingPeriodRecord.id}`)

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

          // A: Jednotky (např. "Jednotka č. 318/01" nebo "318/01")
          const unitCellRaw = String(row[0] || '').trim()
          const unitNumber = unitCellRaw
            .replace(/jednotka\s*č\.?\s*/i, '')
            .replace(/^byt\s*/i, '')
            .replace(/^č\.?\s*/i, '')
            .trim()

          const fullName = String(row[1] || '').trim()
          const address = String(row[2] || '').trim()
          const email = String(row[3] || '').trim() // D
          const phone = String(row[4] || '').trim() // E
          const areaRaw = String(row[6] || '').trim() // G: Celková výměra bytu
          const variableSymbol = String(row[9] || '').trim() // J: Variabilní symbol
          const ownershipShareRaw = String(row[8] || '').trim() // I: Podíl v domě

          // Parse area
          const totalArea = (() => {
            const num = parseFloat(areaRaw.replace(',', '.'))
            return Number.isFinite(num) ? num : 0
          })()

          // Parse ownership share into numerator/denominator
          let shareNumerator = 0
            , shareDenominator = 10000 // default high denominator for decimal conversion
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

          // Jednotka – vytvořit / aktualizovat (používáme unitNumber jako unikátní v rámci buildingu)
          let unit = await prisma.unit.findUnique({ where: { buildingId_unitNumber: { buildingId: building.id, unitNumber } } })
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

          // Ownership – přiřadit vlastníka k jednotce (pokud neexistuje vztah pro aktuální rok)
          const yearStart = new Date(parseInt(billingPeriod, 10), 0, 1)
          const existingOwnership = await prisma.ownership.findFirst({
            where: { unitId: unit.id, ownerId: owner.id }
          })
          if (!existingOwnership) {
            await prisma.ownership.create({
              data: {
                unitId: unit.id,
                ownerId: owner.id,
                validFrom: yearStart,
                sharePercent: 100
              }
            })
          }

          // Uložit mapování jednotka -> vlastník (pro pozdější použití)
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
          const calculationMethod = m.includes('měřidl') || m.includes('odečet') || m.includes('extern') ? 'METER_READING' :
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
            // Robustní generování unikátního kódu služby s retry při kolizi
            const baseCode = serviceName
              .substring(0, 10)
              .toUpperCase()
              .replace(/\s+/g, '_')
              .replace(/[^A-Z0-9_]/g, '') || 'SERVICE'
            let created: Service | null = null
            for (let attempt = 0; attempt < 15 && !created; attempt++) {
              const candidate = attempt === 0 ? baseCode : `${baseCode}_${attempt}`
              try {
                created = await prisma.service.create({
                  data: {
                    buildingId: building.id,
                    name: serviceName,
                    code: candidate,
                    methodology: calculationMethod as CalculationMethod,
                    dataSourceType: (src.dataSourceType as DataSourceType) ?? undefined,
                    unitAttributeName: src.unitAttributeName ?? undefined,
                    measurementUnit: src.measurementUnit ?? undefined,
                    isActive: true,
                    order: summary.services.total
                  }
                })
                service = created
              } catch (e) {
                if (e instanceof Error && e.message.includes('Unique constraint failed')) {
                  // kolize – zkus další suffix
                  continue
                }
                throw e
              }
            }
            if (!service) {
              throw new Error(`Nepodařilo se vytvořit službu '${serviceName}' (kolize kódu po 15 pokusech).`)
            }
            summary.services.created++
          } else {
            await prisma.service.update({
              where: { id: service.id },
              data: {
                methodology: calculationMethod as CalculationMethod,
                dataSourceType: (src.dataSourceType as DataSourceType) ?? undefined,
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

    // 3. PROCESS FAKTURY SHEET
    const fakturySheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('faktury'));

    if (fakturySheetName) {
      const fakturySheet = workbook.Sheets[fakturySheetName]
      const rawData = utils.sheet_to_json<string[]>(fakturySheet, { header: 1, defval: '' }) as string[][]

      // Find header row
      const headerRowIndex = rawData.findIndex(row => {
        const normalized = row.map(cell => normalizeHeaderCell(String(cell)))
        return normalized.includes('název služby') && normalized.includes('způsob rozúčtování')
      })

      if (headerRowIndex !== -1) {
        const header = rawData[headerRowIndex].map(cell => normalizeHeaderCell(String(cell)))
        const idxServiceName = header.indexOf('název služby');
        const idxBillingMethod = header.indexOf('způsob rozúčtování');

        const dataRows = rawData.slice(headerRowIndex + 1);

        for (const row of dataRows) {
          const serviceName = String(row[idxServiceName] || '').trim();
          const billingMethod = String(row[idxBillingMethod] || '').trim().toLowerCase();

          if (!serviceName || !billingMethod) continue;

          // Map billing method to Prisma schema
          const methodMapping: Record<string, { method: CalculationMethod; dataSource: DataSourceType | null; unitAttribute: string | null }> = {
            'na byt': { method: 'FIXED_PER_UNIT', dataSource: null, unitAttribute: null },
            'vlastnický podíl': { method: 'OWNERSHIP_SHARE', dataSource: null, unitAttribute: 'VLASTNICKY_PODIL' },
            'odečet sv': { method: 'METER_READING', dataSource: 'METER_DATA', unitAttribute: null },
            'odečet tuv': { method: 'METER_READING', dataSource: 'METER_DATA', unitAttribute: null },
            'externí (pro teplo)': { method: 'METER_READING', dataSource: 'METER_DATA', unitAttribute: null },
            'nevyúčtovává se': { method: 'NO_BILLING', dataSource: null, unitAttribute: null }
          };

          const mapped = methodMapping[billingMethod] || { method: 'NO_BILLING', dataSource: null, unitAttribute: null };

          // Update or create service in database
          const code = serviceName.replace(/\s+/g, '_').toUpperCase().substring(0, 10)
          await prisma.service.upsert({
            where: { buildingId_code: { buildingId: building.id, code } },
            update: {
              name: serviceName,
              methodology: mapped.method,
              dataSourceType: mapped.dataSource,
              unitAttributeName: mapped.unitAttribute
            },
            create: {
              name: serviceName,
              buildingId: building.id,
              code,
              methodology: mapped.method,
              dataSourceType: mapped.dataSource,
              unitAttributeName: mapped.unitAttribute
            }
          })

          log(`[Faktury] Aktualizována služba: ${serviceName} (${billingMethod})`);
        }
      } else {
        summary.warnings.push('Na listu "Faktury" nebyla nalezena hlavička s očekávanými sloupci.');
      }
    } else {
      summary.warnings.push('Záložka "Faktury" nebyla nalezena.');
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

        const serialNumber = String(row[5] || '').trim()
        // Explicitní mapování sloupců: G (index 6) = startValue, H (index 7) = endValue, I (index 8) = consumption
        const startValue = parseNumberCell(String(row[6] || '')) ?? 0
        const endValue = parseNumberCell(String(row[7] || '')) ?? 0
        let consumption = parseNumberCell(String(row[8] || '')) ?? (endValue > startValue ? endValue - startValue : 0)
        
        // Načtení předvypočítaného nákladu (pokud existuje sloupec)
        let precalculatedCost: number | undefined = undefined
        if (colMeta.yearlyCost) {
          precalculatedCost = parseNumberCell(String(row[colMeta.yearlyCost.number - 1] || ''))
        }

        // Optional columns parsed above nejsou dále používány

        // Vypočítat spotřebu, pokud není zadaná
        if (consumption === 0 && endValue > startValue) {
          consumption = endValue - startValue
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

        // Upsert měřidla podle serialNumber (pokud chybí -> fallback)
        const effectiveSerial = serialNumber || `${unitNumber}-${meterType}`
        const meter = await prisma.meter.upsert({
          where: { unitId_serialNumber: { unitId: unit.id, serialNumber: effectiveSerial } },
          update: { type: meterType as MeterType, isActive: true },
          create: {
            unitId: unit.id,
            serialNumber: effectiveSerial,
            type: meterType as MeterType,
            initialReading: startValue,
            serviceId: service.id,
            isActive: true,
            installedAt: new Date(`${billingPeriod}-01-01`)
          }
        })

        const existingReading = await prisma.meterReading.findFirst({
          where: { meterId: meter.id, period: parseInt(billingPeriod, 10) }
        })
        if (!existingReading) {
          await prisma.meterReading.create({
            data: {
              meterId: meter.id,
              readingDate: new Date(`${billingPeriod}-12-31`),
              value: endValue, // původní pole value reprezentuje koncový stav
              startValue,
              endValue,
              consumption,
              precalculatedCost,
              period: parseInt(billingPeriod, 10),
              note: `Import z ${sheetName} - ${ownerName}`
            }
          })
          summary.readings.created++
          summary.readings.total++
        }
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
      const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
      return n === 'předpis po mesici' || n === 'predpis po mesici'
    })

    if (advancesSheetName) {
      log(`[Předpis] Začínám zpracování listu "${advancesSheetName}"...`)
      summary.advances = { created: 0, updated: 0, total: 0 }
      try {
        const advancesSheet = workbook.Sheets[advancesSheetName]
        console.log(`[DEBUG] Sheet Range: ${advancesSheet['!ref']}`);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = utils.sheet_to_json<any[]>(advancesSheet, { header: 1, defval: null })

        const periodId = billingPeriodRecord?.id
        const periodYear = billingPeriodRecord?.year

        if (!periodId || !periodYear) {
          throw new Error('Chybí ID fakturačního období při zpracování předpisů.')
        }

        // Najít nebo vytvořit službu pro importované zálohy
        // Použijeme speciální službu "Zálohy (Import)", která bude sloužit pro uložení celkových záloh
        let advanceService = await prisma.service.findFirst({
          where: { buildingId: building.id, name: 'Zálohy (Import)' }
        })

        if (!advanceService) {
          advanceService = await prisma.service.create({
            data: {
              buildingId: building.id,
              name: 'Zálohy (Import)',
              code: 'ADV_IMPORT',
              methodology: 'NO_BILLING', // Tato služba se nebude vyúčtovávat standardně, jen drží zálohy
              isActive: true
            }
          })
        }

        const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
        
        // Sloupce JC (262) až JN (273) obsahují měsíční zálohy (Leden - Prosinec)
        // const startColIndex = 262 // JC
        // const endColIndex = 273   // JN

        for (const unit of units) {
          const possibleNames = [
            unit.unitNumber,
            `Jednotka č. ${unit.unitNumber}`,
            `Byt č. ${unit.unitNumber}`,
            unit.unitNumber.replace(/^0+/, '') // 01 -> 1
          ]
          
          let unitRow = null
          
          // Hledáme řádek s jednotkou ve sloupci A (index 0)
          for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
            const cellValue = String(rawData[rowIndex]?.[0] ?? '').trim()
            const normalizedCell = normalizeHeaderCell(cellValue)
            
            // Improved matching for 318/03 vs 318/3
            const unitNumSimple = unit.unitNumber.replace(/\/0(\d)/, '/$1'); // 318/03 -> 318/3

            if (possibleNames.some(n => normalizeHeaderCell(n) === normalizedCell || normalizedCell.includes(normalizeHeaderCell(n))) || normalizedCell === normalizeHeaderCell(unitNumSimple)) {
               unitRow = rawData[rowIndex]
               
               if (unit.unitNumber === '318/03' || unit.unitNumber.includes('318/03')) {
                   // console.log(`[DEBUG] Found unit ${unit.unitNumber} at Row Index ${rowIndex} (Excel Row ${rowIndex + 1}). Cell A: "${cellValue}"`);
               }
               break
            }
          }
          
          if (!unitRow) {
            // log(`[Předpis] Jednotka ${unit.unitNumber} nenalezena.`)
            continue
          }

          // Načíst měsíční zálohy - sčítání napříč službami (sloupce B až JA)
          // Data jsou v blocích po 13 sloupcích (12 měsíců + 1 spacer)
          // B-M (1-12), O-Z (14-25), AB-AM (27-38), atd.
          const monthlyTotals = new Array(13).fill(0);
          
          // Iterujeme přes sloupce 1 (B) až 260 (IZ) - odhadovaný rozsah dat
          for (let c = 1; c <= 260; c++) {
             // Zjistíme, o který měsíc se jedná v rámci bloku 13 sloupců
             // (c - 1) % 13 dá 0..12. 
             // 0 -> měsíc 1
             // 11 -> měsíc 12
             // 12 -> spacer (ignorovat)
             const mod = (c - 1) % 13;
             if (mod < 12) {
                 const month = mod + 1;
                 const valStr = String(unitRow[c] ?? '').replace(/\s/g, '').replace(',', '.');
                 const val = parseFloat(valStr);
                 if (Number.isFinite(val)) {
                     monthlyTotals[month] += val;
                 }
             }
          }

          // Uložit sečtené měsíční zálohy
          for (let month = 1; month <= 12; month++) {
            const amount = monthlyTotals[month];
            
            if (!Number.isFinite(amount)) continue

            // Uložit měsíční zálohu
            try {
              const existing = await prisma.advanceMonthly.findUnique({
                where: {
                  unitId_serviceId_year_month: {
                    unitId: unit.id,
                    serviceId: advanceService.id,
                    year: periodYear,
                    month: month
                  }
                }
              })

              if (!existing) {
                await prisma.advanceMonthly.create({
                  data: {
                    unitId: unit.id,
                    serviceId: advanceService.id,
                    year: periodYear,
                    month: month,
                    amount: amount
                  }
                })
                summary.advances.created += 1
              } else {
                await prisma.advanceMonthly.update({
                  where: { id: existing.id },
                  data: { amount: amount }
                })
                summary.advances.updated += 1
              }
            } catch (e) {
              console.error(`[Předpis] Chyba DB pro jednotku ${unit.unitNumber}, měsíc ${month}: ${(e as Error).message}`)
            }
          }
        }

        summary.advances.total = summary.advances.created + summary.advances.updated
        log(`[Předpis] Dokončeno. Vytvořeno ${summary.advances.created}, aktualizováno ${summary.advances.updated}.`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[Předpis] CHYBA: ${msg}`)
        summary.errors.push(`Předpisy: ${msg}`)
      }
    } else {
      summary.warnings.push('Záložka "Předpis po měsíci" nebyla nalezena. Předpisy záloh nebyly importovány.')
    }

    // 6. PROCESS 'NÁKLADY NA DŮM' SHEET (celkové roční náklady služeb)
    const costSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('náklady na dům'))
    if (costSheetName) {
      const sheet = workbook.Sheets[costSheetName]
      const rawRows = utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
      const headerIdx = rawRows.findIndex(r => r.some(c => String(c).toLowerCase().includes('položka')))
      if (headerIdx === -1) {
        log(`[Náklady] Hlavička pro list ${costSheetName} nebyla nalezena.`)
      } else {
        const periodYear = parseInt(billingPeriod, 10)
        if (!Number.isFinite(periodYear)) {
          log('[Náklady] Neplatné období – náklady přeskočeny.')
        } else {
          const services = await prisma.service.findMany({ where: { buildingId: building.id } })
          let created = 0, updated = 0, skipped = 0
          for (const row of rawRows.slice(headerIdx + 1)) {
            const serviceName = String(row[1] ?? '').trim()
            const amountRaw = String(row[5] ?? '').replace(/\s/g, '').replace(',', '.')
            const amount = parseFloat(amountRaw)
            if (!serviceName || !Number.isFinite(amount) || amount <= 0) { skipped++; continue }
            const service = services.find(s => s.name.trim() === serviceName)
            if (!service) { log(`[Náklady] Služba "${serviceName}" nebyla nalezena, přeskočeno.`); skipped++; continue }
            const existing = await prisma.cost.findFirst({ where: { serviceId: service.id, period: periodYear } })
            if (existing) {
              await prisma.cost.update({ where: { id: existing.id }, data: { amount } })
              updated++
            } else {
              await prisma.cost.create({ data: { buildingId: building.id, serviceId: service.id, amount, description: `Import z listu ${costSheetName}`, invoiceDate: new Date(), period: periodYear } })
              created++
            }
          }
          log(`[Náklady] Náklady dokončeny. Vytvořeno ${created}, aktualizováno ${updated}, přeskočeno ${skipped}.`)
          summary.costs = { created, updated, skipped, total: created + updated }
        }
      }
    } else {
      log(`[Náklady] List 'Náklady na dům' nebyl nalezen.`)
    }

    console.log('Import completed successfully')
    console.log(JSON.stringify(summary, null, 2))

  } catch (error) {
    console.error('[Complete import]', error)
  }
}

runImport()
