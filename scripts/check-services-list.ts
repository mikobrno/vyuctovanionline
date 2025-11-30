import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najít budovu Zborovská 32 a 34
  const building = await prisma.building.findFirst({
    where: { name: { contains: '32 a 34' } }
  })
  
  if (!building) {
    console.log('Budova nenalezena')
    return
  }
  
  console.log('Budova:', building.name, building.id)
  
  // Načíst služby
  const services = await prisma.service.findMany({
    where: { buildingId: building.id },
    select: { id: true, name: true, code: true },
    orderBy: { order: 'asc' },
    take: 50
  })
  
  console.log('\nSlužby (' + services.length + '):')
  for (const s of services) {
    console.log(`  - ${s.name} (${s.code})`)
  }
}

main().finally(() => prisma.$disconnect())
