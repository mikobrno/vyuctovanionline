import { PrismaClient } from '@prisma/client'
import { read, utils } from 'xlsx'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

function stripUnitPrefixes(value: string) {
  return value
    .replace(/^(jednotka|byt|nebytový prostor|nebyt\.|ateliér|atelier|garáž|garaz|sklep|bazén|bazen)\s*(č\.?|c\.?)?\s*/gi, '')
    .replace(/^(č\.?|c\.?)\s*/gi, '')
    .trim()
}

function parseAmount(val: unknown) {
  const num = parseFloat(String(val ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(num) ? num : 0
}

async function main() {
  const buildingId = process.argv[2] || '6bc262a1-14ed-4f79-a8fb-d4623dbf3694'
  const unitNumber = process.argv[3] || '318/03'
  const file = process.argv[4] || 'public/vyuctovani2024 (20).xlsx'

  const services = await prisma.service.findMany({
    where: { buildingId, advancePaymentColumn: { not: null } },
    select: { id: true, name: true, advancePaymentColumn: true }
  })

  const workbook = read(fs.readFileSync(path.join(process.cwd(), file)), { type: 'buffer' })
  let sheetName = workbook.SheetNames.find(name => name.toLowerCase().replace(/\s+/g, ' ').trim() === 'předpis po mesici')
  if (!sheetName) {
    sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('předpis') || name.toLowerCase().includes('zaloh'))
  }
  if (!sheetName) throw new Error('Advance sheet not found')

  const raw = utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' })
  const monthHeaderRow = raw[1] as unknown[] | undefined

  const normalizeAdvanceColumnIndex = (colIndex: number) => {
    if (!monthHeaderRow || colIndex < 0) return colIndex
    const headerCell = String(monthHeaderRow[colIndex] ?? '').trim().toLowerCase()
    if (!headerCell) return colIndex
    const isTotalColumn = headerCell.includes('celkem') || headerCell.includes('součet')
    if (!isTotalColumn) return colIndex

    let looksLikeMonthBlock = true
    for (let offset = 1; offset <= 12; offset++) {
      const headerVal = String(monthHeaderRow[colIndex - offset] ?? '').trim()
      if (headerVal !== String(13 - offset)) {
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
  const target = stripUnitPrefixes(unitNumber)
  const rowEntry = raw.find(row => stripUnitPrefixes(String(row[0] ?? '')) === target)
  if (!rowEntry) throw new Error(`Row for unit ${unitNumber} not found`)

  console.log(`Unit row found. Column count: ${rowEntry.length}`)
  const headerRow = raw[1] as unknown[]
  console.log('Header row sample:')
  for (let i = 0; i < 30; i++) {
    if (headerRow && headerRow[i] !== undefined && headerRow[i] !== null && String(headerRow[i]).trim() !== '') {
      console.log(`${utils.encode_col(i)}: ${headerRow[i]}`)
    }
  }
  console.log('--- Row snapshot (first 120 columns) ---')
  for (let i = 0; i < Math.min(120, rowEntry.length); i++) {
    const val = rowEntry[i]
    if (val && String(val).trim() !== '') {
      console.log(`${utils.encode_col(i)} (${i}): ${val}`)
    }
  }
  console.log('----------------------------------------')

  for (const service of services) {
    let baseIndex = -1
    if (!service.advancePaymentColumn) continue
    if (/^\d+$/.test(service.advancePaymentColumn)) {
      baseIndex = parseInt(service.advancePaymentColumn, 10)
    } else {
      baseIndex = utils.decode_col(service.advancePaymentColumn)
    }
    if (baseIndex < 0) continue
    const months = [] as number[]
    const normalizedIndex = normalizeAdvanceColumnIndex(baseIndex)
    if (normalizedIndex !== baseIndex) {
      console.log(`Normalizing ${service.name} base column ${utils.encode_col(baseIndex)} -> ${utils.encode_col(normalizedIndex)}`)
    }
    for (let m = 0; m < 12; m++) {
      const idx = normalizedIndex + m
      months.push(parseAmount(rowEntry[idx]))
    }
    const total = months.reduce((a, b) => a + b, 0)
    console.log(`${service.name} (${service.advancePaymentColumn}) -> months: ${months.join(', ')} | total: ${total}`)
  }
}

main().catch(err => {
  console.error(err)
}).finally(async () => prisma.$disconnect())
