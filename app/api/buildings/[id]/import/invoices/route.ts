import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import fs from 'node:fs/promises'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'
import { CalculationMethod, DataSourceType } from '@prisma/client'

export const runtime = 'nodejs'

function normalize(s: unknown) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAmount(v: unknown): number | null {
  const str = String(v ?? '').trim()
  if (!str) return null
  const n = parseFloat(str.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const buildingId = params.id
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    const sheetParam = searchParams.get('sheet') || 'fakt'

    if (!file) return NextResponse.json({ error: "Missing 'file' query param" }, { status: 400 })
    const publicDir = path.join(process.cwd(), 'public')
    const normalized = path.normalize(file).replace(/^([/\\]+)/, '')
    const absPath = path.join(publicDir, normalized)
    if (!absPath.startsWith(publicDir)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

    await fs.access(absPath)
    const buffer = await fs.readFile(absPath)
    const workbook = read(buffer, { type: 'buffer' })

    // Try read billing period from "Vstupni data" (B12) else current year
    let period: number = new Date().getFullYear()
    const vstupName = workbook.SheetNames.find((n) => /vstup/.test(normalize(n)))
    if (vstupName) {
      const vst = workbook.Sheets[vstupName]
      const b12 = vst['B12']?.v
      const p = parseInt(String(b12 ?? '').replace(/\D/g, ''))
      if (Number.isFinite(p)) period = p
    }

    // Find invoices sheet
    const invoicesName =
      workbook.SheetNames.find((n) => normalize(n) === normalize(sheetParam)) ||
      workbook.SheetNames.find((n) => normalize(n).includes(normalize(sheetParam))) ||
      workbook.SheetNames.find((n) => /faktur|invoice/.test(normalize(n)))

    if (!invoicesName) {
      return NextResponse.json({ error: `Invoices sheet not found (param: ${sheetParam})` }, { status: 404 })
    }

    const sheet = workbook.Sheets[invoicesName]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

    const headerRowIndex = raw.findIndex((row) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row.some((cell: any) => {
        const c = normalize(cell)
        return /sluzb|naklad|polozk|faktur/.test(c) || /castk|celkem|cena/.test(c)
      })
    )

    if (headerRowIndex < 0) {
      return NextResponse.json({ error: 'Header row not detected on invoices sheet' }, { status: 400 })
    }

    const headers = (raw[headerRowIndex] || []).map((h) => String(h ?? ''))
    const normHeaders = headers.map(normalize)
    const findIdx = (...patterns: RegExp[]) => normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))

    const idx = {
      service: findIdx(/sluzb/, /naklad/, /polozk/, /popis/),
      methodology: findIdx(/metod/, /zpusob/, /rozuct/),
      amount: findIdx(/castk/, /cena/, /suma/, /celkem/, /bez dph/, /s dph/),
      period: findIdx(/obdobi/, /rok/, /period/),
    }

    const dataRows = raw.slice(headerRowIndex + 1)
    const summary = {
      services: { created: 0, existing: 0, total: 0 },
      costs: { created: 0, total: 0 },
      period,
      sheet: invoicesName,
      warnings: [] as string[],
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      if (!row || row.length === 0) continue
      const serviceName = idx.service >= 0 ? String(row[idx.service] || '').trim() : ''
      const methodology = idx.methodology >= 0 ? String(row[idx.methodology] || '').trim() : ''
      const amount = idx.amount >= 0 ? parseAmount(row[idx.amount]) : null
      const pStr = idx.period >= 0 ? String(row[idx.period] || '').trim() : ''
      const rowPeriod = parseInt(pStr.replace(/\D/g, ''))

      if (!serviceName) continue
      if (!amount || amount === 0) continue

      // Upsert service
      let service = await prisma.service.findFirst({
        where: { buildingId, name: { equals: serviceName, mode: 'insensitive' } },
      })

      const m = methodology.toLowerCase()
      const calcMethod: CalculationMethod = ((): CalculationMethod => {
        if (m.includes('měřidl') || m.includes('odečet')) return CalculationMethod.METER_READING
        if (m.includes('plocha') || m.includes('výměr') || m.includes('vyměr')) return CalculationMethod.AREA
        if (m.includes('osob') || m.includes('osobo')) return CalculationMethod.PERSON_MONTHS
        if (m.includes('byt') || m.includes('jednotk')) return CalculationMethod.FIXED_PER_UNIT
        if (m.includes('rovn')) return CalculationMethod.EQUAL_SPLIT
        if (m.includes('podil') || m.includes('podíl')) return CalculationMethod.OWNERSHIP_SHARE
        return CalculationMethod.OWNERSHIP_SHARE
      })()

      // Derive data source mapping
      const deriveSource = () => {
        if (calcMethod === CalculationMethod.METER_READING) {
          return { dataSourceType: DataSourceType.METER_DATA as DataSourceType, unitAttributeName: null as string | null, measurementUnit: null as string | null }
        }
        if (calcMethod === CalculationMethod.AREA) {
          return { dataSourceType: DataSourceType.UNIT_ATTRIBUTE as DataSourceType, unitAttributeName: 'CELKOVA_VYMERA', measurementUnit: 'm²' }
        }
        if (calcMethod === CalculationMethod.PERSON_MONTHS) {
          return { dataSourceType: DataSourceType.PERSON_MONTHS as DataSourceType, unitAttributeName: null, measurementUnit: 'osobo-měsíc' }
        }
        if (calcMethod === CalculationMethod.FIXED_PER_UNIT) {
          return { dataSourceType: DataSourceType.UNIT_COUNT as DataSourceType, unitAttributeName: null, measurementUnit: null }
        }
        if (calcMethod === CalculationMethod.EQUAL_SPLIT) {
          return { dataSourceType: DataSourceType.UNIT_COUNT as DataSourceType, unitAttributeName: null, measurementUnit: null }
        }
        if (calcMethod === CalculationMethod.OWNERSHIP_SHARE) {
          return { dataSourceType: DataSourceType.UNIT_ATTRIBUTE as DataSourceType, unitAttributeName: 'VLASTNICKY_PODIL', measurementUnit: null }
        }
        return { dataSourceType: null as unknown as DataSourceType, unitAttributeName: null, measurementUnit: null }
      }
      const src = deriveSource()

      if (!service) {
        const baseCode = serviceName.substring(0, 10).toUpperCase().replace(/\s/g, '_').replace(/[^A-Z0-9_]/g, '')
        let uniqueCode = baseCode
        let counter = 1
        // ensure unique per building
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const exists = await prisma.service.findFirst({ where: { buildingId, code: uniqueCode } })
          if (!exists) break
          uniqueCode = `${baseCode}_${counter++}`
        }
        service = await prisma.service.create({
          data: {
            buildingId,
            name: serviceName,
            code: uniqueCode,
            methodology: calcMethod,
            dataSourceType: src.dataSourceType ?? undefined,
            unitAttributeName: src.unitAttributeName ?? undefined,
            measurementUnit: src.measurementUnit ?? undefined,
            isActive: true,
            order: summary.services.total,
          },
        })
        summary.services.created++
      } else {
        // update methodology and data source if changed
        await prisma.service.update({ where: { id: service.id }, data: {
          methodology: calcMethod,
          dataSourceType: src.dataSourceType ?? undefined,
          unitAttributeName: src.unitAttributeName ?? undefined,
          measurementUnit: src.measurementUnit ?? undefined,
        } })
        summary.services.existing++
      }
      summary.services.total++

      const finalPeriod = Number.isFinite(rowPeriod) ? rowPeriod : period
      await prisma.cost.create({
        data: {
          buildingId,
          serviceId: service.id,
          amount: amount,
          description: `Import z Faktur (${invoicesName})`,
          invoiceDate: new Date(`${finalPeriod}-12-31`),
          period: finalPeriod,
        },
      })
      summary.costs.created++
      summary.costs.total++
    }

    return NextResponse.json(summary)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
