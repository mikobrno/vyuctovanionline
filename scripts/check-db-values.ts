import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const costs = await prisma.billingServiceCost.findMany({
    where: {
      billingResult: {
        unit: { unitNumber: { contains: '151301' } }
      }
    },
    select: {
      id: true,
      service: { select: { name: true } },
      buildingUnits: true,
      unitPrice: true,
      unitUnits: true,
      distributionBase: true,
      unitCost: true,
      unitAdvance: true,
      buildingTotalCost: true
    },
    take: 3
  })

  for (const c of costs) {
    console.log(`\n${c.service.name}:`)
    console.log(`  buildingUnits: ${c.buildingUnits}`)
    console.log(`  unitPrice: ${c.unitPrice}`)
    console.log(`  unitUnits: ${c.unitUnits}`)
    console.log(`  distributionBase: ${c.distributionBase}`)
    console.log(`  buildingTotalCost: ${c.buildingTotalCost}`)
  }
}

main().finally(() => prisma.$disconnect())
