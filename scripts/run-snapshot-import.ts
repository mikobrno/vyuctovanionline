/**
 * Přímá simulace snapshot importu bez HTTP
 * Volá stejnou logiku jako API endpoint
 * 
 * npx tsx scripts/run-snapshot-import.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { read, utils } from 'xlsx'
import { prisma } from '../lib/prisma'

interface MeterReading {
  serial: string
  start: number
  end: number
  consumption: number
}

interface ServiceData {
  name: string
  buildingTotalCost: number
  unitCost: number
  unitAdvance: number
  unitBalance: number
  buildingConsumption?: number
  unitConsumption?: number
  unitPricePerUnit?: number
  distributionBase?: string
  calculationType: string
  monthlyAdvances: number[]
  meterReadings: MeterReading[]
}

interface UnitData {
  unitName: string
  ownerName?: string
  variableSymbol?: string
  email?: string
  address?: string
  totalResult: number
  totalCost: number
  totalAdvance: number
  repairFund: number
  services: Map<string, ServiceData>
  monthlyAdvances: number[]
  monthlyPayments: number[]
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  let str = String(value).replace(/[^\d,.\-]/g, '')
  str = str.replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

function normalizeUnitName(name: string): string {
  return name
    .toLowerCase()
    .replace(/byt[-\s]*č\.?\s*/gi, '')
    .replace(/jednotka[-\s]*č\.?\s*/gi, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, '')
    .trim()
}

function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractBuildingNumber(unitName: string): string | null {
  const allDigits = unitName.match(/(\d+)$/)
  if (!allDigits) return null
  const digits = allDigits[1]
  if (digits.length >= 5) return digits.substring(0, 4)
  if (digits.length >= 4) return digits.substring(0, 3)
  return digits
}

async function runSnapshotImport() {
  const filePath = path.join(__dirname, '../JSON/vyuctovani2024.xlsx')
  const year = 2024
  
  console.log('📁 Soubor:', filePath)
  
  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  
  const exportSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().replace(/[\s_-]/g, '').includes('exportfull')
  )
  
  if (!exportSheetName) {
    console.error('❌ List EXPORT_FULL nenalezen')
    process.exit(1)
  }
  
  console.log('✓ List:', exportSheetName)
  
  const sheet = workbook.Sheets[exportSheetName]
  const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  
  const headers = (rawData[0] as unknown[]).map(h => String(h || '').trim())
  const getColIndex = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  
  const colUnitName = Math.max(0, getColIndex('UnitName'))
  const colDataType = Math.max(1, getColIndex('DataType'))
  const colKey = Math.max(2, getColIndex('Key'))
  const colVal1 = Math.max(3, getColIndex('Val1'))
  
  // === FÁZE 1: Načíst data z Excelu ===
  const unitDataMap = new Map<string, UnitData>()
  let currentUnitName = ''
  let firstAddress = ''
  let buildingNumberFromUnits = ''
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length === 0) continue
    
    const unitName = String(row[colUnitName] || '').trim() || currentUnitName
    const dataType = String(row[colDataType] || '').toUpperCase().trim()
    const key = String(row[colKey] || '').trim()
    
    const values: unknown[] = []
    for (let v = 0; v < 14; v++) {
      const idx = colVal1 + v
      values.push(idx < row.length ? row[idx] : null)
    }
    
    if (!unitName || !dataType) continue
    currentUnitName = unitName
    
    if (!buildingNumberFromUnits && unitName) {
      buildingNumberFromUnits = extractBuildingNumber(unitName) || ''
    }
    
    let unitData = unitDataMap.get(unitName)
    if (!unitData) {
      unitData = {
        unitName,
        totalResult: 0,
        totalCost: 0,
        totalAdvance: 0,
        repairFund: 0,
        services: new Map(),
        monthlyAdvances: new Array(12).fill(0),
        monthlyPayments: new Array(12).fill(0)
      }
      unitDataMap.set(unitName, unitData)
    }
    
    switch (dataType) {
      case 'INFO': {
        unitData.address = values[0] ? String(values[0]) : undefined
        unitData.variableSymbol = values[1] ? String(values[1]) : undefined
        unitData.email = values[2] ? String(values[2]) : undefined
        if (!firstAddress && unitData.address && !unitData.address.includes('#')) {
          firstAddress = unitData.address
        }
        unitData.totalResult = parseMoney(values[3])
        unitData.totalCost = parseMoney(values[4])
        unitData.totalAdvance = parseMoney(values[5])
        unitData.repairFund = parseMoney(values[6])
        break
      }
      case 'COST': {
        const serviceName = key || ''
        const serviceData: ServiceData = {
          name: serviceName,
          buildingTotalCost: parseMoney(values[0]),
          unitCost: parseMoney(values[1]),
          unitAdvance: parseMoney(values[2]),
          unitBalance: parseMoney(values[3]),
          buildingConsumption: values[4] ? parseMoney(values[4]) : undefined,
          unitConsumption: values[5] ? parseMoney(values[5]) : undefined,
          unitPricePerUnit: values[6] ? parseMoney(values[6]) : undefined,
          distributionBase: values[7] ? String(values[7]) : undefined,
          calculationType: 'COST',
          monthlyAdvances: new Array(12).fill(0),
          meterReadings: []
        }
        unitData.services.set(normalizeServiceName(serviceName), serviceData)
        break
      }
      case 'METER': {
        const serviceName = key || ''
        const normalizedService = normalizeServiceName(serviceName)
        const meterReading: MeterReading = {
          serial: values[0] ? String(values[0]) : '',
          start: parseMoney(values[1]),
          end: parseMoney(values[2]),
          consumption: parseMoney(values[3])
        }
        let serviceData = unitData.services.get(normalizedService)
        if (!serviceData) {
          serviceData = {
            name: serviceName,
            buildingTotalCost: 0, unitCost: 0, unitAdvance: 0, unitBalance: 0,
            calculationType: 'METER',
            monthlyAdvances: new Array(12).fill(0),
            meterReadings: []
          }
          unitData.services.set(normalizedService, serviceData)
        }
        serviceData.meterReadings.push(meterReading)
        serviceData.calculationType = 'METER'
        break
      }
      case 'ADVANCE_MONTHLY': {
        const monthlyAdvances: number[] = []
        for (let m = 0; m < 12; m++) monthlyAdvances.push(parseMoney(values[m]))
        if (key) {
          const serviceData = unitData.services.get(normalizeServiceName(key))
          if (serviceData) serviceData.monthlyAdvances = monthlyAdvances
        } else {
          unitData.monthlyAdvances = monthlyAdvances
        }
        break
      }
      case 'FUND': {
        const serviceName = key || 'Fond oprav'
        unitData.repairFund = parseMoney(values[0])
        const serviceData: ServiceData = {
          name: serviceName,
          buildingTotalCost: parseMoney(values[1]),
          unitCost: parseMoney(values[0]),
          unitAdvance: parseMoney(values[2]),
          unitBalance: parseMoney(values[3]),
          calculationType: 'FUND',
          monthlyAdvances: new Array(12).fill(0),
          meterReadings: []
        }
        unitData.services.set(normalizeServiceName(serviceName), serviceData)
        break
      }
    }
  }
  
  console.log(`📊 Načteno ${unitDataMap.size} jednotek z Excelu`)
  console.log(`🏠 Č.p. z bytů: ${buildingNumberFromUnits}`)
  console.log(`📍 První adresa: ${firstAddress}`)
  
  // === FÁZE 2: Najít nebo vytvořit budovu ===
  let building = null
  let buildingCreated = false
  
  if (buildingNumberFromUnits) {
    building = await prisma.building.findFirst({
      where: {
        OR: [
          { name: { contains: buildingNumberFromUnits, mode: 'insensitive' } },
          { address: { contains: buildingNumberFromUnits, mode: 'insensitive' } }
        ]
      }
    })
    if (building) {
      console.log(`✓ Budova nalezena podle č.p. ${buildingNumberFromUnits}: ${building.name}`)
    }
  }
  
  if (!building && firstAddress) {
    const addressParts = firstAddress.split(',')[0].trim()
    const streetMatch = addressParts.match(/^([^\d]+)\s*(\d+)/)
    if (streetMatch) {
      const street = streetMatch[1].trim()
      building = await prisma.building.findFirst({
        where: {
          OR: [
            { name: { contains: street, mode: 'insensitive' } },
            { address: { contains: street, mode: 'insensitive' } }
          ]
        }
      })
      if (building) {
        console.log(`✓ Budova nalezena podle ulice "${street}": ${building.name}`)
      }
    }
  }
  
  if (!building) {
    const buildingName = firstAddress 
      ? firstAddress.split(',')[0].trim()
      : `Budova ${buildingNumberFromUnits || 'Nová'}`
    
    let city = 'Brno'
    let zipCode = '60000'
    if (firstAddress) {
      const pscMatch = firstAddress.match(/(\d{3}\s?\d{2})/)
      if (pscMatch) zipCode = pscMatch[1].replace(/\s/g, '')
      const cityMatch = firstAddress.match(/\d{3}\s?\d{2}\s+([^,]+)/)
      if (cityMatch) city = cityMatch[1].trim()
    }
    
    building = await prisma.building.create({
      data: { name: buildingName, address: firstAddress || buildingName, city, zip: zipCode }
    })
    buildingCreated = true
    console.log(`✓ Vytvořena nová budova: ${building.name}`)
  }
  
  console.log(`\n🏢 Budova: ${building.name} (${building.id})`)
  console.log(`📅 Rok: ${year}`)
  
  // === FÁZE 3: Billing period ===
  let billingPeriod = await prisma.billingPeriod.findFirst({
    where: { buildingId: building.id, year }
  })
  
  if (!billingPeriod) {
    billingPeriod = await prisma.billingPeriod.create({
      data: { buildingId: building.id, year }
    })
    console.log(`✓ Vytvořeno nové období: ${year}`)
  } else {
    console.log(`✓ Používám existující období: ${year} - PŘEPISUJI DATA`)
  }
  
  // === FÁZE 4: Smazat staré výsledky ===
  console.log('\n🗑️  Mažu staré výsledky...')
  const deletedCosts = await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
  const deletedResults = await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
  console.log(`   Smazáno ${deletedResults.count} výsledků, ${deletedCosts.count} nákladů služeb`)
  
  // === FÁZE 5: Jednotky ===
  const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
  const unitMap = new Map<string, typeof units[0]>()
  units.forEach(u => {
    unitMap.set(u.unitNumber, u)
    unitMap.set(u.unitNumber.toLowerCase(), u)
    unitMap.set(normalizeUnitName(u.unitNumber), u)
  })
  
  let createdUnits = 0
  for (const [unitName] of unitDataMap) {
    const normalizedName = normalizeUnitName(unitName)
    const transformedName = unitName.replace(/-/g, ' ').replace(/č\./i, 'č. ')
    
    const existingUnit = unitMap.get(unitName) 
      || unitMap.get(normalizedName) 
      || unitMap.get(transformedName)
      || unitMap.get(transformedName.toLowerCase())
    
    if (!existingUnit) {
      try {
        const newUnit = await prisma.unit.create({
          data: {
            buildingId: building.id,
            unitNumber: transformedName,
            totalArea: 0,
            shareNumerator: 1,
            shareDenominator: 100
          }
        })
        unitMap.set(unitName, newUnit)
        unitMap.set(normalizedName, newUnit)
        unitMap.set(transformedName, newUnit)
        createdUnits++
      } catch {
        // Jednotka už existuje - načteme ji
        const existing = await prisma.unit.findFirst({
          where: { 
            buildingId: building.id,
            unitNumber: { contains: normalizedName.replace(/\//g, ''), mode: 'insensitive' }
          }
        })
        if (existing) {
          unitMap.set(unitName, existing)
          unitMap.set(normalizedName, existing)
        }
      }
    } else {
      unitMap.set(unitName, existingUnit)
      unitMap.set(normalizedName, existingUnit)
    }
  }
  if (createdUnits > 0) console.log(`✓ Vytvořeno ${createdUnits} nových jednotek`)
  
  // === FÁZE 6: Služby ===
  const services = await prisma.service.findMany({ where: { buildingId: building.id } })
  const serviceMap = new Map<string, typeof services[0]>()
  services.forEach(s => serviceMap.set(normalizeServiceName(s.name), s))
  
  const allServiceNames = new Set<string>()
  for (const [, unitData] of unitDataMap) {
    for (const [, serviceData] of unitData.services) {
      if (serviceData.name) allServiceNames.add(serviceData.name)
    }
  }
  
  let createdServices = 0
  for (const serviceName of allServiceNames) {
    const normalizedName = normalizeServiceName(serviceName)
    if (!serviceMap.has(normalizedName)) {
      const newService = await prisma.service.create({
        data: {
          buildingId: building.id,
          name: serviceName,
          code: normalizedName.replace(/\s+/g, '_').toUpperCase().substring(0, 20),
          methodology: 'OWNERSHIP_SHARE'
        }
      })
      serviceMap.set(normalizedName, newService)
      createdServices++
    }
  }
  if (createdServices > 0) console.log(`✓ Vytvořeno ${createdServices} nových služeb`)
  
  // === FÁZE 7: Uložit výsledky ===
  console.log('\n💾 Ukládám výsledky vyúčtování...')
  
  let createdResults = 0
  let createdServiceCosts = 0
  let updatedUnits = 0
  const warnings: string[] = []
  
  for (const [unitName, unitData] of unitDataMap) {
    const normalizedName = normalizeUnitName(unitName)
    const unit = unitMap.get(unitName) || unitMap.get(normalizedName)
    
    if (!unit) {
      warnings.push(`Jednotka nenalezena: ${unitName}`)
      continue
    }
    
    if (unitData.variableSymbol) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { variableSymbol: unitData.variableSymbol }
      })
      updatedUnits++
    }
    
    // Spočítat celkový výsledek ze služeb
    let totalCost = unitData.totalCost
    let totalAdvance = unitData.totalAdvance
    if (totalCost === 0) {
      for (const [, serviceData] of unitData.services) {
        totalCost += serviceData.unitCost
        totalAdvance += serviceData.unitAdvance
      }
    }
    const totalResult = unitData.totalResult || (totalAdvance - totalCost)
    
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        totalCost,
        totalAdvancePrescribed: totalAdvance,
        totalAdvancePaid: totalAdvance,
        repairFund: unitData.repairFund,
        result: totalResult,
        monthlyPrescriptions: unitData.monthlyAdvances.some(a => a > 0) ? unitData.monthlyAdvances : undefined,
        monthlyPayments: unitData.monthlyPayments.some(p => p > 0) ? unitData.monthlyPayments : undefined,
        summaryJson: JSON.stringify({
          ownerName: unitData.ownerName,
          email: unitData.email,
          address: unitData.address,
          variableSymbol: unitData.variableSymbol
        })
      }
    })
    createdResults++
    
    for (const [normalizedServiceName, serviceData] of unitData.services) {
      let service = serviceMap.get(normalizedServiceName)
      if (!service) {
        for (const [sName, sData] of serviceMap) {
          if (sName.includes(normalizedServiceName) || normalizedServiceName.includes(sName)) {
            service = sData
            break
          }
        }
      }
      if (!service) {
        warnings.push(`Služba nenalezena: ${serviceData.name}`)
        continue
      }
      
      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: billingPeriod.id,
          billingResultId: billingResult.id,
          serviceId: service.id,
          unitId: unit.id,
          buildingTotalCost: serviceData.buildingTotalCost,
          buildingConsumption: serviceData.buildingConsumption,
          unitConsumption: serviceData.unitConsumption,
          unitCost: serviceData.unitCost,
          unitAdvance: serviceData.unitAdvance,
          unitBalance: serviceData.unitBalance,
          unitPricePerUnit: serviceData.unitPricePerUnit,
          distributionBase: serviceData.distributionBase,
          calculationType: serviceData.calculationType,
          monthlyAdvances: serviceData.monthlyAdvances.some(a => a > 0)
            ? JSON.stringify(serviceData.monthlyAdvances) : null,
          meterReadings: serviceData.meterReadings.length > 0
            ? JSON.stringify(serviceData.meterReadings) : null
        }
      })
      createdServiceCosts++
    }
  }
  
  console.log('\n✅ Import dokončen!')
  console.log(`   Budova: ${building.name} ${buildingCreated ? '(NOVÁ)' : '(existující)'}`)
  console.log(`   Rok: ${year}`)
  console.log(`   Jednotek v Excelu: ${unitDataMap.size}`)
  console.log(`   VS aktualizováno: ${updatedUnits}`)
  console.log(`   BillingResults: ${createdResults}`)
  console.log(`   ServiceCosts: ${createdServiceCosts}`)
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Varování (${warnings.length}):`)
    warnings.slice(0, 10).forEach(w => console.log(`   - ${w}`))
    if (warnings.length > 10) console.log(`   ... a dalších ${warnings.length - 10}`)
  }
  
  await prisma.$disconnect()
}

runSnapshotImport().catch(e => {
  console.error('❌ Chyba:', e)
  prisma.$disconnect()
  process.exit(1)
})
