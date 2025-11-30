import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Počet serviceCosts
  const count = await prisma.billingServiceCost.count()
  console.log('BillingServiceCost count:', count)
  
  // Kontrola výsledku pro jednotku 20801
  const result = await prisma.billingResult.findFirst({
    where: {
      unit: { unitNumber: { contains: '20801' } },
      billingPeriod: { year: 2024 }
    },
    include: {
      serviceCosts: {
        include: { service: true }
      }
    }
  })
  
  if (result) {
    console.log('\nVýsledek pro 20801:')
    console.log('  ID:', result.id)
    console.log('  totalCost:', result.totalCost)
    console.log('  totalAdvancePrescribed:', result.totalAdvancePrescribed)
    console.log('  serviceCosts count:', result.serviceCosts.length)
    
    if (result.serviceCosts.length > 0) {
      console.log('\n  Služby:')
      result.serviceCosts.forEach(sc => {
        console.log(`    ${sc.service.name}: unitCost=${sc.unitCost}`)
      })
    }
  } else {
    console.log('Výsledek pro 20801 nenalezen')
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
