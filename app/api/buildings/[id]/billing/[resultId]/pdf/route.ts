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

    // SummaryJson může obsahovat VS pro platbu nedoplatku (odlišný od VS jednotky)
    let summary: Record<string, unknown> = {}
    if (data.result.summaryJson) {
      try {
        summary = JSON.parse(data.result.summaryJson) as Record<string, unknown>
      } catch {
        summary = {}
      }
    }
    const summaryVsRaw = typeof summary.vs === 'string' ? summary.vs : (typeof summary.variableSymbol === 'string' ? summary.variableSymbol : undefined)
    const summaryVs = summaryVsRaw?.trim() || undefined

    const summaryGrandTotalRaw = typeof summary.grandTotal === 'number' ? summary.grandTotal : (typeof summary.grandTotal === 'string' ? summary.grandTotal : undefined)
    const summaryGrandTotal = typeof summaryGrandTotalRaw === 'string'
      ? Number(summaryGrandTotalRaw.replace(/[\s\u00A0]/g, '').replace(',', '.').replace(/[^0-9+\-.]/g, ''))
      : summaryGrandTotalRaw
    const effectiveBalance = (typeof summaryGrandTotal === 'number' && Number.isFinite(summaryGrandTotal)) ? summaryGrandTotal : data.result.result
    
    // 2. Příprava QR kódu (pokud je nedoplatek)
    const qrCodeUrl = await generateBillingQRCode({
      balance: effectiveBalance,
      year: data.result.billingPeriod.year,
      unitNumber: data.unit.unitNumber,
      variableSymbol: summaryVs || data.unit.variableSymbol || null,
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
