import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { sendBillingEmail } from '@/lib/microsoftGraph'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; resultId: string }> }
) {
  const params = await props.params;
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
    const owner = billingResult.unit.ownerships[0]?.owner

    if (!owner || !owner.email) {
      return NextResponse.json(
        { error: 'Owner email not found' },
        { status: 400 }
      )
    }

    // Vygenerovat PDF
    const pdfBase64 = await generateBillingPDFBase64({
      building: {
        name: building.name,
        address: building.address,
        city: building.city
      },
      period: billingResult.billingPeriod.year,
      unit: {
        name: billingResult.unit.unitNumber,
        unitNumber: billingResult.unit.unitNumber,
        variableSymbol: billingResult.unit.variableSymbol
      },
      owner: {
        firstName: owner.firstName,
        lastName: owner.lastName,
        address: owner.address,
        email: owner.email
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceCosts: billingResult.serviceCosts.map((sc: any) => ({
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

    // Odeslat email
    await sendBillingEmail({
      to: owner.email,
      salutation: owner.salutation,
      unitName: billingResult.unit.unitNumber,
      buildingAddress: building.address,
      year: billingResult.billingPeriod.year,
      balance: billingResult.result,
      managerName: building.managerName,
      pdfBase64
    })

    // Označit jako odesláno
    await prisma.billingResult.update({
      where: { id: resultId },
      data: {
        emailSent: true,
        emailSentAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Email odeslán na ${owner.email}`
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
