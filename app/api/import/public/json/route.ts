import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    const buildingId = searchParams.get('buildingId') || ''

    if (!file) return NextResponse.json({ error: "Missing 'file' query param" }, { status: 400 })

    const publicDir = path.join(process.cwd(), 'public')
    const normalized = path.normalize(file).replace(/^([/\\]+)/, '')
    const absPath = path.join(publicDir, normalized)
    if (!absPath.startsWith(publicDir)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

    await fs.access(absPath)
    const buffer = await fs.readFile(absPath)

    // Build multipart form-data compatible with /api/import/json
    const blob = new Blob([buffer], { type: 'application/json' })
    const fileObj = new File([blob], path.basename(absPath), { type: blob.type })
    const form = new FormData()
    form.set('file', fileObj)
    if (buildingId) form.set('buildingId', buildingId)

    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    const host = req.headers.get('host')
    if (!host) return NextResponse.json({ error: 'Cannot resolve host' }, { status: 500 })
    const url = `${proto}://${host}/api/import/json`

    const res = await fetch(url, { method: 'POST', body: form })
    
    // Forward streaming response as-is
    if (!res.body) {
      return NextResponse.json({ error: 'No response body' }, { status: 500 })
    }
    
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Convenience: allow triggering via GET (useful from browser/simple tools)
export async function GET(req: NextRequest) {
  return POST(req)
}
