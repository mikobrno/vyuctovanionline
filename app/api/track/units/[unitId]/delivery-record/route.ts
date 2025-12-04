import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { PhysicalDeliveryMethod } from '@prisma/client'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

export async function POST(
  request: Request,
  props: { params: Promise<{ unitId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nemáte oprávnění zapisovat doručení' },
      { status: 403 }
    )
  }

  const { unitId } = params
  const body = await request.json().catch(() => ({}))

  const { year, method, dispatchedAt, deliveredAt, note, proofFilePath } = body as {
    year?: number
    method?: PhysicalDeliveryMethod
    dispatchedAt?: string
    deliveredAt?: string
    note?: string
    proofFilePath?: string
  }

  if (!year || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Rok je povinný a musí být číslo' }, { status: 400 })
  }

  if (!method || !Object.values(PhysicalDeliveryMethod).includes(method)) {
    return NextResponse.json({ error: 'Neplatný způsob doručení' }, { status: 400 })
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const unitExists = await prisma.unit.count({ where: { id: unitId } })
    if (!unitExists) {
      return NextResponse.json({ error: 'Jednotka nenalezena' }, { status: 404 })
    }

    const record = await prisma.unitDeliveryRecord.create({
      data: {
        unitId,
        year,
        method,
        dispatchedAt: dispatchedAt ? new Date(dispatchedAt) : null,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : null,
        note: note ?? null,
        proofFilePath: proofFilePath ?? null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({
      id: record.id,
      unitId: record.unitId,
      year: record.year,
      method: record.method,
      dispatchedAt: record.dispatchedAt?.toISOString() ?? null,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
      note: record.note,
      proofFilePath: record.proofFilePath,
    })
  } catch (error) {
    console.error('[TrackCenter][POST /api/track/units/:unitId/delivery-record]', error)
    return NextResponse.json(
      { error: 'TRACK_DELIVERY_RECORD_FAILED', message: 'Záznam doručení se nepodařilo uložit.' },
      { status: 500 }
    )
  }
}
