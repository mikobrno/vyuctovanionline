import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildingId = process.argv[2] || '6bc262a1-14ed-4f79-a8fb-d4623dbf3694'
  const services = await prisma.service.findMany({
    where: { buildingId },
    select: { id: true, name: true, advancePaymentColumn: true }
  })
  for (const s of services) {
    console.log(`${s.name}: ${s.advancePaymentColumn ?? 'N/A'}`)
  }
}

main().catch(console.error).finally(async () => prisma.$disconnect())
