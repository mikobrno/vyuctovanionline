
import { BillingCalculator } from '../lib/billing-calculator'
import { prisma } from '../lib/prisma'

async function testCalculation() {
  const buildingName = 'Kníničky 318'
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName } }
  })

  if (!building) {
    console.log('Building not found')
    return
  }

  const calculator = new BillingCalculator(building.id, 2024)
  
  // We need to find the service ID for Heating
  const heatingService = await prisma.service.findFirst({
    where: {
      buildingId: building.id,
      name: 'Teplo'
    }
  })

  if (!heatingService) {
    console.log('Heating service not found')
    // List all services to see what we have
    const services = await prisma.service.findMany({ where: { buildingId: building.id } })
    console.log('Available services:', services.map(s => `${s.name} (${s.code})`))
    return
  }

  console.log(`Running full calculation for building...`)

  const billingPeriod = await calculator.calculate()

  console.log(`Calculation finished. Period ID: ${billingPeriod.id}`)

  // Check result for unit 318/01 and service Teplo
  const unit = await prisma.unit.findFirst({
    where: {
      buildingId: building.id,
      unitNumber: 'Jednotka č. 318/01'
    }
  })

  if (!unit) {
    console.log('Unit 318/01 not found')
    return
  }

  const result = await prisma.billingServiceCost.findFirst({
    where: {
      billingPeriodId: billingPeriod.id,
      unitId: unit.id,
      service: {
        name: 'Teplo'
      }
    }
  })

  if (!result) {
    console.log('No billing result found for Teplo on unit 318/01')
    return
  }

  console.log('Calculation Result from DB:', JSON.stringify(result, null, 2))

  if (result.calculationBasis && result.calculationBasis.includes('Excel')) {
    console.log('SUCCESS: Used precalculated cost from Excel!')
  } else {
    console.log(`FAILURE: Calculation basis is: ${result.calculationBasis}`)
  }

}

testCalculation()
