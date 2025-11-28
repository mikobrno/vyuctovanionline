// Script to check JSON import results
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking JSON Import Results ===\n')

  // Find the JSON-imported building (Společenství vlastníků Mikšíčkova)
  const building = await prisma.building.findFirst({
    where: { name: { contains: 'Společenství vlastníků Mikšíčkova' } }
  })
  
  if (!building) {
    console.log('Building not found!')
    return
  }
  
  console.log(`Building: ${building.name}`)
  console.log(`  ID: ${building.id}`)
  console.log(`  Address: ${building.address}`)
  console.log(`  Bank Account: ${building.bankAccount}`)
  console.log('')

  // Count units
  const units = await prisma.unit.findMany({
    where: { buildingId: building.id },
    orderBy: { unitNumber: 'asc' }
  })
  console.log(`Units: ${units.length}`)
  for (const unit of units.slice(0, 5)) {
    console.log(`  - ${unit.unitNumber} (${unit.totalArea}m², podíl: ${unit.shareNumerator}/${unit.shareDenominator})`)
  }
  if (units.length > 5) console.log(`  ... and ${units.length - 5} more`)
  console.log('')

  // Count services
  const services = await prisma.service.findMany({
    where: { buildingId: building.id }
  })
  console.log(`Services: ${services.length}`)
  for (const s of services) {
    console.log(`  - ${s.name} (${s.methodology})`)
  }
  console.log('')

  // Billing period
  const period = await prisma.billingPeriod.findFirst({
    where: { buildingId: building.id, year: 2024 }
  })
  console.log(`Billing Period 2024: ${period ? period.id : 'NOT FOUND'}`)
  console.log('')

  // Costs
  const costs = await prisma.cost.count({
    where: { buildingId: building.id, period: 2024 }
  })
  console.log(`Costs (2024): ${costs}`)

  // Payments
  const payments = await prisma.payment.count({
    where: { unit: { buildingId: building.id } }
  })
  console.log(`Payments: ${payments}`)

  // Meter readings
  const readings = await prisma.meterReading.count({
    where: { meter: { unit: { buildingId: building.id } } }
  })
  console.log(`Meter Readings: ${readings}`)

  // Person months
  const personMonths = await prisma.personMonth.count({
    where: { unit: { buildingId: building.id } }
  })
  console.log(`Person Months: ${personMonths}`)

  // Advances
  const advances = await prisma.advanceMonthly.count({
    where: { unit: { buildingId: building.id } }
  })
  console.log(`Advance Monthly: ${advances}`)

  // Sample unit with details
  console.log('\n=== Sample Unit Details ===')
  const sampleUnit = await prisma.unit.findFirst({
    where: { buildingId: building.id, unitNumber: 'Byt č. 1513/01' },
    include: {
      ownerships: { include: { owner: true } },
      meters: { include: { readings: { take: 2, orderBy: { readingDate: 'desc' } } } },
      payments: { take: 3, orderBy: { paymentDate: 'desc' } },
      personMonths: { take: 3, orderBy: { month: 'desc' } },
      advanceMonthlies: { take: 3, include: { service: true } },
      parameters: true
    }
  })
  
  if (sampleUnit) {
    console.log(`Unit: ${sampleUnit.unitNumber}`)
    console.log(`  Area: ${sampleUnit.totalArea}m²`)
    console.log(`  Share: ${sampleUnit.shareNumerator}/${sampleUnit.shareDenominator}`)
    console.log(`  Variable Symbol: ${sampleUnit.variableSymbol}`)
    console.log(`  Owners: ${sampleUnit.ownerships.map(o => `${o.owner.firstName} ${o.owner.lastName}`).join(', ')}`)
    console.log(`  Meters: ${sampleUnit.meters.length}`)
    for (const m of sampleUnit.meters) {
      console.log(`    - ${m.type}: ${m.serialNumber} (initial: ${m.initialReading})`)
      for (const r of m.readings) {
        console.log(`      Reading: ${r.value} (${r.readingDate.toLocaleDateString()})`)
      }
    }
    console.log(`  Payments: ${sampleUnit.payments.length} samples`)
    for (const p of sampleUnit.payments) {
      console.log(`    - ${p.amount} Kč (${p.paymentDate.toLocaleDateString()}) VS: ${p.variableSymbol}`)
    }
    console.log(`  Person Months: ${sampleUnit.personMonths.length} samples`)
    for (const pm of sampleUnit.personMonths) {
      console.log(`    - ${pm.month}/${pm.year}: ${pm.personCount} osob`)
    }
    console.log(`  Advances: ${sampleUnit.advanceMonthlies.length} samples`)
    for (const a of sampleUnit.advanceMonthlies) {
      console.log(`    - ${a.service?.name}: ${a.amount} Kč (${a.month}/${a.year})`)
    }
    if (sampleUnit.parameters.length > 0) {
      console.log(`  Parameters: ${sampleUnit.parameters.length}`)
      for (const p of sampleUnit.parameters) {
        console.log(`    - ${p.name}: ${p.value}`)
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
