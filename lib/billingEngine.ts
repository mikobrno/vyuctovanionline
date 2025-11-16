/**
 * BILLING ENGINE - Generování kompletního vyúčtování
 * 
 * Tento modul kombinuje výpočetní engine s daty ze záložky Faktury
 * a vytváří kompletní vyúčtování pro všechny jednotky v domě.
 */

import { prisma } from './prisma'
import { calculateServiceDistribution } from './calculationEngine'

interface BillingServiceResult {
  serviceId: string
  serviceName: string
  serviceCode: string
  totalCost: number
  totalConsumption: number | null
  pricePerUnit: number | null
  distributionBase: string
  distribution: Array<{
    unitId: string
    unitName: string
    amount: number
    consumption: number | null
    advance: number
    balance: number
    formula: string
  }>
}

interface UnitBillingResult {
  unitId: string
  unitName: string
  unitNumber: string
  variableSymbol: string | null
  owner: {
    name: string
    email: string | null
  } | null
  services: Array<{
    serviceId: string
    serviceName: string
    serviceCode: string
    amount: number
    formula: string
  }>
  totalAmount: number
  totalAdvances: number
  balance: number
}

interface CompleteBilling {
  buildingId: string
  buildingName: string
  period: number
  generatedAt: Date
  services: BillingServiceResult[]
  units: UnitBillingResult[]
  summary: {
    totalCosts: number
    totalDistributed: number
    totalAdvances: number
    totalBalance: number
    numberOfUnits: number
    numberOfServices: number
  }
}

/**
 * HLAVNÍ FUNKCE - Generování kompletního vyúčtování
 */
export async function generateCompleteBilling(
  buildingId: string,
  period: number
): Promise<CompleteBilling> {
  
  console.log(`[Billing Engine] Generating billing for building ${buildingId}, period ${period}`)

  // 1. Načíst budovu se všemi daty
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: {
      units: {
        include: {
          ownerships: {
            where: { validTo: null },
            include: { owner: true }
          }
        },
        orderBy: { unitNumber: 'asc' }
      },
      services: {
        where: { isActive: true },
        orderBy: { order: 'asc' }
      },
      costs: {
        where: { period: period },
        include: { service: true }
      }
    }
  })

  if (!building) {
    throw new Error(`Building ${buildingId} not found`)
  }

  console.log(`[Billing Engine] Found ${building.services.length} services, ${building.costs.length} costs`)

  // 2. Načíst zálohy z nového zdroje (AdvanceMonthly); fallback na staré AdvancePaymentRecord
  const advancesMap = new Map<string, Map<string, number>>()

  const monthlyAdvances = await prisma.advanceMonthly.findMany({
    where: {
      year: period,
      unit: { buildingId },
      service: { buildingId }
    },
    select: { unitId: true, serviceId: true, amount: true }
  })

  if (monthlyAdvances.length > 0) {
    for (const row of monthlyAdvances) {
      if (!advancesMap.has(row.unitId)) advancesMap.set(row.unitId, new Map())
      const m = advancesMap.get(row.unitId)!
      m.set(row.serviceId, (m.get(row.serviceId) || 0) + (row.amount || 0))
    }
  } else {
    // Fallback: AdvancePayment + Records (monthlyAmount * 12)
    const advancePayments = await prisma.advancePayment.findMany({
      where: { service: { buildingId }, year: period },
      include: { records: true }
    })
    for (const ap of advancePayments) {
      for (const record of ap.records) {
        if (!advancesMap.has(record.unitId)) advancesMap.set(record.unitId, new Map())
        const unitAdvances = advancesMap.get(record.unitId)!
        const yearlyAdvance = (record.monthlyAmount || 0) * 12
        unitAdvances.set(ap.serviceId, (unitAdvances.get(ap.serviceId) || 0) + yearlyAdvance)
      }
    }
  }

  // 3. Pro každou službu vypočítat rozúčtování pomocí dynamického enginu
  const serviceResults: BillingServiceResult[] = []

  for (const service of building.services) {
    // Sečíst náklady pro tuto službu
    const serviceCosts = building.costs.filter((c: { serviceId: string }) => c.serviceId === service.id)
    const totalCost = serviceCosts.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0)

    console.log(`[Billing Engine] Service ${service.name}: ${totalCost} Kč from ${serviceCosts.length} costs`)

    if (totalCost === 0) {
      console.log(`[Billing Engine] Skipping service ${service.name} - no costs`)
      continue
    }

    try {
      // POUŽITÍ DYNAMICKÉHO ENGINU!
      const distribution = await calculateServiceDistribution(
        service.id,
        buildingId,
        period,
        totalCost
      )

      // Vypočítat celkovou spotřebu a cenu za jednotku
      const totalConsumption = distribution.reduce((sum, d) => sum + (d.breakdown.unitValue || 0), 0)
      const pricePerUnit = totalConsumption > 0 ? totalCost / totalConsumption : null

      // Získat základ pro rozúčtování
      let distributionBase = 'na byt'
      if (service.dataSourceType === 'METER_DATA') {
        distributionBase = service.dataSourceName || 'odečet'
      } else if (service.dataSourceType === 'UNIT_ATTRIBUTE') {
        distributionBase = service.unitAttributeName || 'vlastnický podíl'
      } else if (service.dataSourceType === 'PERSON_MONTHS') {
        distributionBase = 'osobo-měsíc'
      }

      // Přidat zálohy a bilance k distribuci
      const distributionWithAdvances = distribution.map(d => {
        const unitAdvancesMap = advancesMap.get(d.unitId)
        const advance = unitAdvancesMap?.get(service.id) || 0
        return {
          unitId: d.unitId,
          unitName: d.unitName,
          amount: d.amount,
          consumption: d.breakdown.unitValue,
          advance,
          balance: d.amount - advance,
          formula: d.formula
        }
      })

      serviceResults.push({
        serviceId: service.id,
        serviceName: service.name,
        serviceCode: service.code,
        totalCost,
        totalConsumption: totalConsumption > 0 ? totalConsumption : null,
        pricePerUnit,
        distributionBase,
        distribution: distributionWithAdvances
      })

      console.log(`[Billing Engine] Service ${service.name} distributed to ${distribution.length} units, total consumption: ${totalConsumption}`)
    } catch (error) {
      console.error(`[Billing Engine] Error calculating service ${service.name}:`, error)
      // Pokračovat s dalšími službami
    }
  }

  // 4. Sestavit výsledky pro jednotky
  const unitResults: UnitBillingResult[] = []

  // Najít službu "Fond oprav" pro výpočet
  const repairFundService = building.services.find((s: { code: string; name: string }) => 
    s.code.toLowerCase().includes('fond') || 
    s.name.toLowerCase().includes('fond oprav')
  )
  const repairFundPerUnit = repairFundService?.fixedAmountPerUnit || 0

  for (const unit of building.units) {
    const owner = unit.ownerships[0]?.owner || null
    const unitServices: UnitBillingResult['services'] = []
    let totalAmount = 0
    let totalAdvances = 0

    // Pro každou službu získat částku pro tuto jednotku
    for (const serviceResult of serviceResults) {
      const unitDistribution = serviceResult.distribution.find(d => d.unitId === unit.id)
      
      if (unitDistribution) {
        unitServices.push({
          serviceId: serviceResult.serviceId,
          serviceName: serviceResult.serviceName,
          serviceCode: serviceResult.serviceCode,
          amount: unitDistribution.amount,
          formula: unitDistribution.formula
        })
        totalAmount += unitDistribution.amount
      }

      // Získat zálohy pro tuto službu
      const unitAdvancesMap = advancesMap.get(unit.id)
      if (unitAdvancesMap) {
        const serviceAdvance = unitAdvancesMap.get(serviceResult.serviceId) || 0
        totalAdvances += serviceAdvance
      }
    }

    // Přidat fond oprav k celkovému nákladu
    totalAmount += repairFundPerUnit

    unitResults.push({
      unitId: unit.id,
      unitName: unit.name,
      unitNumber: unit.unitNumber,
      variableSymbol: unit.variableSymbol,
      owner: owner ? {
        name: `${owner.firstName} ${owner.lastName}`,
        email: owner.email
      } : null,
      services: unitServices,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalAdvances: Math.round(totalAdvances * 100) / 100,
      balance: Math.round((totalAmount - totalAdvances) * 100) / 100
    })
  }

  // 5. Vypočítat celkové statistiky
  const totalCosts = serviceResults.reduce((sum, s) => sum + s.totalCost, 0)
  const totalDistributed = unitResults.reduce((sum, u) => sum + u.totalAmount, 0)
  const totalAdvancesSum = unitResults.reduce((sum, u) => sum + u.totalAdvances, 0)
  const totalBalance = unitResults.reduce((sum, u) => sum + u.balance, 0)

  console.log(`[Billing Engine] Complete! Total: ${totalCosts} Kč, Distributed: ${totalDistributed} Kč`)

  return {
    buildingId: building.id,
    buildingName: building.name,
    period,
    generatedAt: new Date(),
    services: serviceResults,
    units: unitResults,
    summary: {
      totalCosts: Math.round(totalCosts * 100) / 100,
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      totalAdvances: Math.round(totalAdvancesSum * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
      numberOfUnits: unitResults.length,
      numberOfServices: serviceResults.length
    }
  }
}

/**
 * Uložení vyúčtování do databáze
 */
export async function saveBillingToDatabase(billing: CompleteBilling) {
  console.log(`[Billing Engine] Saving billing to database...`)

  // Vytvořit nebo aktualizovat BillingPeriod
  const billingPeriod = await prisma.billingPeriod.upsert({
    where: {
      buildingId_year: {
        buildingId: billing.buildingId,
        year: billing.period
      }
    },
    update: {
      status: 'CALCULATED',
      calculatedAt: billing.generatedAt
    },
    create: {
      buildingId: billing.buildingId,
      year: billing.period,
      status: 'CALCULATED',
      calculatedAt: billing.generatedAt
    }
  })

  console.log(`[Billing Engine] Created/updated billing period: ${billingPeriod.id}`)

  // Smazat staré výsledky pro toto období
  await prisma.billingResult.deleteMany({
    where: { billingPeriodId: billingPeriod.id }
  })

  console.log(`[Billing Engine] Deleted old billing results`)

  // Vytvořit nové výsledky pro jednotky
  let createdCount = 0
  for (const unitResult of billing.units) {
    // Najít službu fondu oprav pro tuto jednotku
    const repairFundService = await prisma.service.findFirst({
      where: {
        buildingId: billing.buildingId,
        OR: [
          { code: { contains: 'fond', mode: 'insensitive' } },
          { name: { contains: 'fond oprav', mode: 'insensitive' } }
        ]
      }
    })
    const repairFundAmount = repairFundService?.fixedAmountPerUnit || 0

    // Vytvořit hlavní záznam vyúčtování
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unitResult.unitId,
        totalCost: unitResult.totalAmount,
        totalAdvancePrescribed: unitResult.totalAdvances,
        totalAdvancePaid: unitResult.totalAdvances, // TODO: propojit s Payment
        repairFund: repairFundAmount,
        result: unitResult.balance,
        isPaid: false
      }
    })

    // Vytvořit záznamy pro každou službu
    for (const service of unitResult.services) {
      // Najít odpovídající serviceResult pro detaily
      const serviceResult = billing.services.find(s => s.serviceId === service.serviceId)
      const distribution = serviceResult?.distribution.find(d => d.unitId === unitResult.unitId)

      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: billingPeriod.id,
          billingResultId: billingResult.id,
          serviceId: service.serviceId,
          unitId: unitResult.unitId,
          buildingTotalCost: serviceResult?.totalCost || 0,
          buildingConsumption: serviceResult?.totalConsumption,
          unitConsumption: distribution?.consumption,
          unitCost: service.amount,
          unitAdvance: distribution?.advance || 0,
          unitBalance: distribution?.balance || 0,
          unitPricePerUnit: serviceResult?.pricePerUnit,
          unitAssignedUnits: distribution?.consumption,
          distributionBase: serviceResult?.distributionBase,
          calculationBasis: service.formula
        }
      })
    }

    createdCount++
  }

  console.log(`[Billing Engine] Created ${createdCount} billing results with service costs`)

  return billingPeriod
}

/**
 * Kompletní proces: Vygenerovat a uložit vyúčtování
 */
export async function generateAndSaveBilling(buildingId: string, period: number) {
  const billing = await generateCompleteBilling(buildingId, period)
  const billingPeriod = await saveBillingToDatabase(billing)
  
  return {
    billing,
    billingPeriod
  }
}
