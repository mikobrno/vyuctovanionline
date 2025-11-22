
import { prisma } from '../lib/prisma'

async function checkService() {
  const buildingName = 'Kníničky 318'
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName } }
  })

  if (!building) {
    console.log('Building not found')
    return
  }

  const service = await prisma.service.findFirst({
    where: {
      buildingId: building.id,
      name: 'Teplo'
    }
  })

  console.log('Service Teplo:', JSON.stringify(service, null, 2))
}

checkService()
