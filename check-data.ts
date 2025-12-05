import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const costs = await prisma.billingServiceCost.findMany({
    where: {
      billingPeriod: { year: 2024 }
    },
    take: 1,
    include: { service: true }
  })
  
  if (costs.length > 0) {
    const c = costs[0]
    console.log('Service:', c.service.name)
    console.log('distributionShare:', c.distributionShare)
    console.log('distributionBase:', c.distributionBase)
    console.log('unitConsumption:', c.unitConsumption)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
