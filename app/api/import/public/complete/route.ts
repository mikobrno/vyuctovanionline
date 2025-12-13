import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'
import { read } from 'xlsx'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    const buildingName = searchParams.get('buildingName') || ''
    const buildingId = searchParams.get('buildingId') || ''
    const year = searchParams.get('year') || ''

    if (!file) return NextResponse.json({ error: "Missing 'file' query param" }, { status: 400 })

    const publicDir = path.join(process.cwd(), 'public')
    const normalized = path.normalize(file).replace(/^([/\\]+)/, '')
    const absPath = path.join(publicDir, normalized)
    if (!absPath.startsWith(publicDir)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

    await fs.access(absPath)
    const buffer = await fs.readFile(absPath)

    const workbook = read(buffer, { type: 'buffer' })
    const hasExportFull = workbook.SheetNames?.includes('EXPORT_FULL')

    // Build multipart form-data compatible with /api/import/complete
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const fileObj = new File([blob], path.basename(absPath), { type: blob.type })
    const form = new FormData()
    form.set('file', fileObj)
    if (buildingName) form.set('buildingName', buildingName)
    if (buildingId) form.set('buildingId', buildingId)
    if (year) form.set('year', year)

    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    const host = req.headers.get('host')
    if (!host) return NextResponse.json({ error: 'Cannot resolve host' }, { status: 500 })
    const url = `${proto}://${host}${hasExportFull ? '/api/import/snapshot' : '/api/import/complete'}`

    const res = await fetch(url, { method: 'POST', body: form })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Convenience: allow triggering via GET (useful from browser/simple tools)
export async function GET(req: NextRequest) {
  return POST(req)
}
