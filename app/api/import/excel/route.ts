interface ColumnDescriptor {
  index: number
  columnNumber: number
  letter: string
  header: string
}

interface MeterReadingRow {
  unitNumber: string
  meterNumber: string
  initialReading: number
  finalReading: number
  consumption: number
  rowNumber: number
  yearlyCost?: number
  radioModule?: string
  externalId?: string
}

interface ImportedReading {
  unitNumber: string
  meterNumber: string
  consumption: number
  initialReading: number
  yearlyCost?: number
  radioModule?: string
  externalId?: string
  status: string
}
import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Soubor nebyl nalezen' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, message: 'Soubor je prázdný' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: 'Soubor je příliš velký (limit 10 MB)' }, { status: 413 })
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ success: false, message: 'Podporované jsou pouze soubory XLS nebo XLSX' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer, { type: 'buffer' })

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ success: false, message: 'Soubor neobsahuje žádné listy' }, { status: 400 })
    }

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      const rows = utils.sheet_to_json(sheet, { defval: null })
      return {
        name,
        rowCount: rows.length,
      }
    })

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const preview = utils.sheet_to_json(firstSheet, { header: 1, defval: '' }).slice(0, 5)

    return NextResponse.json({
      success: true,
      message: 'Soubor úspěšně načten',
      sheets,
      preview,
    })
  } catch (error) {
    console.error('[Excel import]', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Nahrání se nezdařilo. Zkontrolujte prosím formát souboru.',
      },
      { status: 500 }
    )
  }
}
