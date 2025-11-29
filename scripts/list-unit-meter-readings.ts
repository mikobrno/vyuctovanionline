import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unitNumber = process.argv[2] || 'Byt č. 2080/1'
  const year = parseInt(process.argv[3] || '2024', 10)
  const unit = await prisma.unit.findFirst({
    where: { unitNumber },
  })
  if (!unit) {
    console.error('Unit not found')
    return
  }
  const meters = await prisma.meter.findMany({
    where: { unitId: unit.id },
    include: {
      readings: {
        where: { period: year }
      }
    }
  })
  for (const m of meters) {
    console.log({ type: m.type, variant: m.variant, serial: m.serialNumber, readings: m.readings })
  }
}

main().finally(() => prisma.$disconnect())
