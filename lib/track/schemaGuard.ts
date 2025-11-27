'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TRACK_SCHEMA_ERROR, TRACK_SCHEMA_MESSAGE } from './constants'

export async function respondIfTrackSchemaMissing() {
  try {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'communications'
      ) AS "exists"
    `

    const trackReady = Boolean(result[0]?.exists)
    if (!trackReady) {
      return NextResponse.json(
        {
          error: TRACK_SCHEMA_ERROR,
          message: TRACK_SCHEMA_MESSAGE,
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[TrackSchemaGuard] Failed to verify track schema', error)
    return NextResponse.json(
      {
        error: TRACK_SCHEMA_ERROR,
        message: TRACK_SCHEMA_MESSAGE,
      },
      { status: 503 }
    )
  }

  return null
}
