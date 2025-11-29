import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildingId = process.argv[2] || 'cmikmr76z0000jkps06anasbc'
  
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true }
  })
  
  console.log('Budova:', building?.name)
  
  const units = await prisma.unit.findMany({
    where: { buildingId },
    select: { unitNumber: true },
    take: 10
  })
  
  console.log('Jednotky:')
  units.forEach(u => console.log(' -', u.unitNumber))
}

main().finally(() => prisma.$disconnect())
