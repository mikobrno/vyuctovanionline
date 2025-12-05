import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const costs = await prisma.billingServiceCost.findMany({
    where: {
      billingPeriod: { year: 2024 }
    },
    take: 5,
    include: { service: true }
  })
  
  console.log('=== DATA V DB ===')
  costs.forEach(c => {
    console.log(`${c.service.name}:`)
    console.log(`  distributionShare: "${c.distributionShare}"`)
    console.log(`  distributionBase: "${c.distributionBase}"`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
