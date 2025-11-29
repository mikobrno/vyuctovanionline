import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const meters = await prisma.meter.findMany({
    take: 20,
    select: {
      type: true,
      variant: true,
      serialNumber: true
    }
  })
  console.log('Měřidla v databázi:')
  console.log(JSON.stringify(meters, null, 2))
  
  // Kolik má variant
  const withVariant = meters.filter(m => m.variant)
  console.log(`\nMěřidla s variant: ${withVariant.length} z ${meters.length}`)
}

main().finally(() => prisma.$disconnect())
