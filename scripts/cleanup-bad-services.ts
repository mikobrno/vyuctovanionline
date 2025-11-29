import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const b = await prisma.building.findFirst({ where: { name: { contains: 'Zborovská' }}})
  if (!b) { console.log('Budova nenalezena'); return }
  
  const s = await prisma.service.findMany({
    where: { buildingId: b.id },
    select: { name: true, order: true, isActive: true },
    orderBy: { order: 'asc' }
  })
  
  console.log('Celkem služeb:', s.length)
  console.log('Aktivních:', s.filter(x => x.isActive).length)
  console.log('Neaktivních:', s.filter(x => !x.isActive).length)
  s.forEach(x => console.log(x.order, x.isActive ? '✓' : '✗', x.name))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
