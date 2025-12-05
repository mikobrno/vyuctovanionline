import { NextResponse } from 'next/server';
import { parseExportFullSheet } from '@/lib/exportFullParser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Chybí soubor (pole "file").' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Soubor je prázdný.' }, { status: 400 });
    }

    const sizeLimit = 15 * 1024 * 1024; // 15 MB
    if (file.size > sizeLimit) {
      return NextResponse.json({ error: 'Soubor je příliš velký (limit 15 MB).' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseExportFullSheet(buffer);
    return NextResponse.json(result);
  } catch (error) {
    console.error('EXPORT_FULL preview error:', error);
    return NextResponse.json({ error: 'Nastala chyba při zpracování souboru.' }, { status: 500 });
  }
}
