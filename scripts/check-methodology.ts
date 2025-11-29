import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najdi službu Komíny a změň ji na UNIT_PARAMETER
  const kominy = await prisma.service.findFirst({
    where: { 
      building: { name: { contains: '939' } },
      name: { contains: 'Komín' }
    }
  })
  
  if (kominy) {
    console.log('Před:', kominy.methodology)
    
    const updated = await prisma.service.update({
      where: { id: kominy.id },
      data: { methodology: 'UNIT_PARAMETER' }
    })
    
    console.log('Po:', updated.methodology)
  }
  
  // Zobraz všechny
  const services = await prisma.service.findMany({
    where: { building: { name: { contains: '939' } } },
    select: { name: true, methodology: true },
    take: 10
  })
  
  console.log('\nVšechny služby:')
  services.forEach(s => {
    console.log(`  ${s.name}: ${s.methodology}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
