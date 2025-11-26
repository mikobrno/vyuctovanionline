/**
 * PDF generátor pro vyúčtování
 * Používá @react-pdf/renderer pro generování PDF na serveru
 */

import React from 'react'
import path from 'path'
import { renderToBuffer } from '@react-pdf/renderer'
import { BillingDocument } from '@/components/pdf/BillingDocument'
import { BillingPdfData } from '@/lib/billing-pdf-data'
import { resolveBrandProfile } from '@/lib/branding'

const resolveBillingLogoPath = (managerName?: string | null) => {
  const brand = resolveBrandProfile(managerName)
  return path.join(process.cwd(), 'public', brand.logoFilename)
}

/**
 * Vygenerování PDF jako Buffer
 */
export async function generateBillingPDF(
  data: BillingPdfData,
  options?: { qrCodeUrl?: string }
): Promise<Buffer> {
  const logoPath = resolveBillingLogoPath(data.building?.managerName)
  const pdfDoc = <BillingDocument data={data} logoPath={logoPath} qrCodeUrl={options?.qrCodeUrl} />
  return await renderToBuffer(pdfDoc)
}

/**
 * Vygenerování PDF jako Base64 string (pro email přílohu)
 */
export async function generateBillingPDFBase64(
  data: BillingPdfData,
  options?: { qrCodeUrl?: string }
): Promise<string> {
  const buffer = await generateBillingPDF(data, options)
  return buffer.toString('base64')
}

export { resolveBillingLogoPath }
