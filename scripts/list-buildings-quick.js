const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const buildings = await prisma.building.findMany({
    select: { id: true, name: true, address: true }
  })
  console.log('=== Budovy v databázi ===')
  for (const b of buildings) {
    console.log(`- ${b.name}`)
    console.log(`  ID: ${b.id}`)
    console.log(`  Adresa: ${b.address || 'N/A'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
