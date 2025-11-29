import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    where: {
      building: {
        name: { contains: '939' }
      }
    },
    select: {
      name: true,
      methodology: true
    },
    orderBy: { order: 'asc' }
  })
  
  console.log('Služby a jejich metodologie:')
  console.log(JSON.stringify(services, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
