import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackExportSummary } from '@/types/track'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

const mapExport = (item: Awaited<ReturnType<typeof prisma.communicationExport.findUnique>>) => {
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

export async function GET(
  _request: Request,
  props: { params: Promise<{ exportId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění' }, { status: 403 })
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const record = await prisma.communicationExport.findUnique({
      where: { id: params.exportId },
    })

    if (!record) {
      return NextResponse.json({ error: 'Export nenalezen' }, { status: 404 })
    }

    return NextResponse.json(mapExport(record))
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/export/:exportId]', error)
    return NextResponse.json(
      { error: 'TRACK_EXPORT_DETAIL_FAILED', message: 'Nepodařilo se načíst export.' },
      { status: 500 }
    )
  }
}
