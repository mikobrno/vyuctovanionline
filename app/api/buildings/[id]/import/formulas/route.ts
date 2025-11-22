import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { CalculationMethod } from '@prisma/client';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('file');
    const sheetName = searchParams.get('sheet') || 'faktury';
    const buildingId = params.id;

    if (!fileName) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'import', fileName);
    
    // Check if file exists
    try {
        await import('fs').then(fs => fs.promises.access(filePath));
    } catch {
        return NextResponse.json({ error: `File not found: ${fileName}` }, { status: 404 });
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return NextResponse.json({ error: `Sheet ${sheetName} not found` }, { status: 404 });
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    // Find header row
    let headerRowIndex = -1;
    let nameColIndex = -1;
    let methodColIndex = -1;

    // Search for headers in first 20 rows
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i] as unknown[];
      if (!row) continue;
      
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase();
        if (cell.includes('položka') || cell.includes('služba') || cell.includes('název')) {
          headerRowIndex = i;
          nameColIndex = j;
        }
        if (cell.includes('klíč') || cell.includes('metoda') || cell.includes('způsob') || cell.includes('rozdělení')) {
          methodColIndex = j;
        }
      }
      if (headerRowIndex !== -1 && methodColIndex !== -1) break;
    }

    // Fallback if headers not found perfectly
    if (headerRowIndex === -1) {
       // Try to guess based on data structure (usually row 9 or 10)
       headerRowIndex = 9; 
       nameColIndex = 0;
    }

    // If method column not found by header, try to find it by content
    if (methodColIndex === -1) {
        const potentialCols = new Map<number, number>();
        
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 20, data.length); i++) {
            const row = data[i] as unknown[];
            if (!row) continue;
            
            for (let j = 0; j < row.length; j++) {
                if (j === nameColIndex) continue;
                const val = String(row[j] || '').toLowerCase();
                if (val.includes('osob') || val.includes('ploch') || val.includes('podíl') || val.includes('rovn') || val.includes('měřid')) {
                    potentialCols.set(j, (potentialCols.get(j) || 0) + 1);
                }
            }
        }
        
        // Find column with most matches
        let maxMatches = 0;
        for (const [col, count] of potentialCols.entries()) {
            if (count > maxMatches) {
                maxMatches = count;
                methodColIndex = col;
            }
        }
    }

    const updates = [];
    const warnings = [];

    if (methodColIndex === -1) {
        warnings.push('Nepodařilo se detekovat sloupec s metodikou rozúčtování. Služby budou nastaveny na CUSTOM.');
    }

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (!row) continue;
      
      const name = row[nameColIndex];
      
      if (!name || String(name).trim() === '' || String(name).includes('Celkem')) continue;

      const methodText = methodColIndex !== -1 ? String(row[methodColIndex] || '') : '';
      let method: CalculationMethod = 'CUSTOM';
      
      // Normalize text
      const lowerMethod = methodText.toLowerCase();

      if (lowerMethod.includes('osob')) {
        method = 'PERSON_MONTHS';
      } else if (lowerMethod.includes('ploch') || lowerMethod.includes('m2')) {
        method = 'AREA';
      } else if (lowerMethod.includes('podíl') || lowerMethod.includes('spoluvl')) {
        method = 'OWNERSHIP_SHARE';
      } else if (lowerMethod.includes('rovn')) {
        method = 'EQUAL_SPLIT';
      } else if (lowerMethod.includes('měřid') || lowerMethod.includes('vodom') || lowerMethod.includes('kalor')) {
        method = 'METER_READING';
      } else if (lowerMethod.includes('fix')) {
        method = 'FIXED_PER_UNIT';
      }

      const code = String(name).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 20);

      // Update service
      const service = await prisma.service.upsert({
        where: {
            buildingId_code: {
                buildingId,
                code
            }
        },
        update: {
            methodology: method
        },
        create: {
            buildingId,
            name: String(name).trim(),
            code,
            methodology: method
        }
      });
      
      updates.push({ name: service.name, method, originalText: methodText });
    }

    return NextResponse.json({ 
        success: true, 
        updated: updates.length, 
        details: updates,
        warnings 
    });

  } catch (error: unknown) {
    console.error('Error importing formulas:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
