import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { generateBillingQRCode } from '@/lib/qrGenerator'
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

    let selectedResultIds: string[] | null = null
    try {
      const body = await request.json()
      if (body && Array.isArray(body.resultIds) && body.resultIds.length > 0) {
        selectedResultIds = body.resultIds
      }
    } catch {
      // request without JSON body -> ignore
    }

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

    const periodResults = selectedResultIds
      ? billingPeriod.results.filter(result => selectedResultIds?.includes(result.id))
      : billingPeriod.results

    if (periodResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nebyla vybrána žádná jednotka k odeslání'
      }, { status: 400 })
    }

    // Procházet všechny výsledky a odesílat
    for (const billingResult of periodResults) {
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
                const qrCodeUrl = await generateBillingQRCode({
                  balance: pdfData.result.result,
                  year: pdfData.result.billingPeriod.year,
                  unitNumber: pdfData.unit.unitNumber,
                  variableSymbol: pdfData.unit.variableSymbol,
                  bankAccount: pdfData.building?.bankAccount || null
                });

                const pdfBase64 = await generateBillingPDFBase64(pdfData, { qrCodeUrl })
                
                await sendBillingEmail({
                  to: owner.email,
                  salutation: owner.salutation,
                  unitName: billingResult.unit.unitNumber,
                  buildingAddress: billingPeriod.building.address,
                  buildingName: billingPeriod.building.name,
                  year: billingPeriod.year,
                  balance: billingResult.result,
                  managerName: billingPeriod.building.managerName,
                  pdfBase64,
                  subjectTemplate: billingPeriod.building.emailTemplateSubject,
                  bodyTemplate: billingPeriod.building.emailTemplateBody
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
                    salutation: owner.salutation,
                    unitName: billingResult.unit.unitNumber,
                    year: billingPeriod.year,
                    balance: billingResult.result,
                    buildingName: billingPeriod.building.name || billingPeriod.building.address,
                    email: owner.email,
                  template: billingPeriod.building.smsTemplateBody,
                  managerName: billingPeriod.building.managerName,
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
