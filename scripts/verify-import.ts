/**
 * Ověření importovaných dat
 * npx tsx scripts/verify-import.ts
 */

import { prisma } from '../lib/prisma'

async function verifyImport() {
  console.log('🔍 Ověření importovaných dat\n')
  
  // Najít budovu
  const building = await prisma.building.findFirst({
    where: { name: { contains: 'Zborovská 32' } }
  })
  
  if (!building) {
    console.log('❌ Budova Zborovská 32 nenalezena')
    await prisma.$disconnect()
    return
  }
  
  console.log(`🏢 Budova: ${building.name} (${building.id})`)
  
  // Billing periods
  const periods = await prisma.billingPeriod.findMany({
    where: { buildingId: building.id },
    orderBy: { year: 'desc' }
  })
  console.log(`📅 Období: ${periods.map(p => p.year).join(', ')}`)
  
  // Najít období 2024
  const period2024 = periods.find(p => p.year === 2024)
  if (!period2024) {
    console.log('❌ Období 2024 nenalezeno')
    await prisma.$disconnect()
    return
  }
  
  // Billing results
  const results = await prisma.billingResult.findMany({
    where: { billingPeriodId: period2024.id },
    include: {
      unit: true,
      serviceCosts: {
        include: { service: true }
      }
    },
    orderBy: { unit: { unitNumber: 'asc' } }
  })
  
  console.log(`\n📊 BillingResults pro rok 2024: ${results.length}`)
  
  // Ukázat prvních 3
  console.log('\n--- Ukázka výsledků ---')
  for (const result of results.slice(0, 3)) {
    console.log(`\n📍 ${result.unit.unitNumber}`)
    console.log(`   Náklad: ${result.totalCost.toFixed(0)} Kč`)
    console.log(`   Záloha: ${result.totalAdvancePrescribed.toFixed(0)} Kč`)
    console.log(`   Výsledek: ${result.result.toFixed(0)} Kč`)
    console.log(`   Fond oprav: ${result.repairFund.toFixed(0)} Kč`)
    console.log(`   Služeb: ${result.serviceCosts.length}`)
    
    // Ukázat 3 služby
    for (const sc of result.serviceCosts.slice(0, 3)) {
      console.log(`     - ${sc.service.name}: ${sc.unitCost.toFixed(0)} Kč`)
      if (sc.meterReadings) {
        const readings = JSON.parse(sc.meterReadings)
        console.log(`       Měřidla: ${readings.map((r: { serial: string }) => r.serial).join(', ')}`)
      }
    }
    if (result.serviceCosts.length > 3) {
      console.log(`     ... a dalších ${result.serviceCosts.length - 3} služeb`)
    }
  }
  
  // Statistiky
  console.log('\n--- Statistiky ---')
  const totalCost = results.reduce((sum, r) => sum + r.totalCost, 0)
  const totalAdvance = results.reduce((sum, r) => sum + r.totalAdvancePrescribed, 0)
  const totalResult = results.reduce((sum, r) => sum + r.result, 0)
  
  console.log(`Celkové náklady: ${totalCost.toFixed(0)} Kč`)
  console.log(`Celkové zálohy: ${totalAdvance.toFixed(0)} Kč`)
  console.log(`Celkový výsledek: ${totalResult.toFixed(0)} Kč`)
  
  // Service costs
  const allServiceCosts = await prisma.billingServiceCost.count({
    where: { billingPeriodId: period2024.id }
  })
  console.log(`Celkem BillingServiceCost: ${allServiceCosts}`)
  
  // Jednotky
  const units = await prisma.unit.count({
    where: { buildingId: building.id }
  })
  console.log(`Jednotek v budově: ${units}`)
  
  // Služby
  const services = await prisma.service.count({
    where: { buildingId: building.id }
  })
  console.log(`Služeb v budově: ${services}`)
  
  await prisma.$disconnect()
}

verifyImport()
