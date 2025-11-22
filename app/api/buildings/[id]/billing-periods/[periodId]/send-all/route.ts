import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { sendBillingEmail } from '@/lib/microsoftGraph'
import { getBillingPdfData } from '@/lib/billing-pdf-data'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; periodId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { periodId } = params

    // Načíst období s výsledky
    const billingPeriod = await prisma.billingPeriod.findUnique({
      where: { id: periodId },
      include: {
        building: true,
        results: {
          where: {
            emailSent: false // Jen ty, které ještě nebyly odeslány
          },
          include: {
            unit: {
              include: {
                ownerships: {
                  include: {
                    owner: true
                  },
                  orderBy: {
                    validFrom: 'desc'
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!billingPeriod) {
      return NextResponse.json({ error: 'Billing period not found' }, { status: 404 })
    }

    const year = billingPeriod.year;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Procházet všechny výsledky a odesílat emaily
    for (const billingResult of billingPeriod.results) {
      const activeOwner = billingResult.unit.ownerships.find(o => {
        const start = o.validFrom;
        const end = o.validTo || new Date(9999, 11, 31);
        return start <= yearEnd && end >= yearStart;
      }) || billingResult.unit.ownerships[0];

      const owner = activeOwner?.owner

      if (!owner || !owner.email) {
        results.skipped++
        results.errors.push(`${billingResult.unit.unitNumber}: Chybí email vlastníka`)
        continue
      }

      try {
        // Načíst data pro PDF
        const pdfData = await getBillingPdfData(billingResult.id)
        
        if (!pdfData) {
           throw new Error('Failed to load PDF data')
        }

        // Vygenerovat PDF
        const pdfBase64 = await generateBillingPDFBase64(pdfData)

        // Odeslat email
        await sendBillingEmail({
          to: owner.email,
          salutation: owner.salutation,
          unitName: billingResult.unit.unitNumber,
          buildingAddress: billingPeriod.building.address,
          year: billingPeriod.year,
          balance: billingResult.result,
          managerName: billingPeriod.building.managerName,
          pdfBase64
        })

        // Označit jako odesláno
        await prisma.billingResult.update({
          where: { id: billingResult.id },
          data: {
            emailSent: true,
            emailSentAt: new Date()
          }
        })

        results.sent++

        // Malá pauza mezi emaily aby nedošlo k throttlingu
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        results.failed++
        results.errors.push(
          `${billingResult.unit.unitNumber}: ${error instanceof Error ? error.message : 'Neznámá chyba'}`
        )
        console.error(`Error sending email for ${billingResult.unit.unitNumber}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Odesláno ${results.sent} emailů`,
      details: results
    })
  } catch (error) {
    console.error('Error in bulk email sending:', error)
    return NextResponse.json(
      { error: 'Failed to send emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
