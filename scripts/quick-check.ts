import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najdi data z dnešního importu pro budovu 1513
  const results = await prisma.billingResult.findMany({
    where: {
      billingPeriod: {
        building: { name: { contains: '1513' } },
        year: 2024
      }
    },
    take: 3,
    include: {
      unit: true,
      billingPeriod: {
        include: { building: true }
      }
    }
  })
  
  for (const r of results) {
    console.log(`ID: ${r.id}`)
    console.log(`Building ID: ${r.billingPeriod.buildingId}`)
    console.log(`Jednotka: ${r.unit.unitNumber}`)
    console.log(`URL: /buildings/${r.billingPeriod.buildingId}/billing/${r.id}`)
    console.log('')
  }
}

main().finally(() => prisma.$disconnect())
