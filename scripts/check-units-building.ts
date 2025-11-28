import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najít budovu z URL (Zborovská 2)
  const zborovska2 = await prisma.building.findUnique({
    where: { id: '7f913bdc-d937-419c-b783-d7165ecb6492' },
    include: { units: true }
  })
  
  if (zborovska2) {
    console.log('Budova:', zborovska2.name)
    console.log('Počet jednotek:', zborovska2.units.length)
    console.log('Jednotky:')
    zborovska2.units.forEach(u => {
      console.log(`  ${u.unitNumber}`)
    })
  }
  
  await prisma.$disconnect()
}

main()
