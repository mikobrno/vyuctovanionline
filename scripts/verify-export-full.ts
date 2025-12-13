import { readFileSync } from 'node:fs'
import path from 'node:path'
import { read, utils } from 'xlsx'

type ExportRow = {
  unitName: string
  dataType: string
  key: string
  vals: string[]
  sourceRow?: string
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined) return 0
  const str = String(value).replace(/[^\d,.\-]/g, '').replace(',', '.')
  const num = parseFloat(str)
  return Number.isFinite(num) ? num : 0
}

function findExportFullSheetName(sheetNames: string[]): string | undefined {
  return sheetNames.find((name) =>
    name.toLowerCase().replace(/[\s_-]/g, '').includes('exportfull') ||
    name.toLowerCase() === 'export_full' ||
    name.toLowerCase() === 'export full'
  )
}

function parseSourceSheetMeta(raw: unknown): { sheetName?: string; rows?: number; cols?: number; hash?: string } | undefined {
  const str = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!str) return undefined
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str) as any
      return {
        sheetName: typeof parsed.sheetName === 'string' ? parsed.sheetName : undefined,
        rows: typeof parsed.rows === 'number' ? parsed.rows : undefined,
        cols: typeof parsed.cols === 'number' ? parsed.cols : undefined,
        hash: typeof parsed.hash === 'string' ? parsed.hash : undefined,
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

function main() {
  const fileArg = process.argv[2]
  if (!fileArg) {
    console.error('Usage: npx tsx scripts/verify-export-full.ts <path-to-xlsx>')
    process.exit(2)
  }

  const filePath = path.resolve(process.cwd(), fileArg)
  const buffer = readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })

  const exportSheetName = findExportFullSheetName(workbook.SheetNames)
  if (!exportSheetName) {
    console.error(`EXPORT_FULL sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`)
    process.exit(2)
  }

  const sheet = workbook.Sheets[exportSheetName]
  const raw = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (raw.length < 2) {
    console.error('EXPORT_FULL has no data rows')
    process.exit(2)
  }

  const header = (raw[0] as unknown[]).map((v) => String(v).trim())
  const idx = (name: string) => header.findIndex((h) => h === name)

  const unitIdx = idx('UnitName')
  const typeIdx = idx('DataType')
  const keyIdx = idx('Key')
  const sourceIdx = idx('SourceRow')

  if (unitIdx < 0 || typeIdx < 0 || keyIdx < 0) {
    console.error(`Unexpected header. First row: ${header.join(' | ')}`)
    process.exit(2)
  }

  const valStart = idx('Val1')
  const valEnd = idx('Val13')
  if (valStart < 0 || valEnd < 0) {
    console.error('Missing Val1..Val13 columns in EXPORT_FULL')
    process.exit(2)
  }

  const rows: ExportRow[] = []
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r] as unknown[]
    const unitName = String(row[unitIdx] ?? '').trim()
    const dataType = String(row[typeIdx] ?? '').trim()
    const key = String(row[keyIdx] ?? '').trim()
    if (!unitName || !dataType) continue

    const vals = []
    for (let i = valStart; i <= valEnd; i++) {
      vals.push(String(row[i] ?? ''))
    }

    const sourceRow = sourceIdx >= 0 ? String(row[sourceIdx] ?? '').trim() : undefined
    rows.push({ unitName, dataType, key, vals, sourceRow: sourceRow || undefined })
  }

  const warnings: string[] = []
  const byUnit = new Map<string, ExportRow[]>()
  for (const row of rows) {
    if (!byUnit.has(row.unitName)) byUnit.set(row.unitName, [])
    byUnit.get(row.unitName)!.push(row)
  }

  const buildingRows = byUnit.get('__BUILDING__') ?? []
  const buildingInfoCount = buildingRows.filter((r) => r.dataType === 'BUILDING_INFO').length
  if (buildingInfoCount === 0) warnings.push('Missing BUILDING_INFO (__BUILDING__) row')

  let unitCount = 0
  const metaHashes: string[] = []
  for (const [unitName, unitRows] of byUnit) {
    if (unitName === '__BUILDING__') continue
    unitCount++

    const infoRows = unitRows.filter((r) => r.dataType === 'INFO')
    if (infoRows.length !== 1) {
      warnings.push(`${unitName}: expected exactly 1 INFO row, got ${infoRows.length}`)
      continue
    }

    const info = infoRows[0]
    const totalResult = parseMoney(info.vals[3]) // Val4
    const totalCost = parseMoney(info.vals[6]) // Val7
    const totalAdvance = parseMoney(info.vals[7]) // Val8
    if (!Number.isFinite(totalResult)) warnings.push(`${unitName}: INFO totalResult not parseable`)
    if (!Number.isFinite(totalCost)) warnings.push(`${unitName}: INFO totalCost not parseable`)
    if (!Number.isFinite(totalAdvance)) warnings.push(`${unitName}: INFO totalAdvance not parseable`)

    const meta = parseSourceSheetMeta(info.vals[12])
    if (!meta?.sheetName || !meta?.hash) {
      warnings.push(`${unitName}: INFO.Val13 sourceSheetMeta missing/invalid (expected JSON with sheetName+hash)`)
    } else {
      metaHashes.push(meta.hash)
    }

    const costRows = unitRows.filter((r) => r.dataType === 'COST')
    if (costRows.length === 0) warnings.push(`${unitName}: no COST rows`)
    for (const cost of costRows) {
      if (!cost.key) warnings.push(`${unitName}: COST row missing Key (service name)`)
      if (!cost.sourceRow) warnings.push(`${unitName}: COST ${cost.key || '(no key)'} missing SourceRow`)
    }

    const fixedRows = unitRows.filter((r) => r.dataType === 'FIXED_PAYMENT')
    for (const fp of fixedRows) {
      if (!fp.key) warnings.push(`${unitName}: FIXED_PAYMENT row missing Key (name)`)
      if (!fp.sourceRow) warnings.push(`${unitName}: FIXED_PAYMENT ${fp.key || '(no key)'} missing SourceRow`)
    }
  }

  if (metaHashes.length >= 2) {
    const unique = new Set(metaHashes)
    if (unique.size === 1) {
      warnings.push(`All units share identical sourceSheet hash (${metaHashes[0]}). This usually means the exporter didn't actually switch/recalculate per unit.`)
    }
  }

  const byType = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.dataType] = (acc[r.dataType] ?? 0) + 1
    return acc
  }, {})

  console.log(`EXPORT_FULL verification: ${unitCount} units, ${rows.length} rows, sheet=${exportSheetName}`)
  console.log(`Row counts by type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`)

  if (warnings.length) {
    console.log(`\nWARNINGS (${warnings.length}):`)
    for (const w of warnings) console.log(`- ${w}`)
    process.exitCode = 1
  } else {
    console.log('\nOK: basic structure and sourceSheetMeta present.')
  }
}

main()
