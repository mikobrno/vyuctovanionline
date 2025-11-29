import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Aktualizace služby Komíny - nastavení unitAttributeName na 'komin'
  const result = await prisma.service.updateMany({
    where: {
      name: { contains: 'Komín' },
      building: { name: { contains: '939' } }
    },
    data: {
      unitAttributeName: 'komin'
    }
  })
  
  console.log('Aktualizováno služeb:', result.count)
  
  // Ověření
  const service = await prisma.service.findFirst({
    where: {
      name: { contains: 'Komín' },
      building: { name: { contains: '939' } }
    },
    select: {
      name: true,
      methodology: true,
      unitAttributeName: true
    }
  })
  
  console.log('Služba po aktualizaci:', service)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
