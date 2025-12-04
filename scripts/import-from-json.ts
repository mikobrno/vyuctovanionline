/**
 * import-from-json.ts
 * 
 * Importuje data z JSON souboru přímo do databáze.
 * JSON obsahuje kompletní data: evidence, meridla, predpisy, uhrady, preplatky_nedoplatky.
 * 
 * Použití:
 *   npx tsx scripts/import-from-json.ts "JSON/2024.json" "Mikšíčkova"
 */

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Type definitions for JSON structure
interface JsonData {
  house_info: {
    nazev: string
    sidlo: string
  }
  faktury: Array<{
    name: string
    faktura: {
      jednotka: string
      podil: string
      cena: number
      jednotek_dum: string
      kc_jedn_dum: string
      jednotek_uzivatel: string
      naklad_uzivatel: string
      zaloha_uzivatel: string
      preplatky_nedoplatky: string
    } | null
  }>
  uhrady: Array<{
    oznaceni: string
    platby: number[]
  }>
  preplatky_nedoplatky: Array<{
    oznaceni: string
    preplatek: number
    nedoplatek: number
    uhrazeno_datum: string
    prevedeno: number
    required_total: number
    payed_total: number
  }>
  evidence: Array<{
    oznaceni: string
    uzivatel: string
    bydliste: string
    email: string
    telefon: string
    osloveni: string
    kominy: number
    vymera: number
    vymera_zapocitatelna: number
    podil_dum: string
    vs: number
    vs_modified: string
    od: string
    do: string
    od_do: string
    bankovni_spojeni: string
  }>
  predpisy: Array<{
    oznaceni: string
    uzivatel: string
    elektrika: Record<string, number>
    uklid: Record<string, number>
    komin: Record<string, number>
    vytah: Record<string, number>
    voda: Record<string, number>
    sprava: Record<string, number>
    opravy: Record<string, number>
    teplo: Record<string, number>
    tuv: Record<string, number>
    pojisteni: Record<string, number>
    [key: string]: any
  }>
  meridla: Array<{
    oznaceni: string
    tuv: Array<{
      typ: string
      datum_odectu: string
      meridlo: string
      pocatecni_hodnota: number
      koncova_hodnota: number
      rocni_naklad: number
    }>
    sv: Array<{
      typ: string
      datum_odectu: string
      meridlo: string
      pocatecni_hodnota: number
      koncova_hodnota: number
      rocni_naklad: number
    }>
    teplo: Array<{
      typ: string
      datum_odectu: string
      meridlo: string
      pocatecni_hodnota: number
      koncova_hodnota: number
      rocni_naklad: number
    }>
  }>
  vstupni_data: {
    spravce: string
    cislo_uctu_dum: string
    rok: string
    pocet_jednotek: number
    adresa: string
  }
}

// Service name mapping from predpisy keys to display names
const serviceNameMapping: Record<string, string> = {
  elektrika: 'Elektrická energie (společné prostory)',
  uklid: 'Úklid bytového domu',
  komin: 'Komíny',
  vytah: 'Pravidelná údržba výtah',
  voda: 'Studená voda',
  sprava: 'Správa domu',
  opravy: 'Fond oprav',
  teplo: 'Teplo',
  tuv: 'Ohřev teplé vody (TUV)',
  pojisteni: 'Pojištění domu',
}

async function main() {
  const jsonPath = process.argv[2] || 'JSON/2024.json'
  const buildingHint = process.argv[3] || 'Mikšíčkova'
  const year = parseInt(process.argv[4] || '2024')

  console.log(`🚀 Import from JSON: ${jsonPath}`)
  console.log(`🏠 Building hint: ${buildingHint}`)
  console.log(`📅 Year: ${year}`)

  // Load JSON
  const fullPath = path.join(process.cwd(), jsonPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`)
    process.exit(1)
  }

  const jsonContent = fs.readFileSync(fullPath, 'utf-8')
  const data: JsonData = JSON.parse(jsonContent)

  console.log(`📋 House: ${data.house_info.nazev}`)
  console.log(`📍 Address: ${data.vstupni_data.adresa}`)
  console.log(`👥 Units in JSON: ${data.evidence.length}`)

  // Find building
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingHint } }
  })

  if (!building) {
    console.error(`❌ Building not found matching: ${buildingHint}`)
    const buildings = await prisma.building.findMany({ select: { id: true, name: true } })
    console.log('Available buildings:', buildings.map(b => b.name).join(', '))
    process.exit(1)
  }

  console.log(`✅ Found building: ${building.name} (${building.id})`)

  // Create/Get billing period
  const billingPeriod = await prisma.billingPeriod.upsert({
    where: { buildingId_year: { buildingId: building.id, year } },
    update: { status: 'OPEN' },
    create: { buildingId: building.id, year, status: 'OPEN' }
  })
  console.log(`✅ Billing period: ${billingPeriod.id}`)

  // Clean up old data
  console.log('🧹 Cleaning up old data...')
  await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
  await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })

  // Create service cache
  const serviceCache = new Map<string, string>()
  const getOrCreateService = async (name: string): Promise<string> => {
    if (serviceCache.has(name)) return serviceCache.get(name)!
    
    const existing = await prisma.service.findFirst({
      where: { buildingId: building.id, name }
    })
    if (existing) {
      serviceCache.set(name, existing.id)
      return existing.id
    }

    const code = name.substring(0, 10).toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')

    const created = await prisma.service.create({
      data: { buildingId: building.id, name, code }
    })
    serviceCache.set(name, created.id)
    return created.id
  }

  // Map for quick lookup
  const evidenceMap = new Map(data.evidence.map(e => [e.oznaceni, e]))
  const uhradyMap = new Map(data.uhrady.map(u => [u.oznaceni, u]))
  const predpisyMap = new Map(data.predpisy.map(p => [p.oznaceni, p]))
  const meridlaMap = new Map(data.meridla.map(m => [m.oznaceni, m]))
  const vysledkyMap = new Map(data.preplatky_nedoplatky.map(v => [v.oznaceni, v]))

  let importedUnits = 0
  let importedCosts = 0

  for (const ev of data.evidence) {
    const unitNumber = ev.oznaceni
    console.log(`\n📦 Processing: ${unitNumber} (${ev.uzivatel})`)

    // Create/Update Unit
    const unit = await prisma.unit.upsert({
      where: { buildingId_unitNumber: { buildingId: building.id, unitNumber } },
      update: {
        variableSymbol: ev.vs_modified || String(ev.vs),
        totalArea: ev.vymera,
      },
      create: {
        buildingId: building.id,
        unitNumber,
        variableSymbol: ev.vs_modified || String(ev.vs),
        totalArea: ev.vymera,
        shareNumerator: 0,
        shareDenominator: 0,
      }
    })

    // Get results data
    const vysledek = vysledkyMap.get(unitNumber)
    const uhrady = uhradyMap.get(unitNumber)
    const predpisy = predpisyMap.get(unitNumber)
    const meridla = meridlaMap.get(unitNumber)

    // Calculate monthly payments array
    const monthlyPayments = uhrady?.platby || Array(12).fill(0)
    
    // Calculate monthly prescriptions from predpisy object
    const monthlyPrescriptions: number[] = []
    if (predpisy) {
      for (let m = 1; m <= 12; m++) {
        let monthTotal = 0
        for (const key of Object.keys(serviceNameMapping)) {
          const val = predpisy[key]
          if (val && typeof val === 'object') {
            monthTotal += val[String(m)] || 0
          }
        }
        monthlyPrescriptions.push(monthTotal)
      }
    }

    // Create BillingResult
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        totalCost: 0, // Will be calculated from costs
        totalAdvancePrescribed: vysledek?.required_total || 0,
        totalAdvancePaid: vysledek?.payed_total || 0,
        result: vysledek?.preplatek || 0,
        repairFund: 0,
        monthlyPayments,
        monthlyPrescriptions,
        summaryJson: JSON.stringify({
          ownerName: ev.uzivatel,
          email: ev.email,
          phone: ev.telefon,
          address: ev.bydliste,
          bankAccount: ev.bankovni_spojeni,
          variableSymbol: ev.vs_modified,
          period: ev.od_do,
          area: ev.vymera,
          share: ev.podil_dum,
        })
      }
    })

    importedUnits++

    // Create service costs from meridla (actual costs)
    if (meridla) {
      // TUV
      for (const tuv of meridla.tuv) {
        if (tuv.rocni_naklad > 0) {
          const serviceId = await getOrCreateService('Ohřev teplé vody (TUV)')
          const yearlyAdvance = predpisy 
            ? Object.values(predpisy.tuv || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
            : 0
          
          await prisma.billingServiceCost.create({
            data: {
              billingPeriodId: billingPeriod.id,
              billingResultId: billingResult.id,
              serviceId,
              unitId: unit.id,
              buildingTotalCost: 0, // Unknown from JSON
              unitCost: tuv.rocni_naklad,
              unitAdvance: yearlyAdvance,
              unitBalance: yearlyAdvance - tuv.rocni_naklad,
              distributionBase: 'odečty TUV',
              calculationType: 'COST',
            }
          })
          importedCosts++
        }
      }

      // SV (Studená voda)
      for (const sv of meridla.sv) {
        if (sv.rocni_naklad > 0) {
          const serviceId = await getOrCreateService('Studená voda')
          const yearlyAdvance = predpisy 
            ? Object.values(predpisy.voda || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
            : 0
          
          await prisma.billingServiceCost.create({
            data: {
              billingPeriodId: billingPeriod.id,
              billingResultId: billingResult.id,
              serviceId,
              unitId: unit.id,
              buildingTotalCost: 0,
              unitCost: sv.rocni_naklad,
              unitAdvance: yearlyAdvance,
              unitBalance: yearlyAdvance - sv.rocni_naklad,
              distributionBase: 'odečet SV',
              calculationType: 'COST',
            }
          })
          importedCosts++
        }
      }

      // Teplo
      for (const teplo of meridla.teplo) {
        if (teplo.rocni_naklad > 0) {
          const serviceId = await getOrCreateService('Teplo')
          const yearlyAdvance = predpisy 
            ? Object.values(predpisy.teplo || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
            : 0
          
          await prisma.billingServiceCost.create({
            data: {
              billingPeriodId: billingPeriod.id,
              billingResultId: billingResult.id,
              serviceId,
              unitId: unit.id,
              buildingTotalCost: 0,
              unitCost: teplo.rocni_naklad,
              unitAdvance: yearlyAdvance,
              unitBalance: yearlyAdvance - teplo.rocni_naklad,
              distributionBase: 'externí',
              calculationType: 'COST',
            }
          })
          importedCosts++
        }
      }
    }

    // Create costs for other services from predpisy (yearly totals)
    if (predpisy) {
      // Elektrika
      const elektrikaTotal = Object.values(predpisy.elektrika || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
      if (elektrikaTotal > 0) {
        const serviceId = await getOrCreateService('Elektrická energie (společné prostory)')
        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId,
            unitId: unit.id,
            buildingTotalCost: 0,
            unitCost: 0, // Will need to be filled in from faktury
            unitAdvance: elektrikaTotal,
            unitBalance: elektrikaTotal, // Positive = paid more than cost
            distributionBase: 'počet osob',
            calculationType: 'COST',
          }
        })
        importedCosts++
      }

      // Uklid
      const uklidTotal = Object.values(predpisy.uklid || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
      if (uklidTotal > 0) {
        const serviceId = await getOrCreateService('Úklid bytového domu')
        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId,
            unitId: unit.id,
            buildingTotalCost: 0,
            unitCost: 0,
            unitAdvance: uklidTotal,
            unitBalance: uklidTotal,
            distributionBase: 'počet osob',
            calculationType: 'COST',
          }
        })
        importedCosts++
      }

      // Sprava
      const spravaTotal = Object.values(predpisy.sprava || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
      if (spravaTotal > 0) {
        const serviceId = await getOrCreateService('Správa domu')
        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId,
            unitId: unit.id,
            buildingTotalCost: 0,
            unitCost: 0,
            unitAdvance: spravaTotal,
            unitBalance: spravaTotal,
            distributionBase: 'na byt',
            calculationType: 'COST',
          }
        })
        importedCosts++
      }

      // Fond oprav
      const opravyTotal = Object.values(predpisy.opravy || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
      if (opravyTotal > 0) {
        const serviceId = await getOrCreateService('Fond oprav')
        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId,
            unitId: unit.id,
            buildingTotalCost: 0,
            unitCost: opravyTotal, // Fond oprav: cost = advance
            unitAdvance: opravyTotal,
            unitBalance: 0,
            distributionBase: 'vlastnický podíl',
            calculationType: 'FUND',
          }
        })
        importedCosts++
      }

      // Pojisteni
      const pojisteniTotal = Object.values(predpisy.pojisteni || {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)
      if (pojisteniTotal > 0) {
        const serviceId = await getOrCreateService('Pojištění domu')
        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId,
            unitId: unit.id,
            buildingTotalCost: 0,
            unitCost: 0,
            unitAdvance: pojisteniTotal,
            unitBalance: pojisteniTotal,
            distributionBase: 'vlastnický podíl',
            calculationType: 'COST',
          }
        })
        importedCosts++
      }
    }

    // Update totals
    const costs = await prisma.billingServiceCost.findMany({
      where: { billingResultId: billingResult.id }
    })
    const totalCost = costs.reduce((sum, c) => sum + c.unitCost, 0)
    const totalAdvance = costs.reduce((sum, c) => sum + c.unitAdvance, 0)

    await prisma.billingResult.update({
      where: { id: billingResult.id },
      data: {
        totalCost,
        result: vysledek?.preplatek || (totalAdvance - totalCost)
      }
    })
  }

  console.log(`\n✨ Import Complete!`)
  console.log(`   📦 Units imported: ${importedUnits}`)
  console.log(`   💰 Costs imported: ${importedCosts}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
