/**
 * DYNAMICKÝ VÝPOČETNÍ ENGINE
 * 
 * Tento modul interpretuje pravidla uložená v konfiguraci služeb
 * a provádí výpočty dynamicky na základě zadaných parametrů.
 */

import { prisma } from './prisma'

interface Unit {
  id: string
  unitNumber: string
  shareNumerator: number
  shareDenominator: number
  totalArea: number
  floorArea: number | null
  residents: number | null
}

interface CalculationResult {
  unitId: string
  unitName: string
  amount: number
  formula: string
  breakdown: {
    totalCost: number
    divisor: number
    unitValue: number
    pricePerUnit: number
  }
}

/**
 * Získá hodnotu měřidla pro jednotku
 */
async function getMeterValue(
  unitId: string,
  dataSourceName: string,
  dataSourceColumn: string,
  period: number
): Promise<number> {
  // Mapování názvu zdroje na MeterType
  const meterTypeMap: Record<string, 'COLD_WATER' | 'HOT_WATER' | 'HEATING' | 'ELECTRICITY'> = {
    'VODOMER_SV': 'COLD_WATER',
    'VODOMER_TUV': 'HOT_WATER',
    'TEPLO': 'HEATING',
    'ELEKTROMER': 'ELECTRICITY',
  }

  const meterType = meterTypeMap[dataSourceName]
  if (!meterType) return 0

  // Načtení odečtu měřidla pro danou jednotku a období
  const reading = await prisma.meterReading.findFirst({
    where: {
      meter: {
        unitId: unitId,
        type: meterType,
      },
      period: period,
    },
    orderBy: {
      readingDate: 'desc',
    },
  })

  if (!reading) return 0

  // Vrátí požadovanou hodnotu podle sloupce
  switch (dataSourceColumn) {
    case 'consumption':
      return reading.consumption || 0
    case 'currentReading':
      return reading.endValue ?? reading.value ?? 0
    case 'previousReading':
      return reading.startValue ?? 0
    default:
      return reading.consumption || 0
  }
}

/**
 * Získá hodnotu atributu jednotky
 */
function getUnitAttributeValue(unit: Unit, attributeName: string): number {
  switch (attributeName) {
    case 'VLASTNICKY_PODIL':
      // Vrátí podíl jako desetinné číslo (např. 100/10000 = 0.01)
      return unit.shareNumerator / unit.shareDenominator
    case 'CELKOVA_VYMERA':
      return unit.totalArea
    case 'PODLAHOVA_VYMERA':
      return unit.floorArea ?? 0
    case 'POCET_OBYVATEL':
      return unit.residents ?? 0
    default:
      return 0
  }
}

/**
 * Získá počet osobo-měsíců pro jednotku v daném období
 */
async function getPersonMonths(unitId: string, period: number): Promise<number> {
  const personMonths = await prisma.personMonth.findMany({
    where: {
      unitId: unitId,
      year: period,
    },
  })

  // Součet všech měsíců
  return personMonths.reduce((sum: number, pm) => {
    return sum + pm.personCount
  }, 0)
}

/**
 * HLAVNÍ INTERPRETAČNÍ FUNKCE
 * 
 * Dynamicky vypočítá rozúčtování pro službu na základě uložené konfigurace
 */
export async function calculateServiceDistribution(
  serviceId: string,
  buildingId: string,
  period: number,
  totalCost: number
): Promise<CalculationResult[]> {
  
  // Načtení konfigurace služby
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  })

  if (!service) {
    throw new Error(`Služba ${serviceId} nenalezena`)
  }

  // Načtení všech jednotek v budově
  const units = await prisma.unit.findMany({
    where: { buildingId: buildingId },
  })

  const results: CalculationResult[] = []

  // INTERPRETACE PRAVIDEL NA ZÁKLADĚ dataSourceType
  switch (service.dataSourceType) {
    
    // 📊 PODLE MĚŘIDEL
    case 'METER_DATA': {
      if (!service.dataSourceName) {
        throw new Error('Není nastaven zdroj dat pro měřidla')
      }

      // 1. Načíst hodnoty měřidel pro všechny jednotky
      const unitValues = await Promise.all(
        units.map(async (unit: Unit) => ({
          unit,
          value: await getMeterValue(
            unit.id,
            service.dataSourceName!,
            service.dataSourceColumn || 'consumption',
            period
          ),
        }))
      )

      // 2. Spočítat celkovou spotřebu (dělitel)
      const totalConsumption = unitValues.reduce((sum, uv) => sum + uv.value, 0)

      if (totalConsumption === 0) {
        // Pokud není žádná spotřeba, vrátit nuly
        return units.map((unit: Unit) => ({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: 0,
          formula: 'Žádná spotřeba',
          breakdown: { totalCost, divisor: 0, unitValue: 0, pricePerUnit: 0 },
        }))
      }

      // 3. Vypočítat cenu za jednotku spotřeby
      const pricePerUnit = totalCost / totalConsumption

      // 4. Rozúčtovat na jednotky
      for (const { unit, value } of unitValues) {
        const amount = value * pricePerUnit
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amount * 100) / 100,
          formula: `${value.toFixed(2)} × ${pricePerUnit.toFixed(2)} Kč/${service.measurementUnit || 'j'}`,
          breakdown: {
            totalCost,
            divisor: totalConsumption,
            unitValue: value,
            pricePerUnit,
          },
        })
      }
      break
    }

    // 📐 PODLE ATRIBUTU JEDNOTKY
    case 'UNIT_ATTRIBUTE': {
      if (!service.unitAttributeName) {
        throw new Error('Není nastaven atribut jednotky')
      }

      // 1. Načíst hodnoty atributů pro všechny jednotky
      const unitValues = units.map((unit: Unit) => ({
        unit,
        value: getUnitAttributeValue(unit, service.unitAttributeName!),
      }))

      // 2. Spočítat celkový dělitel
      const totalValue = unitValues.reduce((sum: number, uv: { unit: Unit; value: number }) => sum + uv.value, 0)

      if (totalValue === 0) {
        return units.map((unit: Unit) => ({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: 0,
          formula: 'Žádná hodnota atributu',
          breakdown: { totalCost, divisor: 0, unitValue: 0, pricePerUnit: 0 },
        }))
      }

      // 3. Vypočítat cenu za jednotku atributu
      const pricePerUnit = totalCost / totalValue

      // 4. Rozúčtovat na jednotky
      for (const { unit, value } of unitValues) {
        const amount = value * pricePerUnit
        const attributeLabel = getAttributeLabel(service.unitAttributeName!)
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amount * 100) / 100,
          formula: `${value.toFixed(2)} × ${pricePerUnit.toFixed(2)} Kč/${attributeLabel}`,
          breakdown: {
            totalCost,
            divisor: totalValue,
            unitValue: value,
            pricePerUnit,
          },
        })
      }
      break
    }

    // 👨‍👩‍👧‍👦 PODLE OSOBO-MĚSÍCŮ
    case 'PERSON_MONTHS': {
      // 1. Načíst osobo-měsíce pro všechny jednotky
      const unitValues = await Promise.all(
        units.map(async (unit: Unit) => ({
          unit,
          value: await getPersonMonths(unit.id, period),
        }))
      )

      // 2. Spočítat celkem osobo-měsíců
      const totalPersonMonths = unitValues.reduce((sum, uv) => sum + uv.value, 0)

      if (totalPersonMonths === 0) {
        return units.map((unit: Unit) => ({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: 0,
          formula: 'Žádné osobo-měsíce',
          breakdown: { totalCost, divisor: 0, unitValue: 0, pricePerUnit: 0 },
        }))
      }

      // 3. Vypočítat cenu za osobo-měsíc
      const pricePerPersonMonth = totalCost / totalPersonMonths

      // 4. Rozúčtovat na jednotky
      for (const { unit, value } of unitValues) {
        const amount = value * pricePerPersonMonth
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amount * 100) / 100,
          formula: `${value} osob×měs. × ${pricePerPersonMonth.toFixed(2)} Kč/osob×měs.`,
          breakdown: {
            totalCost,
            divisor: totalPersonMonths,
            unitValue: value,
            pricePerUnit: pricePerPersonMonth,
          },
        })
      }
      break
    }

    // 🏠 ROVNÝM DÍLEM
    case 'UNIT_COUNT': {
      const numberOfUnits = units.length
      const amountPerUnit = totalCost / numberOfUnits

      for (const unit of units) {
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amountPerUnit * 100) / 100,
          formula: `${totalCost.toFixed(2)} Kč / ${numberOfUnits} jednotek`,
          breakdown: {
            totalCost,
            divisor: numberOfUnits,
            unitValue: 1,
            pricePerUnit: amountPerUnit,
          },
        })
      }
      break
    }

    // 💰 FIXNÍ ČÁSTKA
    case 'FIXED_AMOUNT': {
      const fixedAmount = service.fixedAmountPerUnit || 0

      for (const unit of units) {
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: fixedAmount,
          formula: `Fixní částka: ${fixedAmount.toFixed(2)} Kč/jednotku`,
          breakdown: {
            totalCost: fixedAmount * units.length,
            divisor: units.length,
            unitValue: 1,
            pricePerUnit: fixedAmount,
          },
        })
      }
      break
    }

    // 🚫 NEVYÚČTOVÁVAT
    case 'NONE': {
      for (const unit of units) {
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: 0,
          formula: 'Nevyúčtovává se',
          breakdown: {
            totalCost: 0,
            divisor: 0,
            unitValue: 0,
            pricePerUnit: 0,
          },
        })
      }
      break
    }

    // FALLBACK NA STAROU LOGIKU (pro zpětnou kompatibilitu)
    default: {
      // Pokud není nastaven dataSourceType, použít starý methodology
      return calculateLegacyMethodology(service.methodology, units, totalCost)
    }
  }

  return results
}

/**
 * Helper funkce pro získání názvu atributu
 */
function getAttributeLabel(attributeName: string): string {
  switch (attributeName) {
    case 'VLASTNICKY_PODIL': return 'podíl'
    case 'CELKOVA_VYMERA': return 'm²'
    case 'PODLAHOVA_VYMERA': return 'm²'
    case 'POCET_OBYVATEL': return 'osoba'
    default: return 'j'
  }
}

/**
 * Stará logika pro zpětnou kompatibilitu
 */
async function calculateLegacyMethodology(
  methodology: string,
  units: Unit[],
  totalCost: number
): Promise<CalculationResult[]> {
  const results: CalculationResult[] = []

  switch (methodology) {
    case 'OWNERSHIP_SHARE': {
      for (const unit of units) {
        const share = unit.shareNumerator / unit.shareDenominator
        const amount = totalCost * share
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amount * 100) / 100,
          formula: `${totalCost.toFixed(2)} × (${unit.shareNumerator}/${unit.shareDenominator})`,
          breakdown: {
            totalCost,
            divisor: unit.shareDenominator,
            unitValue: unit.shareNumerator,
            pricePerUnit: totalCost,
          },
        })
      }
      break
    }

    case 'AREA': {
      const totalArea = units.reduce((sum, u) => sum + (u.floorArea ?? 0), 0)
      const pricePerM2 = totalCost / totalArea
      for (const unit of units) {
        const floorArea = unit.floorArea ?? 0
        const amount = floorArea * pricePerM2
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amount * 100) / 100,
          formula: `${floorArea.toFixed(2)} m² × ${pricePerM2.toFixed(2)} Kč/m²`,
          breakdown: {
            totalCost,
            divisor: totalArea,
            unitValue: floorArea,
            pricePerUnit: pricePerM2,
          },
        })
      }
      break
    }

    case 'EQUAL_SPLIT': {
      const amountPerUnit = totalCost / units.length
      for (const unit of units) {
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: Math.round(amountPerUnit * 100) / 100,
          formula: `${totalCost.toFixed(2)} Kč / ${units.length} jednotek`,
          breakdown: {
            totalCost,
            divisor: units.length,
            unitValue: 1,
            pricePerUnit: amountPerUnit,
          },
        })
      }
      break
    }

    default: {
      // Neznámá metodologie - vrátit nuly
      for (const unit of units) {
        results.push({
          unitId: unit.id,
          unitName: unit.unitNumber,
          amount: 0,
          formula: 'Nepodporovaná metodologie',
          breakdown: {
            totalCost: 0,
            divisor: 0,
            unitValue: 0,
            pricePerUnit: 0,
          },
        })
      }
    }
  }

  return results
}
