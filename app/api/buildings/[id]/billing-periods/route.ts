import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const buildingId = params.id

    // Načtení všech vyúčtování pro tuto budovu
    const billingPeriods = await prisma.billingPeriod.findMany({
      where: { buildingId },
      include: {
        results: {
          include: {
            unit: {
              include: {
                ownerships: {
                  include: {
                    owner: true
                  }
                }
              }
            },
            serviceCosts: {
              include: {
                service: {
                  select: {
                    name: true,
                    code: true,
                    isActive: true,
                    order: true,
                    serviceGroupId: true,
                    serviceGroup: {
                      select: {
                        label: true
                      }
                    }
                  }
                }
              },
              orderBy: {
                service: {
                  order: 'asc'
                }
              }
            }
          }
        }
      },
      orderBy: { year: 'desc' }
    })

    // Dopočítat totalCosts (součet faktur za rok) pro každý period
    const periodsWithTotals = await Promise.all(
      billingPeriods.map(async (period) => {
        const costSum = await prisma.cost.aggregate({
          where: { buildingId, period: period.year },
          _sum: { amount: true }
        })
        const totalCosts = costSum._sum.amount || 0
        return { ...period, totalCosts }
      })
    )

    return NextResponse.json(periodsWithTotals)
  } catch (error) {
    console.error('Error loading billing periods:', error)
    return NextResponse.json(
      { error: 'Failed to load billing periods' },
      { status: 500 }
    )
  }
}
