import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { enqueueExportJob } from '@/lib/queues/exportQueue'
import type { TrackExportSummary } from '@/types/track'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'
import type { Prisma } from '@prisma/client'

const mapExportToSummary = (item: Awaited<ReturnType<typeof prisma.communicationExport.findFirst>>) => {
  if (!item) return null
  return {
    id: item.id,
    buildingId: item.buildingId,
    year: item.year,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    completedAt: item.completedAt?.toISOString() ?? null,
    downloadPath: item.storagePath ?? null,
    errorMessage: item.errorMessage ?? null,
  } satisfies TrackExportSummary
}

async function ensureAdminSession() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { error: NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 }) }
  }
  if (session.user.role !== 'ADMIN') {
    return {
      error: NextResponse.json({ error: 'Nemáte oprávnění k exportu' }, { status: 403 }),
    }
  }
  return { session }
}

export async function GET(request: Request) {
  const gate = await ensureAdminSession()
  if (gate.error) return gate.error

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '20'), 1), 100)

    const exports = await prisma.communicationExport.findMany({
      where: {
        buildingId: url.searchParams.get('buildingId') ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const payload: TrackExportSummary[] = exports
      .map((item) => mapExportToSummary(item)!)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/export]', error)
    return NextResponse.json(
      { error: 'TRACK_EXPORTS_FAILED', message: 'Nepodařilo se načíst historii exportů.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const gate = await ensureAdminSession()
  if (gate.error) return gate.error

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { buildingId, year, filters } = body as {
      buildingId?: string
      year?: number
      filters?: Record<string, unknown>
    }

    if (year !== undefined && !Number.isInteger(year)) {
      return NextResponse.json({ error: 'Rok musí být číslo' }, { status: 400 })
    }

    const exportRecord = await prisma.communicationExport.create({
      data: {
        buildingId: buildingId ?? null,
        year: year ?? null,
        filters: (filters ?? undefined) as Prisma.InputJsonValue | undefined,
        status: 'PENDING',
        createdById: gate.session!.user.id,
      },
    })

    await enqueueExportJob({ exportId: exportRecord.id })

    return NextResponse.json(mapExportToSummary(exportRecord), { status: 202 })
  } catch (error) {
    console.error('[TrackCenter][POST /api/track/export]', error)
    return NextResponse.json(
      { error: 'TRACK_EXPORT_CREATE_FAILED', message: 'Export se nepodařilo připravit.' },
      { status: 500 }
    )
  }
}
