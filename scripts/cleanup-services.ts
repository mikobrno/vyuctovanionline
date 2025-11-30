import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Smazat falešné služby
  const deleted = await prisma.service.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Kč' } },
        { name: { startsWith: '#' } },
        { name: { contains: '/2024' } },
        { name: 'K úhradě za rok' }
      ]
    }
  })
  console.log('Smazáno falešných služeb:', deleted.count)
  
  // Zobrazit zbývající služby
  const services = await prisma.service.findMany({
    select: { name: true },
    distinct: ['name']
  })
  console.log('\nZbývající služby:')
  services.forEach(s => console.log(`  - ${s.name}`))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
