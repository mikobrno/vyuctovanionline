import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const building = await prisma.building.findFirst({
    where: { name: { contains: 'Mikšíčkova 20' } }
  })
  
  if (building) {
    console.log('Found:', building.name, building.id)
    await prisma.building.delete({ where: { id: building.id } })
    console.log('Building deleted successfully')
  } else {
    console.log('Building not found')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
