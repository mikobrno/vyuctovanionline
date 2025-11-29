import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Kontrola služby Komíny
  const kominService = await prisma.service.findFirst({
    where: {
      name: { contains: 'Komín' },
      building: { name: { contains: '939' } }
    },
    select: {
      id: true,
      name: true,
      methodology: true,
      unitAttributeName: true
    }
  })
  
  console.log('Služba Komíny:', kominService)
  
  // Kontrola parametrů
  const params = await prisma.unitParameter.findMany({
    where: {
      unit: {
        building: {
          name: { contains: '939' }
        }
      },
      name: 'komin'
    },
    include: {
      unit: {
        select: { unitNumber: true }
      }
    }
  })
  
  console.log('\nParametry komin:')
  params.forEach(p => console.log(p.unit.unitNumber, '=', p.value))
  console.log('\nSuma komínů:', params.reduce((s, p) => s + p.value, 0))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
