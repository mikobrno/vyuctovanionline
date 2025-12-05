import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const period = await prisma.billingPeriod.findFirst({
    where: { year: 2024 },
    include: {
      results: {
        take: 1,
        include: {
          serviceCosts: {
            take: 3,
            include: { service: true }
          }
        }
      }
    }
  })
  
  if (period?.results[0]) {
    const br = period.results[0]
    console.log('=== BILLING RESULT ===')
    br.serviceCosts.forEach(sc => {
      console.log(`${sc.service.name}:`)
      console.log(`  distributionShare: "${sc.distributionShare}"`)
      console.log(`  distributionBase: "${sc.distributionBase}"`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
