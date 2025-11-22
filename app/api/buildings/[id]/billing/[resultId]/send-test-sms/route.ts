import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { sendBillingSms } from '@/lib/smsManager'
import { getBillingPdfData } from '@/lib/billing-pdf-data'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; resultId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { resultId } = params
    const body = await request.json()
    const phone = body.phone || '777338203'

    const pdfData = await getBillingPdfData(resultId)
    if (!pdfData) {
      return NextResponse.json({ error: 'Billing data not found' }, { status: 404 })
    }

    const result = await sendBillingSms({
      to: phone,
      ownerName: pdfData.owner?.lastName || 'Vlastník',
      salutation: pdfData.owner?.salutation,
      unitName: pdfData.unit.unitNumber,
      year: pdfData.result.billingPeriod.year,
      balance: pdfData.result.result,
      buildingName: pdfData.building.name || pdfData.building.address,
      email: pdfData.owner?.email,
      template: pdfData.building.smsTemplateBody
    })

    if (!result.success) {
      throw new Error(result.error)
    }

    return NextResponse.json({ success: true, message: `Test SMS sent to ${phone}` })
  } catch (error) {
    console.error('Error sending test SMS:', error)
    return NextResponse.json(
      { error: 'Failed to send test SMS', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
