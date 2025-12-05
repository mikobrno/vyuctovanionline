import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const units = await prisma.unit.findMany({
    where: { building: { name: { contains: '1513' } } },
    select: { id: true, unitNumber: true }
  })
  console.log(JSON.stringify(units, null, 2))
}

main().finally(() => prisma.$disconnect())
