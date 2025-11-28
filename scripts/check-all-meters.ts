import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najít jednotku
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: { contains: '1513/01' } }
  })
  
  if (!unit) {
    console.log('Jednotka nenalezena')
    return
  }
  
  console.log('Jednotka:', unit.unitNumber, unit.id, 'buildingId:', unit.buildingId)
  
  // Všechna měřidla pro jednotku
  const allMeters = await prisma.meter.findMany({
    where: { unitId: unit.id },
    include: { 
      readings: true,
      service: true
    }
  })
  
  console.log('\nVšechna měřidla pro jednotku:')
  if (allMeters.length === 0) {
    console.log('  ŽÁDNÁ MĚŘIDLA!')
  }
  for (const m of allMeters) {
    console.log(`  - ${m.type}: ${m.serialNumber} (serviceId: ${m.serviceId || 'none'})`)
    for (const r of m.readings) {
      console.log(`    Reading period=${r.period}: precalculatedCost=${r.precalculatedCost}, consumption=${r.consumption}`)
    }
  }
  
  // Kolik měřidel celkem v budově
  const totalMeters = await prisma.meter.count({
    where: { unit: { buildingId: unit.buildingId } }
  })
  console.log('\nCelkem měřidel v budově:', totalMeters)
  
  // Kolik odečtů
  const totalReadings = await prisma.meterReading.count({
    where: { meter: { unit: { buildingId: unit.buildingId } } }
  })
  console.log('Celkem odečtů v budově:', totalReadings)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
