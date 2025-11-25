import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildingName = process.argv[2] || 'Kníničky'
  const unitNumber = process.argv[3] || '318/03'
  const year = parseInt(process.argv[4] || '2024', 10)

  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName, mode: 'insensitive' } },
    include: {
      services: true,
      units: { where: { unitNumber: { contains: unitNumber, mode: 'insensitive' } } }
    }
  })

  if (!building) {
    console.error('Building not found')
    return
  }

  const unit = building.units[0]
  if (!unit) {
    console.error('Unit not found')
    return
  }

  console.log(`Building: ${building.name} (${building.id})`)
  console.log(`Unit: ${unit.unitNumber} (${unit.id})`)

  const advances = await prisma.advanceMonthly.groupBy({
    by: ['serviceId'],
    where: { unitId: unit.id, year },
    _sum: { amount: true }
  })

  for (const adv of advances) {
    const service = building.services.find(s => s.id === adv.serviceId)
    console.log(`- ${service?.name ?? adv.serviceId}: ${adv._sum.amount || 0}`)
  }
}

main().catch(console.error).finally(async () => prisma.$disconnect())
