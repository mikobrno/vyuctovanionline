import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ ok: false, error: 'NEXTAUTH_SECRET not set' }, { status: 500 })
  }

  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const password = url.searchParams.get('password') ?? 'admin123'

  try {
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.upsert({
      where: { email: 'admin@vyuctovani.cz' },
      update: {
        password: hashed,
        role: 'ADMIN',
        name: 'Administrátor',
      },
      create: {
        email: 'admin@vyuctovani.cz',
        password: hashed,
        role: 'ADMIN',
        name: 'Administrátor',
      },
    })

    return NextResponse.json({ ok: true, user: { email: user.email, role: user.role } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
