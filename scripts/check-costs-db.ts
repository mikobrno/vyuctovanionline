
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildings = await prisma.building.findMany({
    include: {
      _count: {
        select: { costs: true }
      },
      costs: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { service: true }
      }
    }
  })

  console.log('Nalezené budovy:', buildings.length)
  
  for (const b of buildings) {
    console.log(`Budova: ${b.name} (ID: ${b.id})`)
    console.log(`  Počet nákladů: ${b._count.costs}`)
    console.log(`  Ukázka posledních 5 nákladů:`)
    for (const c of b.costs) {
      console.log(`    - Služba: ${c.service.name}, Částka: ${c.amount}, Period: ${c.period}, InvoiceDate: ${c.invoiceDate}`)
    }
    console.log('---')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
