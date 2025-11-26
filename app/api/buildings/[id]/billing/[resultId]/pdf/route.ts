import { NextRequest, NextResponse } from 'next/server';
import { getBillingPdfData } from '@/lib/billing-pdf-data';
import { generateBillingPDF } from '@/lib/pdfGenerator';
import { generateBillingQRCode } from '@/lib/qrGenerator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    const { resultId } = await params;

    // 1. Načtení dat
    const data = await getBillingPdfData(resultId);
    
    // 2. Příprava QR kódu (pokud je nedoplatek)
    const qrCodeUrl = await generateBillingQRCode({
      balance: data.result.result,
      year: data.result.billingPeriod.year,
      unitNumber: data.unit.unitNumber,
      variableSymbol: data.unit.variableSymbol,
      bankAccount: data.building?.bankAccount || null
    });

    // 3. Renderování PDF do bufferu
    const pdfBuffer = await generateBillingPDF(data, { qrCodeUrl });

    const safeUnitNumber = data.unit.unitNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const fallbackFilename = `Vyuctovani_${data.result.billingPeriod.year}_${safeUnitNumber}.pdf`;
    const filename = `Vyuctovani_${data.result.billingPeriod.year}_${data.unit.unitNumber}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    // 4. Odeslání odpovědi
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
