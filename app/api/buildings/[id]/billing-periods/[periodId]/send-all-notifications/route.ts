import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { sendBillingEmail } from '@/lib/microsoftGraph'
import { getBillingPdfData } from '@/lib/billing-pdf-data'
import { sendBillingSms, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/smsManager'

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
            // Odesíláme těm, kteří nemají odesláno buď email nebo SMS (pokud mají telefon)
            // Zjednodušení: Odesíláme všem, kteří nemají emailSent=true. 
            // SMS se pošle pokud mají telefon a smsSent=false.
            emailSent: false
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
      sentEmail: 0,
      sentSms: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Procházet všechny výsledky a odesílat
    for (const billingResult of billingPeriod.results) {
      const activeOwner = billingResult.unit.ownerships.find(o => {
        const start = o.validFrom;
        const end = o.validTo || new Date(9999, 11, 31);
        return start <= yearEnd && end >= yearStart;
      }) || billingResult.unit.ownerships[0];

      const owner = activeOwner?.owner

      if (!owner) {
        results.skipped++
        results.errors.push(`${billingResult.unit.unitNumber}: Chybí vlastník`)
        continue
      }

      try {
        // Načíst data pro PDF (potřebujeme i pro SMS kvůli konzistenci dat)
        const pdfData = await getBillingPdfData(billingResult.id)
        
        if (!pdfData) {
           throw new Error('Failed to load PDF data')
        }

        // 1. Odeslání Emailu
        if (owner.email && !billingResult.emailSent) {
            try {
                const pdfBase64 = await generateBillingPDFBase64(pdfData)
                
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

                await prisma.billingResult.update({
                  where: { id: billingResult.id },
                  data: { emailSent: true, emailSentAt: new Date() }
                })
                results.sentEmail++
            } catch (e) {
                console.error(`Email failed for ${billingResult.unit.unitNumber}`, e)
                results.errors.push(`${billingResult.unit.unitNumber} Email: ${e instanceof Error ? e.message : 'Error'}`)
            }
        }

        // 2. Odeslání SMS
        const phone = normalizePhoneNumber(owner.phone)
        if (phone && !billingResult.smsSent) {
            try {
                const smsResult = await sendBillingSms({
                    to: phone,
                    ownerName: owner.lastName,
                    unitName: billingResult.unit.unitNumber,
                    year: billingPeriod.year,
                    balance: billingResult.result
                })

                if (smsResult.success) {
                    await prisma.billingResult.update({
                        where: { id: billingResult.id },
                        data: { smsSent: true, smsSentAt: new Date() }
                    })
                    results.sentSms++
                } else {
                    throw new Error(smsResult.error)
                }
            } catch (e) {
                console.error(`SMS failed for ${billingResult.unit.unitNumber}`, e)
                results.errors.push(`${billingResult.unit.unitNumber} SMS: ${e instanceof Error ? e.message : 'Error'}`)
            }
        }

        // Malá pauza
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        results.failed++
        results.errors.push(
          `${billingResult.unit.unitNumber}: ${error instanceof Error ? error.message : 'Neznámá chyba'}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: `Odesláno ${results.sentEmail} emailů a ${results.sentSms} SMS`,
      details: results
    })
  } catch (error) {
    console.error('Error in bulk notification sending:', error)
    return NextResponse.json(
      { error: 'Failed to send notifications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
