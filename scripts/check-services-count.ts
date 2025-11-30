import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({ 
    where: { buildingId: 'cmikmr76z0000jkps06anasbc' } 
  })
  
  console.log(`Služby v DB: ${services.length}`)
  services.forEach(s => console.log(`  - ${s.name}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
