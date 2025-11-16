import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unitId')
    const period = searchParams.get('period')

    const where: Record<string,unknown> = {}
    if (unitId) where.unitId = unitId
    if (period) where.period = parseInt(period)

    const readings = await prisma.meterReading.findMany({
      where,
      include: {
        meter: {
          include: {
            unit: {
              select: { unitNumber: true }
            },
            service: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { readingDate: 'desc' }
    })

    return NextResponse.json(readings)
  } catch (error) {
    console.error('Error fetching readings:', error)
    return NextResponse.json({ error: 'Chyba při načítání odečtů' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const data = await request.json()

    const reading = await prisma.meterReading.create({
      data: {
        meterId: data.meterId,
        readingDate: new Date(data.readingDate),
        value: parseFloat(data.value),
        period: parseInt(data.period),
        note: data.note || null,
      }
    })

    return NextResponse.json(reading, { status: 201 })
  } catch (error) {
    console.error('Error creating reading:', error)
    return NextResponse.json({ error: 'Chyba při vytváření odečtu' }, { status: 500 })
  }
}
