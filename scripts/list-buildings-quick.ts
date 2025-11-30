import { prisma } from '../lib/prisma'

async function check() {
  const buildings = await prisma.building.findMany({
    select: { id: true, name: true, address: true }
  })
  console.log('=== BUDOVY V DB ===')
  buildings.forEach(b => console.log(b.id, '-', b.name, '|', b.address))
}

check().finally(() => prisma.$disconnect())
