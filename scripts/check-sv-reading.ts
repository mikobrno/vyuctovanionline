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
  
  console.log('Jednotka:', unit.unitNumber, unit.id)
  
  // Najít měřidla pro studenou vodu
  const meters = await prisma.meter.findMany({
    where: { unitId: unit.id, type: 'COLD_WATER' },
    include: { 
      readings: true,
      service: true
    }
  })
  
  console.log('\nMěřidla COLD_WATER:')
  for (const m of meters) {
    console.log(`  - ${m.serialNumber} (service: ${m.service?.name || m.serviceId || 'none'})`)
    for (const r of m.readings) {
      console.log(`    Reading: precalculatedCost=${r.precalculatedCost}, consumption=${r.consumption}, value=${r.value}`)
    }
  }
  
  // Najít službu Studená voda
  const service = await prisma.service.findFirst({
    where: { 
      buildingId: unit.buildingId,
      name: { contains: 'Studen' }
    }
  })
  
  console.log('\nSlužba Studená voda:', service?.id, service?.name, 'dataSourceColumn:', service?.dataSourceColumn)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
