import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unit = await prisma.unit.findFirst({
    where: { buildingId: 'cmij17fjg0000jk6gw5gecns9', unitNumber: 'Byt č. 1513/01' },
    include: {
      ownerships: { include: { owner: true } }
    }
  })
  
  if (!unit) {
    console.log('Unit not found!')
    return
  }
  
  console.log('Unit:', unit.unitNumber)
  console.log('Ownerships count:', unit.ownerships?.length || 0)
  
  if (unit.ownerships && unit.ownerships.length > 0) {
    unit.ownerships.forEach(o => {
      console.log('Owner:', o.owner.firstName, o.owner.lastName)
    })
  } else {
    // Check if ownerships exist separately
    const ownerships = await prisma.ownership.findMany({
      where: { unitId: unit.id },
      include: { owner: true }
    })
    console.log('Direct query ownerships:', ownerships.length)
    ownerships.forEach(o => {
      console.log('Owner:', o.owner.firstName, o.owner.lastName)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
