import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const buildingId = params.id
    const url = new URL(req.url)
    const fileName = url.searchParams.get('file')
    const sheetName = url.searchParams.get('sheet') || 'Vstupní data'

    if (!fileName) {
      return NextResponse.json({ error: 'Chybí parametr file' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'public', 'import', fileName)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Soubor nenalezen' }, { status: 404 })
    }

    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      return NextResponse.json({ error: `List ${sheetName} nenalezen` }, { status: 404 })
    }

    // Načtení služeb z listu "Vstupní data"
    // Specifikace: Sloupce S (index 18) až AN (index 39)
    // Název služby: Řádek 31 (index 30)
    // Odkaz na "Předpis po mesici": Řádek 30 (index 29)
    
    const START_COL_INDEX = XLSX.utils.decode_col('S'); // 18
    const END_COL_INDEX = XLSX.utils.decode_col('AN'); // 39
    const ROW_SERVICE_NAME = 30; // Řádek 31
    const ROW_REFERENCE = 29;    // Řádek 30

    const VALID_SUM_COLS = new Set(['N', 'AA', 'AN', 'BA', 'BN', 'CA', 'CN', 'DA', 'DN', 'EA', 'EN', 'FA', 'FN', 'GA', 'GN', 'HA', 'HN', 'IA', 'IN', 'JA']);

    const servicesFound = []
    let createdCount = 0
    let updatedCount = 0

    for (let C = START_COL_INDEX; C <= END_COL_INDEX; C++) {
      const serviceNameCell = sheet[XLSX.utils.encode_cell({ r: ROW_SERVICE_NAME, c: C })]
      const referenceCell = sheet[XLSX.utils.encode_cell({ r: ROW_REFERENCE, c: C })]

      if (serviceNameCell && serviceNameCell.v) {
        const serviceName = String(serviceNameCell.v).trim()
        let advanceCol = null

        // Analýza reference na řádku 30
        if (referenceCell) {
            // 1. Zkusíme získat vzorec (f) nebo hodnotu (v)
            const rawValue = referenceCell.f || referenceCell.v || '';
            const strValue = String(rawValue);

            // 2. Hledáme odkaz na list "Předpis po mesici" a sloupec
            // Příklady: "='Předpis po mesici'!N5", "'Předpis po mesici'!AA10", nebo jen "N"
            
            // Regex pro extrakci sloupce z vzorce typu Sheet!ColRow
            const formulaMatch = strValue.match(/['"]?Předpis po mesici['"]?!([A-Z]+)\d+/i);
            
            if (formulaMatch && formulaMatch[1]) {
                const colLetter = formulaMatch[1].toUpperCase();
                if (VALID_SUM_COLS.has(colLetter)) {
                    advanceCol = colLetter;
                }
            } else {
                // Fallback: Pokud je tam napsáno jen písmeno sloupce
                const cleanValue = strValue.trim().toUpperCase();
                if (VALID_SUM_COLS.has(cleanValue)) {
                    advanceCol = cleanValue;
                }
            }
        }

        if (serviceName) {
          // Normalizace kódu služby
          const code = serviceName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')

          // Upsert služby
          const service = await prisma.service.upsert({
            where: {
              buildingId_code: {
                buildingId,
                code
              }
            },
            update: {
              name: serviceName,
              advancePaymentColumn: advanceCol // Aktualizujeme sloupec zálohy
            },
            create: {
              buildingId,
              name: serviceName,
              code,
              advancePaymentColumn: advanceCol,
              methodology: 'OWNERSHIP_SHARE' // Default
            }
          })

          if (service.createdAt.getTime() === service.updatedAt.getTime()) {
            createdCount++
          } else {
            updatedCount++
          }
          servicesFound.push({ name: serviceName, col: advanceCol })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import dokončen. Vytvořeno: ${createdCount}, Aktualizováno: ${updatedCount}`,
      services: servicesFound
    })

  } catch (error: any) {
    console.error('Import services error:', error)
    return NextResponse.json({ error: error.message || 'Chyba importu' }, { status: 500 })
  }
}
