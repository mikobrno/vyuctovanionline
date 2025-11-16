import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface ReadingRow {
  unitNumber: string
  ownerName: string
  meterType: string
  initialReading: number
  finalReading: number
  consumption: number
}

interface ImportedReading {
  unitNumber: string
  ownerName: string
  meterType: string
  consumption: number
  created: boolean
}

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const buildingId = formData.get('buildingId') as string
    const year = formData.get('year') as string

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Soubor s odečty nebyl přiložen. Nahrajte prosím XLS/XLSX soubor.' }, { status: 400 })
    }

    if (!buildingId) {
      return NextResponse.json({ success: false, message: 'Není vybrána budova, pro kterou se mají odečty importovat.' }, { status: 400 })
    }

    if (!year) {
      return NextResponse.json({ success: false, message: 'Není vyplněn rok vyúčtování. Zadejte prosím rok (např. 2024).' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, message: 'Nahraný soubor je prázdný. Zkontrolujte prosím, že v něm jsou data.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: 'Soubor je příliš velký (limit 10 MB). Rozdělte ho prosím na menší části.' }, { status: 413 })
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ success: false, message: 'Nepodporovaný formát souboru. Nahrajte prosím soubor typu XLS nebo XLSX.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer, { type: 'buffer' })

    const allReadings: ReadingRow[] = []
    const errors: string[] = []
    const foundSheets: string[] = []

    // Projít všechny záložky a najít ty s odečty
    for (const sheetName of workbook.SheetNames) {
      const normalizedSheetName = sheetName.toLowerCase().trim()
      const meterType = SHEET_TO_METER_TYPE[normalizedSheetName]

      if (!meterType) continue

      foundSheets.push(sheetName)
      const sheet = workbook.Sheets[sheetName]

      // Načíst data z řádků
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

      // Najít řádek s hlavičkou
      const headerRowIndex = rawData.findIndex(row => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.some((cell: any) => {
          const cellStr = String(cell).toLowerCase()
          return cellStr.includes('byt') || cellStr.includes('jednotka') || cellStr.includes('318')
        })
      )

      if (headerRowIndex === -1) {
        errors.push(`${sheetName}: Nepodařilo se najít řádek s hlavičkou (očekává se sloupec "Byt"/"Jednotka").`)
        continue
      }

      // Zpracovat řádky s daty
      const dataRows = rawData.slice(headerRowIndex + 1)

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]

        // Přeskočit prázdné řádky
        if (!row || row.length === 0 || !row[0]) continue

        const unitNumber = String(row[0] || '').trim() // Sloupec A - číslo bytu
        const ownerName = String(row[1] || '').trim() // Sloupec B - vlastník
        
        // Pro různé typy měřidel jsou sloupce na jiných pozicích
        // Obecně: G = počáteční stav, H = odečtená hodnota, I = spotřeba
        let initialReading = 0
        let finalReading = 0
        let consumption = 0

        if (meterType === 'HEATING') {
          // Teplo: F = počáteční stav, G = konečný stav, sloupec I nebo J = spotřeba
          initialReading = parseFloat(String(row[5] || '0').replace(/\s/g, '').replace(',', '.')) || 0
          finalReading = parseFloat(String(row[6] || '0').replace(/\s/g, '').replace(',', '.')) || 0
          consumption = parseFloat(String(row[8] || '0').replace(/\s/g, '').replace(',', '.')) || 0
        } else {
          // Vodoměry a elektroměry: G = počáteční, H = konečný, I = spotřeba
          initialReading = parseFloat(String(row[6] || '0').replace(/\s/g, '').replace(',', '.')) || 0
          finalReading = parseFloat(String(row[7] || '0').replace(/\s/g, '').replace(',', '.')) || 0
          consumption = parseFloat(String(row[8] || '0').replace(/\s/g, '').replace(',', '.')) || 0
        }

        // Přeskočit pokud není číslo bytu nebo spotřeba
        if (!unitNumber || unitNumber === 'Bazén' || consumption === 0) continue

        // Pokud spotřeba není vyplněná, vypočítat ji
        if (consumption === 0 && finalReading > initialReading) {
          consumption = finalReading - initialReading
        }

        if (consumption <= 0) continue

        allReadings.push({
          unitNumber,
          ownerName,
          meterType,
          initialReading,
          finalReading,
          consumption
        })
      }
    }

    if (foundSheets.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'V souboru nebyly nalezeny záložky s odečty. Očekávané názvy: "Vodoměry TUV", "Vodoměry SV", "Teplo", "Elektroměry".',
        availableSheets: workbook.SheetNames
      }, { status: 400 })
    }

    if (allReadings.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Na nalezených záložkách nebyly rozpoznány žádné řádky s odečty. Zkontrolujte prosím, že jsou vyplněny sloupce A–I.',
        foundSheets,
        errors
      }, { status: 400 })
    }

    // Načíst jednotky
    const units = await prisma.unit.findMany({
      where: { buildingId },
      include: {
        meters: true
      }
    })

    const unitMap = new Map(units.map(u => [u.unitNumber, u]))

    // Načíst nebo vytvořit služby pro každý typ měřidla
    const services = await prisma.service.findMany({
      where: { buildingId }
    })

    const serviceMap = new Map<string, string>()
    
    for (const [meterType, label] of Object.entries(METER_TYPE_LABELS)) {
      let service = services.find(s => s.name.includes(label) || s.code.includes(meterType))
      
      if (!service) {
        service = await prisma.service.create({
          data: {
            buildingId,
            name: label,
            code: meterType,
            methodology: 'měřidla',
            measurementUnit: meterType === 'HEATING' ? 'kWh' : meterType.includes('WATER') ? 'm³' : 'kWh',
            isActive: true
          }
        })
      }
      
      serviceMap.set(meterType, service.id)
    }

    // Vytvořit odečty a měřidla
    const created: ImportedReading[] = []
    const skipped: string[] = []

    for (const reading of allReadings) {
      const unit = unitMap.get(reading.unitNumber)

      if (!unit) {
        skipped.push(`${reading.unitNumber} (${reading.ownerName}): Jednotka nenalezena`)
        continue
      }

      // Najít nebo vytvořit měřidlo
      let meter = unit.meters.find(m => m.type === reading.meterType && m.isActive)

      if (!meter) {
        const serviceId = serviceMap.get(reading.meterType)
        meter = await prisma.meter.create({
          data: {
            unitId: unit.id,
            serialNumber: `${reading.unitNumber}-${reading.meterType}`,
            type: reading.meterType as any,
            initialReading: reading.initialReading,
            serviceId,
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
          value: reading.finalReading,
          consumption: reading.consumption,
          period: parseInt(year),
          note: `Import z Excelu - ${reading.ownerName}`
        }
      })

      created.push({
        unitNumber: reading.unitNumber,
        ownerName: reading.ownerName,
        meterType: METER_TYPE_LABELS[reading.meterType] || reading.meterType,
        consumption: reading.consumption,
        created: true
      })
    }

    return NextResponse.json({
      success: true,
      message: `Úspěšně importováno ${created.length} odečtů ze záložek: ${foundSheets.join(', ')}`,
      imported: created,
      skipped,
      errors,
      foundSheets
    })

  } catch (error) {
    console.error('[Readings import]', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Import se nezdařil: ' + (error instanceof Error ? error.message : 'Neznámá chyba'),
      },
      { status: 500 }
    )
  }
}
