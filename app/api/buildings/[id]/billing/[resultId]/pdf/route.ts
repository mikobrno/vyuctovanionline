import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { getBillingPdfData } from '@/lib/billing-pdf-data';
import { BillingDocument } from '@/components/pdf/BillingDocument';
import React from 'react';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    const { resultId } = await params;

    // 1. Načtení dat
    const data = await getBillingPdfData(resultId);
    
    // 2. Příprava QR kódu (pokud je nedoplatek)
    let qrCodeUrl: string | undefined = undefined;
    const balance = Math.round(data.result.balance);
    
    if (balance < 0) {
      const amount = Math.abs(balance);
      const account = data.building?.bankAccount || ''; // Formát IBAN by byl ideální
      const vs = data.unit.variableSymbol || '';
      const msg = `Vyuctovani ${data.result.year} - ${data.unit.unitNumber}`;
      
      // SPAY formát (Short Payment Descriptor)
      // Poznámka: Pro reálné použití by měl být účet ve formátu IBAN.
      // Pokud máte jen české číslo účtu, je třeba ho převést na IBAN nebo použít jiný formát, 
      // ale SPAY vyžaduje IBAN pro klíč ACC.
      // Zde pro demo předpokládáme, že accountNumber je IBAN nebo to knihovna zvládne.
      if (account) {
        const spayString = `SPD*1.0*ACC:${account}*AM:${amount}.00*CC:CZK*X-VS:${vs}*MSG:${msg.substring(0, 60)}`;
        qrCodeUrl = await QRCode.toDataURL(spayString);
      }
    }

    // 3. Renderování PDF do streamu
    const stream = await renderToStream(
      React.createElement(BillingDocument, { data, qrCodeUrl })
    );

    // 4. Odeslání odpovědi
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Vyuctovani_${data.result.year}_${data.unit.unitNumber}.pdf"`,
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
