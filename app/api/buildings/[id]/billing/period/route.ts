
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json({ message: 'Chybí rok vyúčtování' }, { status: 400 });
    }

    const billingPeriod = await prisma.billingPeriod.findUnique({
      where: {
        buildingId_year: {
          buildingId: id,
          year: parseInt(year)
        }
      }
    });

    if (!billingPeriod) {
      return NextResponse.json({ message: 'Vyúčtování nenalezeno' }, { status: 404 });
    }

    // Smazání všech výsledků a nákladů (díky Cascade delete v Prisma by stačilo smazat Period, ale pro jistotu)
    await prisma.billingPeriod.delete({
      where: { id: billingPeriod.id }
    });

    return NextResponse.json({
      success: true,
      message: `Vyúčtování pro rok ${year} bylo smazáno`
    });
  } catch (error) {
    console.error('[Billing delete]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Chyba při mazání vyúčtování',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const body = await req.json();
    const { status } = body;

    if (!year || !status) {
      return NextResponse.json({ message: 'Chybí parametry' }, { status: 400 });
    }

    const billingPeriod = await prisma.billingPeriod.update({
      where: {
        buildingId_year: {
          buildingId: id,
          year: parseInt(year)
        }
      },
      data: {
        status: status
      }
    });

    return NextResponse.json({
      success: true,
      message: `Status vyúčtování změněn na ${status}`,
      billingPeriod
    });
  } catch (error) {
    console.error('[Billing status update]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Chyba při aktualizaci statusu',
      },
      { status: 500 }
    );
  }
}
