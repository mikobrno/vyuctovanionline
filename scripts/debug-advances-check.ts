
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unitNumber = '318/03' // Změňte podle potřeby
  const year = 2024

  console.log(`Hledám jednotku ${unitNumber}...`)
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: { contains: unitNumber } },
    include: { building: true }
  })

  if (!unit) {
    console.log('Jednotka nenalezena')
    return
  }

  console.log(`Jednotka ID: ${unit.id}, Budova: ${unit.building.name}`)

  // 1. Služby v budově
  const services = await prisma.service.findMany({
    where: { buildingId: unit.buildingId }
  })
  console.log('\n--- SLUŽBY V BUDOVĚ ---')
  services.forEach(s => console.log(`[${s.id}] ${s.name} (Code: ${s.code})`))

  // 2. Zálohy (AdvanceMonthly)
  const advances = await prisma.advanceMonthly.findMany({
    where: { unitId: unit.id, year },
    include: { service: true }
  })
  console.log('\n--- ZÁLOHY (AdvanceMonthly) ---')
  advances.forEach(a => {
    console.log(`Service: ${a.service.name} (${a.serviceId}) - Měsíc ${a.month}: ${a.amount}`)
  })

  // Agregace záloh
  const advanceSums = new Map<string, number>()
  advances.forEach(a => {
    const current = advanceSums.get(a.serviceId) || 0
    advanceSums.set(a.serviceId, current + a.amount)
  })
  console.log('\n--- SUMA ZÁLOH PODLE ID SLUŽBY ---')
  for (const [id, amount] of advanceSums.entries()) {
    const s = services.find(x => x.id === id)
    console.log(`${s?.name} (${id}): ${amount}`)
  }

  // 3. Billing Result a Costs
  const billingResult = await prisma.billingResult.findFirst({
    where: { unitId: unit.id, billingPeriod: { year } },
    include: { serviceCosts: { include: { service: true } } }
  })

  if (billingResult) {
    console.log('\n--- BILLING SERVICE COSTS ---')
    billingResult.serviceCosts.forEach(cost => {
      console.log(`Cost Service: ${cost.service.name} (${cost.serviceId})`)
      console.log(`  - UnitAdvance (DB): ${cost.unitAdvance}`)
      console.log(`  - Advance from Map: ${advanceSums.get(cost.serviceId)}`)
    })
  } else {
    console.log('Billing result nenalezen')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
