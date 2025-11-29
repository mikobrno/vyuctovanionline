import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const serviceId = process.argv[2]
  if (!serviceId) {
    console.error('Usage: npx tsx scripts/print-service-details.ts <serviceId>')
    return
  }
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  console.log(service)
}

main().finally(() => prisma.$disconnect())
