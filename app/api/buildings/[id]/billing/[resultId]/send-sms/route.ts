import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendBillingSms, normalizePhoneNumber } from '@/lib/smsManager';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; resultId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: buildingId, resultId } = params;

    // Načíst vyúčtování s informacemi o jednotce a vlastníkovi
    const billingResult = await prisma.billingResult.findUnique({
      where: { id: resultId },
      include: {
        billingPeriod: {
          include: {
            building: true,
          },
        },
        unit: {
          include: {
            ownerships: {
              where: {
                validTo: null, // aktuální vlastník
              },
              include: {
                owner: true,
              },
            },
          },
        },
      },
    });

    if (!billingResult) {
      return NextResponse.json({ error: 'Vyúčtování nenalezeno' }, { status: 404 });
    }

    if (billingResult.billingPeriod.buildingId !== buildingId) {
      return NextResponse.json({ error: 'Neplatné ID budovy' }, { status: 400 });
    }

    // Najít aktuálního vlastníka
    const ownership = billingResult.unit.ownerships[0];
    if (!ownership?.owner) {
      return NextResponse.json({ error: 'Vlastník jednotky nenalezen' }, { status: 404 });
    }

    const owner = ownership.owner;
    
    // Validovat telefonní číslo
    const phoneNumber = normalizePhoneNumber(owner.phone);
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Vlastník nemá platné telefonní číslo' },
        { status: 400 }
      );
    }

    // Odeslat SMS
    const smsResult = await sendBillingSms({
      to: phoneNumber,
      ownerName: `${owner.firstName} ${owner.lastName}`,
      unitName: billingResult.unit.unitNumber,
      year: billingResult.billingPeriod.year,
      balance: billingResult.result,
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { error: `Chyba při odesílání SMS: ${smsResult.error}` },
        { status: 500 }
      );
    }

    // Aktualizovat příznak smsSent v databázi
    await prisma.billingResult.update({
      where: { id: resultId },
      data: {
        smsSent: true,
        smsSentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'SMS úspěšně odeslána',
      messageId: smsResult.messageId,
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json(
      { error: 'Interní chyba serveru' },
      { status: 500 }
    );
  }
}
