
import { prisma } from '../lib/prisma'

async function checkReadings() {
  const buildingName = 'Kníničky 318'
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName } }
  })

  if (!building) {
    console.log('Building not found')
    return
  }

  const readings = await prisma.meterReading.findMany({
    where: {
      meter: {
        unit: {
          buildingId: building.id
        },
        type: 'HEATING'
      }
    },
    include: {
      meter: {
        include: {
          unit: true
        }
      }
    }
  })

  console.log(`Found ${readings.length} heating readings.`)
  
  const withCost = readings.filter(r => r.precalculatedCost !== null)
  console.log(`Readings with precalculatedCost: ${withCost.length}`)

  if (withCost.length > 0) {
    console.log('Sample reading with cost:')
    const sample = withCost[0]
    console.log(`Unit: ${sample.meter.unit.unitNumber}, Cost: ${sample.precalculatedCost}, Consumption: ${sample.consumption}`)
  } else {
    console.log('No readings have precalculatedCost set!')
  }
}

checkReadings()
