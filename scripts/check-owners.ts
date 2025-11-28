import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ownerships = await prisma.ownership.findMany({
    where: { unit: { buildingId: 'cmij17fjg0000jk6gw5gecns9' } },
    include: { owner: true, unit: true },
    take: 10
  })
  
  console.log(`=== Ownerships (${ownerships.length}) ===`)
  ownerships.forEach(o => {
    console.log(`${o.unit.unitNumber} - ${o.owner.firstName} ${o.owner.lastName}`)
  })

  // Also check owners directly
  const owners = await prisma.owner.findMany({ take: 10 })
  console.log(`\n=== Owners (${owners.length}) ===`)
  owners.forEach(o => {
    console.log(`${o.id} - ${o.firstName} ${o.lastName}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
