import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })

    const buildingId = params.id
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') || new Date().getFullYear())

    // Načíst jednotky a služby
    const [units, services] = await Promise.all([
      prisma.unit.findMany({
        where: { buildingId },
        select: { id: true, unitNumber: true, variableSymbol: true }
      }),
      prisma.service.findMany({
        where: { buildingId, isActive: true },
        select: { id: true, name: true, code: true }
      })
    ])

    // Předpisy z AdvanceMonthly
    const rows = await prisma.advanceMonthly.findMany({
      where: { year, unit: { buildingId }, service: { buildingId } },
      select: { unitId: true, serviceId: true, month: true, amount: true }
    })

    // Základní matice
    const data: Record<string, Record<string, { months: number[]; total: number }>> = {}
    for (const u of units) {
      data[u.id] = {}
      for (const s of services) {
        data[u.id][s.id] = { months: Array(12).fill(0), total: 0 }
      }
    }

    for (const r of rows) {
      const cell = data[r.unitId]?.[r.serviceId]
      if (cell) {
        const idx = Math.max(0, Math.min(11, r.month - 1))
        cell.months[idx] = r.amount
      }
    }

    // Dopočítat součty
    for (const uId of Object.keys(data)) {
      for (const sId of Object.keys(data[uId])) {
        const cell = data[uId][sId]
        cell.total = cell.months.reduce((a, b) => a + b, 0)
      }
    }

    // Platby za rok (součet) a rozpad na služby podle poměru předpisu
    const payments = await prisma.payment.groupBy({
      by: ['unitId'],
      where: { unit: { buildingId }, period: year },
      _sum: { amount: true }
    })

    const paidByUnitService: Record<string, Record<string, number>> = {}
    for (const p of payments) {
      const totalPaid = p._sum.amount || 0
      const unitId = p.unitId
      const serviceTotals = Object.entries(data[unitId] || {}).map(([sid, v]) => ({ sid, total: v.total }))
      const unitTotalPrescribed = serviceTotals.reduce((a, b) => a + b.total, 0)
      paidByUnitService[unitId] = {}
      for (const { sid, total } of serviceTotals) {
        paidByUnitService[unitId][sid] = unitTotalPrescribed > 0 ? (totalPaid * (total / unitTotalPrescribed)) : 0
      }
    }

    return NextResponse.json({ year, units, services, data, paidByUnitService })
  } catch (error) {
    console.error('[Advances GET]', error)
    return NextResponse.json({ message: 'Chyba při načítání předpisů' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })

    const buildingId = params.id
    const body = await req.json()
    const { unitId, serviceId, year, amount, months, mode } = body as {
      unitId: string
      serviceId: string
      year: number
      amount: number
      months?: number[]
      mode?: 'all' | 'months'
    }

    // Ověřit příslušnost k domu
    const [unit, service] = await Promise.all([
      prisma.unit.findFirst({ where: { id: unitId, buildingId } }),
      prisma.service.findFirst({ where: { id: serviceId, buildingId } })
    ])
    if (!unit || !service) return NextResponse.json({ message: 'Jednotka/služba nenalezena' }, { status: 404 })

    const targetMonths = mode === 'months' && Array.isArray(months) && months.length > 0
      ? months
      : [1,2,3,4,5,6,7,8,9,10,11,12]

    // Upsert pro vybrané měsíce
    for (const m of targetMonths) {
      await prisma.advanceMonthly.upsert({
        where: { unitId_serviceId_year_month: { unitId, serviceId, year, month: m } },
        update: { amount },
        create: { unitId, serviceId, year, month: m, amount }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Advances POST]', error)
    return NextResponse.json({ message: 'Chyba při ukládání předpisu' }, { status: 500 })
  }
}
