import { prisma } from '../lib/prisma'

async function main() {
  // Najdi výsledek pro jednotku 151301
  const result = await prisma.billingResult.findFirst({
    where: { 
      unit: { 
        unitNumber: { contains: '151301' } 
      } 
    },
    include: {
      billingPeriod: true,
      unit: true
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!result) {
    console.log('Výsledek nenalezen')
    return
  }

  console.log('=== BillingResult ===')
  console.log('ID:', result.id)
  console.log('Unit:', result.unit.unitNumber)
  console.log('Building ID:', result.billingPeriod.buildingId)
  console.log('Year:', result.billingPeriod.year)
  console.log('')
  console.log('monthlyPayments:', JSON.stringify(result.monthlyPayments))
  console.log('monthlyPrescriptions:', JSON.stringify(result.monthlyPrescriptions))
  console.log('')
  
  // URL pro zobrazení
  console.log('URL pro zobrazení:')
  console.log(`http://localhost:3000/buildings/${result.billingPeriod.buildingId}/billing/${result.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
