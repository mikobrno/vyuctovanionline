const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const buildings = await p.building.findMany({ 
    include: { 
      _count: { 
        select: { services: true, units: true }
      }
    }
  })
  
  for (const b of buildings) {
    console.log(`${b.id} | ${b.name} | services: ${b._count.services} | units: ${b._count.units}`)
  }
  
  await p.$disconnect()
}

main()
