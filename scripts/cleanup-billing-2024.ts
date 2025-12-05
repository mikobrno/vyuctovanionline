import { prisma } from '@/lib/prisma'

async function cleanup() {
  try {
    // Najít budovu
    const building = await prisma.building.findFirst({
      where: { name: { contains: '1513' } }
    })
    
    if (!building) {
      console.log('Budova nenalezena')
      return
    }
    
    console.log(`Nalezena budova: ${building.name}`)
    
    // Najít období 2024
    const period = await prisma.billingPeriod.findFirst({
      where: {
        buildingId: building.id,
        year: 2024
      }
    })
    
    if (!period) {
      console.log('Období 2024 nenalezeno')
      return
    }
    
    console.log(`Nalezeno období: ${period.year}`)
    
    // Smazat všechny billingServiceCost záznamy
    const deletedCosts = await prisma.billingServiceCost.deleteMany({
      where: { billingPeriodId: period.id }
    })
    console.log(`Smazáno ${deletedCosts.count} BillingServiceCost záznamů`)
    
    // Smazat všechny BillingResult záznamy  
    const deletedResults = await prisma.billingResult.deleteMany({
      where: { billingPeriodId: period.id }
    })
    console.log(`Smazáno ${deletedResults.count} BillingResult záznamů`)
    
    console.log('Cleanup hotov - nyní importujte nový soubor')
  } catch (e) {
    console.error('Chyba:', e)
  } finally {
    await prisma.$disconnect()
  }
}

cleanup()
