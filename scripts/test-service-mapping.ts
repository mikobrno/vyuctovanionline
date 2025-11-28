import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Zjistíme kolik předpisů existuje pro rok 2024 a zobrazíme služby
  const advances = await prisma.advanceMonthly.findMany({
    where: { year: 2024 },
    include: { service: true, unit: true },
    take: 30
  })
  
  console.log('Celkem předpisů pro 2024:', advances.length)
  
  // Seskupíme podle služby
  const byService = new Map<string, number>()
  for (const a of advances) {
    const key = a.service.name
    byService.set(key, (byService.get(key) || 0) + 1)
  }
  
  console.log('\nPředpisy podle služby:')
  for (const [name, count] of byService) {
    console.log(`  ${name}: ${count}`)
  }
  
  // Zkontrolujeme jestli existuje vodné a stočné
  const vodneCount = await prisma.advanceMonthly.count({
    where: { 
      year: 2024,
      service: { name: 'Vodné a stočné' }
    }
  })
  console.log('\nPočet předpisů "Vodné a stočné":', vodneCount)
  
  // Zjistíme celkový počet
  const totalCount = await prisma.advanceMonthly.count({ where: { year: 2024 } })
  console.log('Celkový počet předpisů 2024:', totalCount)
  
  await prisma.$disconnect()
}

main()
