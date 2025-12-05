import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const deleted1 = await prisma.billingResult.deleteMany({
    where: {
      billingPeriod: {
        year: 2024
      }
    }
  })
  
  const deleted2 = await prisma.billingServiceCost.deleteMany({
    where: {
      billingPeriod: {
        year: 2024
      }
    }
  })
  
  console.log(`Vymazáno ${deleted1.count} BillingResult a ${deleted2.count} BillingServiceCost`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
