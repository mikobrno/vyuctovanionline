import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { generateBillingPDFBase64 } from '@/lib/pdfGenerator'
import { sendBillingEmail } from '@/lib/microsoftGraph'
import { getBillingPdfData } from '@/lib/billing-pdf-data'

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
    const body = await request.json()
    const email = body.email || 'kost@onlinepsrava.cz'

    const pdfData = await getBillingPdfData(resultId)
    if (!pdfData) {
      return NextResponse.json({ error: 'Billing data not found' }, { status: 404 })
    }

    const pdfBase64 = await generateBillingPDFBase64(pdfData)

    await sendBillingEmail({
      to: email,
      salutation: pdfData.owner?.salutation || (pdfData.owner?.firstName ? `Vážený/á ${pdfData.owner.firstName} ${pdfData.owner.lastName}` : 'Vážený vlastníce'),
      unitName: pdfData.unit.unitNumber,
      buildingAddress: pdfData.building.address,
      year: pdfData.result.billingPeriod.year,
      balance: pdfData.result.result,
      managerName: pdfData.building.managerName || 'Správa',
      pdfBase64
    })

    return NextResponse.json({ success: true, message: `Test email sent to ${email}` })
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
