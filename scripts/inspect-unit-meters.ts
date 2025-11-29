import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unitNumber = process.argv[2] || 'Byt č. 2080/1'
  const unit = await prisma.unit.findFirst({
    where: { unitNumber },
    include: { meters: { include: { readings: true } } }
  })
  console.log('Unit:', unitNumber)
  console.log('Meters:')
  unit?.meters?.forEach(m => {
    console.log({
      id: m.id,
      type: m.type,
      variant: m.variant,
      serial: m.serialNumber,
      readingCost: m.readings?.[0]?.precalculatedCost,
      readingConsumption: m.readings?.[0]?.consumption
    })
  })
}

main().finally(() => prisma.$disconnect())
