import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    where: { buildingId: 'cmij17fjg0000jk6gw5gecns9' },
    select: { name: true, methodology: true }
  })
  
  console.log('=== Services ===')
  services.forEach(s => {
    console.log(`${s.name} - ${s.methodology}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
