import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// Mapování kódů předpisů (sloupec M v Excelu) na klíče v JSON predpisy
const EXCEL_CODE_TO_JSON_KEY: Record<string, string> = {
  'BN': 'opravy',           // Fond společenství/oprav
  'N': 'sprava',            // Správa
  'AA': 'voda',             // Vodné a stočné
  'AN': 'teplo',            // Teplo
  'DA': 'elektrika',        // Elektřina
  'DN': 'uklid',            // Úklid vnitřní
  'CA': 'pojisteni',        // Pojištění domu
  'EA': 'bazen',            // Bazén (speciální)
  'IA': 'uklid_venkovni',   // Úklid venkovní
  'BA': 'tuv',              // Ohřev teplé vody (TUV)
  'XA': 'komin',            // Komíny
  'YA': 'vytah',            // Výtah
  'ZA': 'internet',         // Internet
  'UA': 'sta',              // STA (společná anténa)
  'VA': 'ostatni_upc',      // Ostatní náklady UPC
  'WA': 'statutari',        // Odměna výboru
}

interface ServiceRow {
  name: string
  method?: string
  share?: number
  cost?: number
  excelCode?: string
}

// POST - nahrání Excel souboru s mapováním služeb
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const buildingId = url.searchParams.get('buildingId')
    
    if (!buildingId) {
      return NextResponse.json({ error: 'Chybí buildingId' }, { status: 400 })
    }
    
    // Ověření že budova existuje
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      include: { services: true }
    })
    
    if (!building) {
      return NextResponse.json({ error: 'Budova nenalezena' }, { status: 404 })
    }
    
    // Načtení FormData s Excel souborem
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'Chybí soubor' }, { status: 400 })
    }
    
    // Načtení Excel souboru
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    // PRIORITA: Hledáme list "Faktury" - tam jsou služby se sloupcem M pro kód předpisu
    const possibleSheetNames = ['Faktury', 'faktury', 'FAKTURY', 'vstupní data', 'vstupni data', 'služby', 'sluzby']
    let sheet: XLSX.WorkSheet | null = null
    let sheetName = ''
    
    for (const name of possibleSheetNames) {
      if (workbook.SheetNames.includes(name)) {
        sheet = workbook.Sheets[name]
        sheetName = name
        break
      }
    }
    
    // Fallback na první list
    if (!sheet && workbook.SheetNames.length > 0) {
      sheetName = workbook.SheetNames[0]
      sheet = workbook.Sheets[sheetName]
    }
    
    if (!sheet) {
      return NextResponse.json({ error: 'Excel neobsahuje žádný list' }, { status: 400 })
    }
    
    // Parsování dat z Excelu
    // List "Faktury": Sloupec A = název služby, Sloupec M (index 12) = kód předpisu
    const services: ServiceRow[] = []
    
    // Převod na JSON pro snadnější práci
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    
    // Pro list "Faktury" - přímé čtení:
    // - Sloupec A (index 0) = název služby  
    // - Sloupec M (index 12) = kód předpisu (SN, N, AA, AN, DA, DN, CA, EA, IA, BA, ...)
    const serviceCol = 0  // Sloupec A
    let codeCol = 12      // Sloupec M (výchozí)
    
    // Pokud je to list "Faktury", začínáme od řádku 2 (index 1), protože řádek 1 může být hlavička nebo "0"
    let startRow = 1
    
    // Zkontrolujeme, zda první řádek obsahuje hlavičku nebo data
    if (data[0]) {
      const firstCell = String(data[0][0] || '').toLowerCase()
      if (firstCell === '0' || firstCell === '' || firstCell.includes('služba')) {
        startRow = 1 // Přeskočíme první řádek
      } else {
        startRow = 0
      }
    }
    
    // Hledáme sloupec s kódy předpisů (pokud není na pozici M)
    // Procházíme první datové řádky a hledáme sloupec obsahující typické kódy
    const typicalCodes = ['BN', 'SN', 'N', 'AA', 'AN', 'DA', 'DN', 'CA', 'EA', 'IA', 'BA', 'XA', 'YA', 'ZA']
    
    for (let i = startRow; i < Math.min(data.length, 25); i++) {
      const row = data[i]
      if (!row) continue
      
      // Procházíme sloupce od K (index 10) do P (index 15)
      for (let j = 10; j <= 15; j++) {
        const val = String(row[j] || '').trim().toUpperCase()
        if (typicalCodes.includes(val)) {
          codeCol = j
          break
        }
      }
      if (codeCol !== 12) break // Našli jsme jiný sloupec
    }
    
    // Načtení služeb z řádků
    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      if (!row) continue
      
      const serviceName = String(row[serviceCol] || '').trim()
      // Přeskočíme prázdné řádky, celkem, nebo služby s názvem "0"
      if (!serviceName || serviceName === '0' || serviceName.toLowerCase().includes('celkem')) continue
      
      const excelCode = String(row[codeCol] || '').trim().toUpperCase()
      
      if (serviceName) {
        services.push({
          name: serviceName,
          excelCode: excelCode || undefined,
          method: undefined,
          cost: undefined
        })
      }
    }
    
    if (services.length === 0) {
      return NextResponse.json({ 
        error: 'Nepodařilo se načíst služby z Excelu. Ujistěte se, že soubor obsahuje list "Faktury" se sloupcem A (názvy služeb) a sloupcem M (kódy předpisů).',
        debug: { sheetName, codeCol, startRow, rowCount: data.length, availableSheets: workbook.SheetNames }
      }, { status: 400 })
    }
    
    // Vytvoření nebo aktualizace služeb v DB
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      services: [] as { name: string, excelCode: string | null, jsonKey: string | null, action: string }[]
    }
    
    for (const svc of services) {
      // Přeskočíme služby bez názvu nebo s "Prázdné"
      if (!svc.name || svc.name.toLowerCase().includes('prázdné') || svc.name.toLowerCase() === 'fond oprav') {
        results.skipped++
        continue
      }
      
      // Najdeme JSON klíč podle Excel kódu
      const jsonKey = svc.excelCode ? EXCEL_CODE_TO_JSON_KEY[svc.excelCode] || null : null
      
      // Normalizovaný kód pro DB
      const code = svc.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20)
      
      // Hledáme existující službu podle názvu
      const existingService = building.services.find(s => 
        s.name.toLowerCase() === svc.name.toLowerCase() ||
        s.code === code
      )
      
      if (existingService) {
        // Aktualizace - přidáme excelColumn a advancePaymentColumn
        await prisma.service.update({
          where: { id: existingService.id },
          data: {
            excelColumn: svc.excelCode || null,
            advancePaymentColumn: jsonKey || null,
          }
        })
        results.updated++
        results.services.push({ 
          name: svc.name, 
          excelCode: svc.excelCode || null, 
          jsonKey,
          action: 'updated'
        })
      } else {
        // Vytvoření nové služby
        await prisma.service.create({
          data: {
            buildingId,
            name: svc.name,
            code,
            excelColumn: svc.excelCode || null,
            advancePaymentColumn: jsonKey || null,
            order: results.created + results.updated,
            isActive: true
          }
        })
        results.created++
        results.services.push({ 
          name: svc.name, 
          excelCode: svc.excelCode || null, 
          jsonKey,
          action: 'created'
        })
      }
    }
    
    // Označíme budovu jako "má mapování služeb"
    // (volitelně můžeme přidat pole do Building modelu)
    
    return NextResponse.json({
      success: true,
      building: { id: building.id, name: building.name },
      results,
      message: `Vytvořeno ${results.created} služeb, aktualizováno ${results.updated}, přeskočeno ${results.skipped}`
    })
    
  } catch (error) {
    console.error('Service mapping import error:', error)
    return NextResponse.json({ 
      error: 'Chyba při importu mapování služeb',
      details: error instanceof Error ? error.message : 'Neznámá chyba'
    }, { status: 500 })
  }
}

// GET - vrací aktuální mapování služeb pro budovu
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const buildingId = url.searchParams.get('buildingId')
    
    if (!buildingId) {
      return NextResponse.json({ error: 'Chybí buildingId' }, { status: 400 })
    }
    
    const services = await prisma.service.findMany({
      where: { buildingId },
      select: {
        id: true,
        name: true,
        code: true,
        excelColumn: true,
        advancePaymentColumn: true,
        isActive: true,
        order: true
      },
      orderBy: { order: 'asc' }
    })
    
    const hasMapping = services.some(s => s.excelColumn || s.advancePaymentColumn)
    
    return NextResponse.json({
      buildingId,
      hasMapping,
      servicesCount: services.length,
      mappedCount: services.filter(s => s.advancePaymentColumn).length,
      services
    })
    
  } catch (error) {
    console.error('Get service mapping error:', error)
    return NextResponse.json({ 
      error: 'Chyba při načítání mapování služeb'
    }, { status: 500 })
  }
}
