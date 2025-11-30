import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const r = await p.billingResult.findFirst({
    where: { unit: { unitNumber: { contains: '20801' } } },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('BillingResult:')
  console.log('  totalCost:', r?.totalCost)
  console.log('  totalAdvancePrescribed:', r?.totalAdvancePrescribed)
  console.log('  result:', r?.result)
  console.log('  monthlyPrescriptions:', r?.monthlyPrescriptions)
  console.log('  monthlyPayments:', r?.monthlyPayments)
  
  // Podívat se na serviceCosts
  if (r) {
    const costs = await p.billingServiceCost.findMany({
      where: { billingResultId: r.id },
      include: { service: true }
    })
    console.log('\nServiceCosts:')
    costs.forEach(c => {
      console.log(`  ${c.service.name}: unitCost=${c.unitCost}, unitAdvance=${c.unitAdvance}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
