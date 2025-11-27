import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { services } = body

    if (!Array.isArray(services)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Transaction to update all services
    await prisma.$transaction(
      services.map((service: any) => 
        prisma.service.update({
          where: { id: service.id },
          data: {
            order: service.order,
            methodology: service.method, // Map 'method' from frontend to 'methodology' in DB
            isActive: service.isActive,
            divisor: service.divisor ? parseFloat(service.divisor) : null, // Save manual building units override
            manualCost: service.manualCost !== undefined && service.manualCost !== null && service.manualCost !== '' ? parseFloat(service.manualCost) : null,
            manualShare: service.manualShare !== undefined && service.manualShare !== null && service.manualShare !== '' ? parseFloat(service.manualShare) : null,
            dataSourceName: service.dataSourceName || null,
            dataSourceColumn: service.dataSourceColumn || null,
            customFormula: service.customFormula || null,
            userMergeWithNext: !!service.userMergeWithNext,
            areaSource: service.areaSource || 'TOTAL_AREA',
            // We can add more fields here if needed
          }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating services:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
