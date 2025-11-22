import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 'A' })

    // Skip header row (assuming row 1 is header)
    // sheet_to_json with header: 'A' returns object with keys A, B, C...
    // Row 1 will be { A: 'ID', B: 'Název', ... }
    // We should start from row 2

    let created = 0
    let updated = 0
    let errors = 0

    // Start from index 1 (row 2)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      
      // Mapping based on screenshot
      // A: ID
      // B: Název
      // C: Adresa
      // D: IČO
      // E: Email pro hlášení
      // F: Domovník - jméno
      // G: Domovník - telefon
      // H: Domovník - email
      // O: Fakturace - adresa (contains Zip and City usually)

      const id = row['A'] ? String(row['A']).trim() : null
      const name = row['B'] ? String(row['B']).trim() : null
      const addressRaw = row['C'] ? String(row['C']).trim() : null
      const ico = row['D'] ? String(row['D']).trim() : null
      const email = row['E'] ? String(row['E']).trim() : null
      const managerName = row['F'] ? String(row['F']).trim() : null
      const managerPhone = row['G'] ? String(row['G']).trim() : null
      const managerEmail = row['H'] ? String(row['H']).trim() : null
      const billingAddress = row['O'] ? String(row['O']).trim() : null

      if (!name) {
        console.warn(`Row ${i + 1}: Missing name, skipping`)
        errors++
        continue
      }

      // Parse City and Zip
      let city = ''
      let zip = ''
      let address = addressRaw || ''

      // Try to parse from billing address if available (usually more complete)
      // Format: "Street Number, District, Zip City"
      // Example: "Dřevařská 851/4, Veveří, 602 00 Brno"
      if (billingAddress) {
        // Regex for Zip: 5 digits, possibly with space
        const zipMatch = billingAddress.match(/(\d{3})\s?(\d{2})/)
        if (zipMatch) {
          zip = `${zipMatch[1]} ${zipMatch[2]}`
          // City is usually after Zip
          const parts = billingAddress.split(zip)
          if (parts.length > 1) {
            city = parts[1].trim().replace(/^,/, '').trim()
          }
        }
      }

      // Fallback parsing from main address if city/zip not found
      if (!city && address) {
        const parts = address.split(',')
        if (parts.length > 1) {
          // Assume last part is City
          city = parts[parts.length - 1].trim()
        }
      }

      // Prepare data
      const data = {
        name,
        address,
        city,
        zip,
        ico,
        email,
        managerName,
        managerPhone,
        managerEmail,
      }

      try {
        if (id && id.length > 10) { // Assume valid ID if long enough
          // Try to update or create with specific ID
          const existing = await prisma.building.findUnique({ where: { id } })
          if (existing) {
            await prisma.building.update({
              where: { id },
              data
            })
            updated++
          } else {
            // Create with specific ID
            await prisma.building.create({
              data: {
                id,
                ...data
              }
            })
            created++
          }
        } else {
          // No ID provided, try to find by name (to avoid duplicates) or create new
          // But name is not unique in schema.
          // Let's just create new for now, or maybe check if name AND address matches?
          // For safety, let's just create new if no ID.
          await prisma.building.create({
            data
          })
          created++
        }
      } catch (e) {
        console.error(`Error processing row ${i + 1}:`, e)
        errors++
      }
    }

    return NextResponse.json({ created, updated, errors })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || 'Import failed' }, { status: 500 })
  }
}
