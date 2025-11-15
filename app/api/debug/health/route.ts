import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true },
      orderBy: { email: 'asc' },
      take: 10,
    })

    return NextResponse.json({
      ok: true,
      dbConnected: true,
      userCount: users.length,
      users,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, dbConnected: false, error: String(error) }, { status: 500 })
  }
}
