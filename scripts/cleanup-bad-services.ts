import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najít budovu
  const building = await prisma.building.findFirst({
    where: { name: { contains: '32 a 34' } }
  })
  
  if (!building) {
    console.log('Budova nenalezena')
    return
  }
  
  console.log('Budova:', building.name)
  
  // Identifikovat špatné služby - ty co mají v názvu Kč, #, čísla
  const allServices = await prisma.service.findMany({
    where: { buildingId: building.id }
  })
  
  const badPatterns = [
    /\d+\s*(Kč|kc)/i,            // "9 137 Kč", "11 752 Kč"
    /^#/,                         // "#N/A"
    /^Byt\s*(č\.|c\.)?/i,        // "Byt č. 2080/1"
    /^\d+\/\d+$/,                 // "1/2024"
    /^Celkem/i,                   // "Celkem náklady..."
    /^K úhradě/i,                 // "K úhradě za rok"
  ]
  
  const badServices = allServices.filter(s => 
    badPatterns.some(p => p.test(s.name))
  )
  
  console.log('\nŠpatné služby k smazání:')
  for (const s of badServices) {
    console.log(`  - "${s.name}"`)
  }
  
  if (badServices.length === 0) {
    console.log('  Žádné špatné služby nenalezeny')
    return
  }
  
  // Smazat vazby a pak služby
  const badIds = badServices.map(s => s.id)
  
  // Smazat BillingServiceCost pro tyto služby
  const deletedCosts = await prisma.billingServiceCost.deleteMany({
    where: { serviceId: { in: badIds } }
  })
  console.log(`\nSmazáno ${deletedCosts.count} billing service costs`)
  
  // Smazat služby
  const deleted = await prisma.service.deleteMany({
    where: { id: { in: badIds } }
  })
  console.log(`Smazáno ${deleted.count} špatných služeb`)
  
  // Zobrazit zbývající služby
  const remaining = await prisma.service.findMany({
    where: { buildingId: building.id },
    orderBy: { name: 'asc' }
  })
  
  console.log(`\nZbývající služby (${remaining.length}):`)
  for (const s of remaining) {
    console.log(`  - ${s.name}`)
  }
}

main().finally(() => prisma.$disconnect())
