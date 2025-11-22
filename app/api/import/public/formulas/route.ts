import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'
import { read } from 'xlsx'

export const runtime = 'nodejs'

type FormulaRef = { sheet?: string; range: string }

// Very simple reference parser: extracts "Sheet!A1", "'Sheet Name'!B2:C10", "A1", "B2:C3"
function extractRefs(formula: string): FormulaRef[] {
  const refs: FormulaRef[] = []
  const re = /(?:'[^']+'|"[^"]+")!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|([A-Za-z0-9_\.]+)!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(formula)) !== null) {
    const [match] = m
    if (match.includes('!')) {
      // Has sheet qualifier
      const [sheetRaw, range] = match.split('!')
      const sheet = sheetRaw.replace(/^['"]|['"]$/g, '')
      refs.push({ sheet, range })
    } else {
      // Local sheet reference
      refs.push({ range: match })
    }
  }
  return refs
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    const sheetParam = searchParams.get('sheet') // optional
    const limitParam = searchParams.get('limit')
    const limit = Math.max(0, Math.min(5000, Number(limitParam) || 1000))

    if (!file) {
      return NextResponse.json({ error: "Missing 'file' query param" }, { status: 400 })
    }

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

    await fs.access(absPath)
    const buffer = await fs.readFile(absPath)
    const workbook = read(buffer, { type: 'buffer', cellFormula: true, cellNF: true })

    const result: Array<{
      sheet: string
      address: string
      formula: string
      value?: unknown
      text?: string
      refs: FormulaRef[]
    }> = []

    const edges: Record<string, number> = {}

    const targetSheets = sheetParam
      ? workbook.SheetNames.filter((n) =>
          n.toLowerCase().trim() === sheetParam.toLowerCase().trim() ||
          n.toLowerCase().includes(sheetParam.toLowerCase())
        )
      : workbook.SheetNames

    for (const sheetName of targetSheets) {
      const sheet = workbook.Sheets[sheetName]
      // Iterate all cells on the sheet (keys not starting with '!')
      for (const addr of Object.keys(sheet)) {
        if (addr.startsWith('!')) continue
        const cell = sheet[addr] as any
        if (cell && typeof cell.f === 'string' && cell.f.trim().length) {
          const f = cell.f as string
          const refs = extractRefs(f)

          // Build dependency edges summary: `${fromSheet}:${addr}` -> `${toSheet}:${range}`
          for (const r of refs) {
            const to = `${r.sheet ?? sheetName}:${r.range}`
            edges[to] = (edges[to] ?? 0) + 1
          }

          result.push({
            sheet: sheetName,
            address: addr,
            formula: f,
            value: cell.v,
            text: cell.w,
            refs,
          })

          if (result.length >= limit) break
        }
      }
      if (result.length >= limit) break
    }

    // Heuristics: suggest domain mapping by sheet name
    const domainHints = Object.fromEntries(
      targetSheets.map((n) => [
        n,
        (/evidence/i.test(n) && 'owners/e-mails') ||
          (/export.*send.*mail/i.test(n) && 'salutations for emails') ||
          (/vstup/i.test(n) && 'building input params (period, manager)') ||
          (/faktur/i.test(n) && 'services costs (invoices)') ||
          (/vodom|teplo|elektr|meter|odecet/i.test(n) && 'meter readings') ||
          'unknown',
      ])
    )

    return NextResponse.json({
      file,
      sheetsScanned: targetSheets,
      formulasCount: result.length,
      limit,
      formulas: result,
      edges,
      domainHints,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
