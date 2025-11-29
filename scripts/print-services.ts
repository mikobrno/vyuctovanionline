import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildingId = process.argv[2]
  if (!buildingId) {
    console.error('Usage: npx tsx scripts/print-services.ts <buildingId>')
    process.exit(1)
  }
  const services = await prisma.service.findMany({
    where: { buildingId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, code: true, methodology: true, order: true }
  })
  console.log(JSON.stringify(services, null, 2))
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
