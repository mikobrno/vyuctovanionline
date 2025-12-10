
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const periods = await prisma.billingPeriod.findMany()
  console.log('Periods:', periods)

  const period = await prisma.billingPeriod.findFirst({
    where: { 
      year: 2024,
      status: 'CALCULATED'
    },
    include: {
      results: {
        include: {
          unit: true,
          serviceCosts: {
            include: {
              service: true
            }
          }
        },
        take: 1
      }
    }
  })

  if (!period || period.results.length === 0) {
    console.log('No billing results found for 2024')
    return
  }

  const result = period.results[0]
  console.log(`Unit: ${result.unit.unitNumber}`)
  console.log('Services:')
  result.serviceCosts.forEach(sc => {
    console.log(`\nService: ${sc.service.name}`)
    console.log(`  Cost: ${sc.unitCost}, Advance: ${sc.unitAdvance}, Balance: ${sc.unitBalance}`)
    console.log(`  Building Total: ${sc.buildingTotalCost}, Building Cons: ${sc.buildingConsumption}`)
    console.log(`  Unit Cons: ${sc.unitConsumption}, Price/Unit: ${sc.unitPricePerUnit}`)
    console.log(`  Share (DistBase): ${sc.distributionBase}`)
    console.log(`  Unit Text (CalcBasis): ${sc.calculationBasis}`)
  })
}

main()
