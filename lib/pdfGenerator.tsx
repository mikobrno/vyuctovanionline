/**
 * PDF generátor pro vyúčtování
 * Používá @react-pdf/renderer pro generování PDF na serveru
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BillingDocument } from '@/components/pdf/BillingDocument'
import { BillingPdfData } from '@/lib/billing-pdf-data'

/**
 * Vygenerování PDF jako Buffer
 */
export async function generateBillingPDF(data: BillingPdfData): Promise<Buffer> {
  const pdfDoc = <BillingDocument data={data} />
  return await renderToBuffer(pdfDoc)
}

/**
 * Vygenerování PDF jako Base64 string (pro email přílohu)
 */
export async function generateBillingPDFBase64(data: BillingPdfData): Promise<string> {
  const buffer = await generateBillingPDF(data)
  return buffer.toString('base64')
}
