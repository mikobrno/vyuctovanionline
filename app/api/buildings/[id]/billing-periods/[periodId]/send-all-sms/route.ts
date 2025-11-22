import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendBillingSms, normalizePhoneNumber } from '@/lib/smsManager';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; periodId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: buildingId, periodId } = params;

    // Načíst vyúčtovací období s výsledky, které ještě nebyly odeslány SMS
    const billingPeriod = await prisma.billingPeriod.findUnique({
      where: { id: periodId },
      include: {
        building: true,
        results: {
          where: {
            smsSent: false,
          },
          include: {
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
        },
      },
    });

    if (!billingPeriod) {
      return NextResponse.json(
        { error: 'Vyúčtovací období nenalezeno' },
        { status: 404 }
      );
    }

    if (billingPeriod.buildingId !== buildingId) {
      return NextResponse.json({ error: 'Neplatné ID budovy' }, { status: 400 });
    }

    const results = billingPeriod.results;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Projít všechny výsledky a odeslat SMS
    for (const result of results) {
      const ownership = result.unit.ownerships[0];
      
      if (!ownership?.owner) {
        skipped++;
        errors.push(`Jednotka ${result.unit.unitNumber}: Vlastník nenalezen`);
        continue;
      }

      const owner = ownership.owner;
      const phoneNumber = normalizePhoneNumber(owner.phone);

      if (!phoneNumber) {
        skipped++;
        errors.push(
          `Jednotka ${result.unit.unitNumber}: Vlastník ${owner.firstName} ${owner.lastName} nemá platné telefonní číslo`
        );
        continue;
      }

      try {
        // Odeslat SMS
        const smsResult = await sendBillingSms({
          to: phoneNumber,
          ownerName: `${owner.firstName} ${owner.lastName}`,
          unitName: result.unit.unitNumber,
          year: billingPeriod.year,
          balance: result.result,
        });

        if (smsResult.success) {
          // Aktualizovat příznak smsSent
          await prisma.billingResult.update({
            where: { id: result.id },
            data: {
              smsSent: true,
              smsSentAt: new Date(),
            },
          });
          sent++;
        } else {
          failed++;
          errors.push(
            `Jednotka ${result.unit.unitNumber}: ${smsResult.error}`
          );
        }

        // Pauza 1 sekunda mezi SMS (throttle protection)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Neznámá chyba';
        errors.push(`Jednotka ${result.unit.unitNumber}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Hromadné odesílání dokončeno: ${sent} odesláno, ${skipped} přeskočeno, ${failed} selhalo`,
      details: {
        sent,
        skipped,
        failed,
        errors,
      },
    });
  } catch (error) {
    console.error('Error sending bulk SMS:', error);
    return NextResponse.json(
      { error: 'Interní chyba serveru' },
      { status: 500 }
    );
  }
}
