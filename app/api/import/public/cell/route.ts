import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'
import { read } from 'xlsx'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    const sheetParam = searchParams.get('sheet') || 'Vstupní data'
    const addr = searchParams.get('addr') || 'B4'

    if (!file) {
      return NextResponse.json({ error: "Missing 'file' query param, e.g. ?file=data.xlsx" }, { status: 400 })
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

    const workbook = read(buffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames
    const targetName = sheetNames.find((n) => n.toLowerCase().trim() === sheetParam.toLowerCase().trim())
      ?? sheetNames.find((n) => n.toLowerCase().includes(sheetParam.toLowerCase()))

    if (!targetName) {
      return NextResponse.json({ error: `Sheet '${sheetParam}' not found`, sheetNames }, { status: 404 })
    }

    const sheet = workbook.Sheets[targetName]
    const cell = sheet[addr]
    const value = cell?.v ?? null

    return NextResponse.json({ file, sheet: targetName, addr, value })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
