
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const buildingName = 'Neptun' // Search string
  const year = 2024

  console.log(`Searching for building containing "${buildingName}"...`)
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName, mode: 'insensitive' } }
  })

  if (!building) {
    console.log('Building not found.')
    return
  }

  console.log(`Found building: ${building.name} (${building.id})`)

  console.log('Checking services...')
  const services = await prisma.service.findMany({
    where: { buildingId: building.id }
  })

  console.log(`Found ${services.length} services.`)
  services.forEach(s => {
    console.log(`- ${s.name} (Code: ${s.code}): AdvanceCol: "${s.advancePaymentColumn || 'NULL'}"`)
  })

  console.log(`Checking AdvanceMonthly records for year ${year}...`)
  const advances = await prisma.advanceMonthly.findMany({
    where: {
      unit: { buildingId: building.id },
      year: year
    },
    include: {
      service: true,
      unit: true
    }
  })

  console.log(`Found ${advances.length} advance records.`)
  
  if (advances.length > 0) {
    console.log('Sample records:')
    advances.slice(0, 5).forEach(a => {
      console.log(`- Unit: ${a.unit.unitNumber}, Service: ${a.service.name}, Month: ${a.month}, Amount: ${a.amount}`)
    })
    
    // Group by service
    const byService: Record<string, number> = {}
    advances.forEach(a => {
      byService[a.service.name] = (byService[a.service.name] || 0) + a.amount
    })
    console.log('Total advances by service:')
    Object.entries(byService).forEach(([name, total]) => {
      console.log(`- ${name}: ${total}`)
    })
  } else {
    console.log('No advances found! This confirms the import failed or data is missing.')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
