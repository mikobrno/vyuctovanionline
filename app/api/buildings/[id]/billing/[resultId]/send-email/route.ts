import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { sendBillingEmail } from '@/lib/microsoftGraph'
import { getBillingPdfData } from '@/lib/billing-pdf-data'

import { generateBillingQRCode } from '@/lib/qrGenerator'

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

    // Načíst data pro PDF
    const pdfData = await getBillingPdfData(resultId)
    
    if (!pdfData) {
       return NextResponse.json({ error: 'Billing data not found' }, { status: 404 })
    }

    const owner = pdfData.owner

    if (!owner || !owner.email) {
      return NextResponse.json(
        { error: 'Owner email not found' },
        { status: 400 }
      )
    }

    // Vygenerovat QR kód
    const qrCodeUrl = await generateBillingQRCode({
      balance: pdfData.result.result,
      year: pdfData.result.billingPeriod.year,
      unitNumber: pdfData.unit.unitNumber,
      variableSymbol: pdfData.unit.variableSymbol,
      bankAccount: pdfData.building?.bankAccount || null
    });

    // Vygenerovat PDF
    const pdfBase64 = await generateBillingPDFBase64(pdfData, { qrCodeUrl })

    // Odeslat email
    await sendBillingEmail({
      to: owner.email,
      salutation: owner.salutation,
      unitName: pdfData.unit.unitNumber,
      buildingAddress: pdfData.building.address,
      buildingName: pdfData.building.name,
      year: pdfData.result.billingPeriod.year,
      balance: pdfData.result.result,
      managerName: pdfData.building.managerName,
      pdfBase64,
      subjectTemplate: pdfData.building.emailTemplateSubject,
      bodyTemplate: pdfData.building.emailTemplateBody
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
