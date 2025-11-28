import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildings = await prisma.building.findMany({
    select: { id: true, name: true, bankAccount: true }
  })
  
  console.log('=== Buildings ===')
  buildings.forEach(b => {
    console.log(`${b.id} | ${b.name} | ${b.bankAccount}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
