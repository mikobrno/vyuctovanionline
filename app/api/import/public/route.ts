import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'
import { read, utils } from 'xlsx'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')

    if (!file) {
      return NextResponse.json({ error: "Missing 'file' query param, e.g. ?file=data.xlsx" }, { status: 400 })
    }

    // Allow only .xlsx/.xls and prevent path traversal
    const allowed = [/\.xlsx$/i, /\.xls$/i]
    if (!allowed.some((re) => re.test(file))) {
      return NextResponse.json({ error: 'Only .xlsx or .xls files are allowed' }, { status: 400 })
    }

    const publicDir = path.join(process.cwd(), 'public')
    const normalized = path.normalize(file).replace(/^([/\\]+)/, '')
    const absPath = path.join(publicDir, normalized)

    if (!absPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Verify file exists and read it
    await fs.access(absPath)
    const buffer = await fs.readFile(absPath)

    // Parse with xlsx
    const workbook = read(buffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames

    const sheetParam = searchParams.get('sheet')
    if (!sheetParam) {
      // Extract first 5 rows from each sheet for preview
      const preview: Record<string, unknown[]> = {}
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name]
        const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
        preview[name] = rows.slice(0, 5)
      }

      return NextResponse.json({
        file,
        sheetNames,
        preview,
      })
    }

    // Inspect a specific sheet (e.g., 'faktury') and detect columns
    const targetName = sheetNames.find((n) => n.toLowerCase().trim() === sheetParam.toLowerCase().trim())
      ?? sheetNames.find((n) => n.toLowerCase().includes(sheetParam.toLowerCase()))

    if (!targetName) {
      return NextResponse.json({ error: `Sheet '${sheetParam}' not found`, sheetNames }, { status: 404 })
    }

    const sheet = workbook.Sheets[targetName]
    const raw = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    const normalize = (s: unknown) => String(s ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim()

    const headerRowIndex = raw.findIndex((row) => Array.isArray(row) && row.some((c) => {
      const v = normalize(c)
      return /sluzb|naklad|polozk|uct|faktur/.test(v) || /castk|cena|suma|celkem|bez dph|s dph/.test(v)
    }))

    if (headerRowIndex < 0) {
      return NextResponse.json({
        file,
        sheet: targetName,
        headerRowIndex,
        note: 'Header row not detected. Provide the exact headers or sample.',
        preview: raw.slice(0, 10),
      })
    }

    const headers = (raw[headerRowIndex] as unknown[]).map((h) => String(h ?? ''))
    const normHeaders = headers.map(normalize)

    const findIdx = (...patterns: RegExp[]) =>
      normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))

    const idx = {
      service: findIdx(/sluzb/, /naklad/, /polozk/, /popis/),
      methodology: findIdx(/metod/, /zpusob/, /rozuct/),
      amount: findIdx(/castk/, /cena/, /suma/, /celkem/, /bez dph/, /s dph/),
      period: findIdx(/obdobi/, /rok/, /period/),
      unitNumber: findIdx(/byt|jednotk|cislo bytu/),
    }

    const dataRows = raw.slice(headerRowIndex + 1)
    const parsed: Array<Record<string, unknown>> = []
    let total = 0
    const byService: Record<string, { count: number; amount: number }> = {}

    for (const r of dataRows) {
      if (!Array.isArray(r) || r.every((c) => String(c ?? '').trim() === '')) continue

      const serviceName = idx.service >= 0 ? String((r[idx.service] ?? '')).trim() : ''
      const methodology = idx.methodology >= 0 ? String((r[idx.methodology] ?? '')).trim() : ''
      const amountStr = idx.amount >= 0 ? String((r[idx.amount] ?? '')).trim() : ''
      const period = idx.period >= 0 ? String((r[idx.period] ?? '')).trim() : ''
      const unitNumber = idx.unitNumber >= 0 ? String((r[idx.unitNumber] ?? '')).trim() : ''

      const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'))
      const isAmount = Number.isFinite(amount) && amount !== 0
      if (!serviceName && !isAmount) continue

      parsed.push({ serviceName, methodology, amount: isAmount ? amount : null, period, unitNumber })

      if (serviceName && isAmount) {
        total += amount
        if (!byService[serviceName]) byService[serviceName] = { count: 0, amount: 0 }
        byService[serviceName].count += 1
        byService[serviceName].amount += amount
      }
    }

    return NextResponse.json({
      file,
      sheet: targetName,
      headerRowIndex,
      headers,
      indices: idx,
      rows: parsed.slice(0, 50),
      count: parsed.length,
      total,
      byService,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
