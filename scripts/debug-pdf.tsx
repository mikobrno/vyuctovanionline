import fs from 'fs'
import path from 'path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BillingDocument } from '@/components/pdf/BillingDocument'
import { getBillingPdfData } from '@/lib/billing-pdf-data'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const period = await prisma.billingPeriod.findFirst({
    where: { year: 2024, status: 'CALCULATED' },
    include: { results: { take: 1 } }
  })

  if (!period || period.results.length === 0) {
    console.log('No calculated billing results found for 2024')
    return
  }

  const resultId = period.results[0].id
  console.log(`Generating PDF for result ${resultId}...`)

  const data = await getBillingPdfData(resultId)
  
  // Mock logo path for debug
  const logoPath = path.join(process.cwd(), 'public', 'adminreal.png') // Ensure this exists or use placeholder

  const buffer = await renderToBuffer(
    <BillingDocument data={data} logoPath={logoPath} />
  )

  const outFile = path.join(process.cwd(), 'debug-output.pdf')
  fs.writeFileSync(outFile, buffer)
  console.log(`PDF saved to ${outFile}`)
}

main()