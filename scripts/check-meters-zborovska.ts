import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najít budovu Zborovská
  const building = await prisma.building.findFirst({
    where: { name: { contains: 'Zborovsk' } }
  })
  
  if (!building) {
    console.log('Budova nenalezena')
    return
  }
  
  console.log('Budova:', building.name, building.id)
  
  // Spočítat měřidla
  const meterCount = await prisma.meter.count({
    where: { unit: { buildingId: building.id } }
  })
  console.log('\nCelkem měřidel:', meterCount)
  
  // Měřidla podle typu
  const metersByType = await prisma.meter.groupBy({
    by: ['type'],
    where: { unit: { buildingId: building.id } },
    _count: true
  })
  console.log('Měřidla podle typu:', metersByType)
  
  // Spočítat odečty
  const readingCount = await prisma.meterReading.count({
    where: { meter: { unit: { buildingId: building.id } } }
  })
  console.log('\nCelkem odečtů:', readingCount)
  
  // Vzorky HOT_WATER měřidel s odečty
  const hotWaterMeters = await prisma.meter.findMany({
    where: { 
      type: 'HOT_WATER',
      unit: { buildingId: building.id } 
    },
    include: {
      readings: { take: 2 },
      unit: { select: { unitNumber: true } }
    },
    take: 5
  })
  
  console.log('\nHOT_WATER měřidla:')
  if (hotWaterMeters.length === 0) {
    console.log('  ŽÁDNÁ!')
  }
  for (const m of hotWaterMeters) {
    console.log(`  Unit: ${m.unit.unitNumber}, Serial: ${m.serialNumber}, Readings: ${m.readings.length}`)
    for (const r of m.readings) {
      console.log(`    - Date: ${r.readingDate}, Value: ${r.value}, Consumption: ${r.consumption}`)
    }
  }
}

main().finally(() => prisma.$disconnect())
