import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { generateBillingPDF } from '@/lib/pdfGenerator'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; resultId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { resultId } = params

    // Načíst vyúčtování s detaily
    const billingResult = await prisma.billingResult.findUnique({
      where: { id: resultId },
      include: {
        billingPeriod: {
          include: {
            building: true
          }
        },
        unit: {
          include: {
            ownerships: {
              where: { validTo: null },
              include: {
                owner: true
              }
            }
          }
        },
        serviceCosts: {
          include: {
            service: true
          },
          orderBy: {
            service: {
              order: 'asc'
            }
          }
        }
      }
    })

    if (!billingResult) {
      return NextResponse.json({ error: 'Billing result not found' }, { status: 404 })
    }

    const building = billingResult.billingPeriod.building
    const owner = billingResult.unit.ownerships[0]?.owner || null

    // Vygenerovat PDF
    const pdfBuffer = await generateBillingPDF({
      building: {
        name: building.name,
        address: building.address,
        city: building.city
      },
      period: billingResult.billingPeriod.year,
      unit: {
        name: billingResult.unit.name,
        unitNumber: billingResult.unit.unitNumber,
        variableSymbol: billingResult.unit.variableSymbol
      },
      owner: owner ? {
        firstName: owner.firstName,
        lastName: owner.lastName,
        address: owner.address,
        email: owner.email
      } : null,
      serviceCosts: billingResult.serviceCosts.map(sc => ({
        service: {
          name: sc.service.name,
          code: sc.service.code
        },
        buildingTotalCost: sc.buildingTotalCost,
        buildingConsumption: sc.buildingConsumption,
        unitConsumption: sc.unitConsumption,
        unitCost: sc.unitCost,
        unitAdvance: sc.unitAdvance,
        unitBalance: sc.unitBalance,
        unitPricePerUnit: sc.unitPricePerUnit,
        distributionBase: sc.distributionBase
      })),
      totalCost: billingResult.totalCost,
      totalAdvancePrescribed: billingResult.totalAdvancePrescribed,
      repairFund: billingResult.repairFund,
      result: billingResult.result
    })

    // Nastavit hlavičky pro stahování PDF
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Disposition', `attachment; filename="Vyuctovani_${billingResult.billingPeriod.year}_${billingResult.unit.unitNumber}.pdf"`)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
