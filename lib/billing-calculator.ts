import { prisma } from './prisma'
import { CalculationMethod } from '@prisma/client'

interface UnitCalculationData {
  unitId: string
  unitNumber: string
  ownershipShare: number // čitatel/jmenovatel jako desetinné číslo
  area: number
  personMonths: number
  consumption?: number
}

interface ServiceCalculation {
  serviceId: string
  serviceName: string
  methodology: CalculationMethod
  totalCost: number
  unitCost: number
  calculationBasis: string
  unitConsumption?: number
  buildingConsumption?: number
}

/**
 * Hlavní třída pro výpočet vyúčtování
 */
export class BillingCalculator {
  private buildingId: string
  private year: number

  constructor(buildingId: string, year: number) {
    this.buildingId = buildingId
    this.year = year
  }

  /**
   * Spustí kompletní výpočet vyúčtování pro celý dům
   */
  async calculate() {
    console.log(`[Billing] Zahajuji výpočet vyúčtování pro rok ${this.year}`)

    // 1. Získat nebo vytvořit období vyúčtování
    let billingPeriod = await prisma.billingPeriod.findUnique({
      where: {
        buildingId_year: {
          buildingId: this.buildingId,
          year: this.year,
        },
      },
    })

    if (!billingPeriod) {
      billingPeriod = await prisma.billingPeriod.create({
        data: {
          buildingId: this.buildingId,
          year: this.year,
          status: 'DRAFT',
        },
      })
    }

    // 2. Získat všechny jednotky
    const units = await prisma.unit.findMany({
      where: { buildingId: this.buildingId },
      include: {
        meters: {
          include: {
            readings: {
              where: { period: this.year },
            },
          },
        },
        personMonths: {
          where: { year: this.year },
        },
      },
    })

    // 3. Získat všechny služby
    const services = await prisma.service.findMany({
      where: {
        buildingId: this.buildingId,
        isActive: true,
      },
      include: {
        costs: {
          where: { period: this.year },
        },
      },
    })

    // 4. Získat platby pro každou jednotku
    const payments = await prisma.payment.findMany({
      where: {
        unit: {
          buildingId: this.buildingId,
        },
        period: this.year,
      },
    })

    // 5. Pro každou jednotku vypočítat vyúčtování
    for (const unit of units) {
      console.log(`[Billing] Počítám jednotku ${unit.unitNumber}`)

      // Připravit data jednotky
      const unitData: UnitCalculationData = {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        ownershipShare: unit.shareNumerator / unit.shareDenominator,
        area: unit.totalArea,
        personMonths: unit.personMonths.reduce((sum, pm) => sum + pm.personCount, 0),
      }

      // Vytvořit prázdný výsledek vyúčtování (pro FK constraint)
      await prisma.billingResult.upsert({
        where: {
          billingPeriodId_unitId: {
            billingPeriodId: billingPeriod.id,
            unitId: unit.id,
          },
        },
        create: {
          id: `${billingPeriod.id}_${unit.id}`,
          billingPeriodId: billingPeriod.id,
          unitId: unit.id,
          totalCost: 0,
          totalAdvancePrescribed: 0,
          totalAdvancePaid: 0,
          result: 0,
        },
        update: {},
      })

      let totalUnitCost = 0
      const serviceCalculations: ServiceCalculation[] = []

      // Pro každou službu vypočítat náklad jednotky
      for (const service of services) {
        const serviceCost = service.costs.reduce((sum, cost) => sum + cost.amount, 0)
        
        if (serviceCost === 0) continue

        const calculation = await this.calculateServiceForUnit(
          service,
          serviceCost,
          unitData,
          units,
          unit
        )

        serviceCalculations.push(calculation)
        totalUnitCost += calculation.unitCost

        // Uložit detail nákladu na službu
        await prisma.billingServiceCost.upsert({
          where: {
            billingResultId_serviceId: {
              billingResultId: `${billingPeriod.id}_${unit.id}`,
              serviceId: service.id,
            },
          },
          create: {
            billingPeriodId: billingPeriod.id,
            billingResultId: `${billingPeriod.id}_${unit.id}`,
            serviceId: service.id,
            unitId: unit.id,
            buildingTotalCost: serviceCost,
            buildingConsumption: calculation.buildingConsumption,
            unitConsumption: calculation.unitConsumption,
            unitCost: calculation.unitCost,
            calculationBasis: calculation.calculationBasis,
          },
          update: {
            buildingTotalCost: serviceCost,
            buildingConsumption: calculation.buildingConsumption,
            unitConsumption: calculation.unitConsumption,
            unitCost: calculation.unitCost,
            calculationBasis: calculation.calculationBasis,
          },
        })
      }

      // Spočítat celkové zálohy
      const unitPayments = payments.filter(p => p.unitId === unit.id)
      const totalPaid = unitPayments.reduce((sum, p) => sum + p.amount, 0)

      // TODO: Předepsané zálohy - bude načteno z předpisu záloh
      const totalPrescribed = totalPaid // Dočasně stejné jako uhrazené

      const result = totalPaid - totalUnitCost

      // Uložit výsledek vyúčtování
      await prisma.billingResult.upsert({
        where: {
          billingPeriodId_unitId: {
            billingPeriodId: billingPeriod.id,
            unitId: unit.id,
          },
        },
        create: {
          id: `${billingPeriod.id}_${unit.id}`,
          billingPeriodId: billingPeriod.id,
          unitId: unit.id,
          totalCost: totalUnitCost,
          totalAdvancePrescribed: totalPrescribed,
          totalAdvancePaid: totalPaid,
          result: result,
        },
        update: {
          totalCost: totalUnitCost,
          totalAdvancePrescribed: totalPrescribed,
          totalAdvancePaid: totalPaid,
          result: result,
        },
      })

      console.log(`[Billing] ${unit.unitNumber}: Náklad ${totalUnitCost.toFixed(2)} Kč, Uhrazeno ${totalPaid.toFixed(2)} Kč, Výsledek ${result.toFixed(2)} Kč`)
    }

    // 6. Aktualizovat stav období
    await prisma.billingPeriod.update({
      where: { id: billingPeriod.id },
      data: {
        status: 'CALCULATED',
        calculatedAt: new Date(),
      },
    })

    console.log(`[Billing] Výpočet dokončen`)

    return billingPeriod
  }

  /**
   * Vypočítá náklad jednotky na konkrétní službu
   */
  private async calculateBuildingUnits(
    service: any,
    units: any[],
    meterReadings: any[]
  ): Promise<number> {
    switch (service.methodology) {
      case 'OWNERSHIP_SHARE':
        // Součet všech vlastnických podílů (obvykle 100 %)
        return units.reduce((sum, unit) => sum + (unit.ownershipShare || 0), 0);
      
      case 'AREA':
        // Součet všech ploch bytů v m²
        return units.reduce((sum, unit) => sum + (unit.area || 0), 0);
      
      case 'PERSON_MONTHS':
        // Součet všech osobo-měsíců
        return units.reduce((sum, unit) => sum + (unit.personMonths || 0), 0);
      
      case 'METER_READING':
        // Součet všech spotřeb z měřidel pro tuto službu
        const serviceReadings = meterReadings.filter(
          reading => reading.meter.serviceId === service.id
        );
        return serviceReadings.reduce((sum, reading) => sum + (reading.consumption || 0), 0);
      
      case 'FIXED_PER_UNIT':
        // Počet jednotek (bytů)
        return units.length;
      
      case 'EQUAL_SPLIT':
        // Počet jednotek (bytů)
        return units.length;
      
      case 'NO_BILLING':
        // Nevyúčtovává se, ale technicky můžeme vracet počet jednotek pro zobrazení
        return units.length;
      
      default:
        return 0;
    }
  }

  private async calculateServiceForUnit(
    service: any,
    totalServiceCost: number,
    unitData: UnitCalculationData,
    allUnits: any[],
    currentUnit: any
  ): Promise<ServiceCalculation> {
    let unitCost = 0
    let calculationBasis = ''
    let unitConsumption: number | undefined
    let buildingConsumption: number | undefined

    switch (service.methodology) {
      // 1. VLASTNICKÝ PODÍL
      case 'OWNERSHIP_SHARE':
        unitCost = totalServiceCost * unitData.ownershipShare
        calculationBasis = `${totalServiceCost.toFixed(2)} Kč × ${unitData.ownershipShare.toFixed(6)} = ${unitCost.toFixed(2)} Kč`
        break

      // 2. PODLE VÝMĚRY
      case 'AREA':
        const totalArea = allUnits.reduce((sum, u) => sum + u.totalArea, 0)
        unitCost = (totalServiceCost / totalArea) * unitData.area
        calculationBasis = `(${totalServiceCost.toFixed(2)} Kč / ${totalArea.toFixed(2)} m²) × ${unitData.area.toFixed(2)} m² = ${unitCost.toFixed(2)} Kč`
        buildingConsumption = totalArea
        unitConsumption = unitData.area
        break

      // 3. OSOBO-MĚSÍCE
      case 'PERSON_MONTHS':
        const totalPersonMonths = allUnits.reduce((sum, u) => {
          return sum + u.personMonths.reduce((s: number, pm: { personCount: number }) => s + pm.personCount, 0)
        }, 0)
        
        if (totalPersonMonths > 0) {
          unitCost = (totalServiceCost / totalPersonMonths) * unitData.personMonths
          calculationBasis = `(${totalServiceCost.toFixed(2)} Kč / ${totalPersonMonths} os-měs) × ${unitData.personMonths} os-měs = ${unitCost.toFixed(2)} Kč`
          buildingConsumption = totalPersonMonths
          unitConsumption = unitData.personMonths
        } else {
          unitCost = 0
          calculationBasis = 'Chybí data o počtu osob'
        }
        break

      // 4. PODLE MĚŘIDEL
      case 'METER_READING':
        // Najít měřidlo odpovídající typu služby
        const meterTypeMap: Record<string, string> = {
          'TEPLO': 'HEATING',
          'TUV': 'HOT_WATER',
          'SV': 'COLD_WATER',
          'ELEKTRINA': 'ELECTRICITY',
        }
        
        const meterType = meterTypeMap[service.code] || 'HEATING'
        const meter = currentUnit.meters.find((m: { type: string; isActive: boolean }) => m.type === meterType && m.isActive)
        
        // Zkontrolovat, zda existuje předvypočítaný náklad (z Excelu)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readingWithPrecalc = meter?.readings.find((r: any) => r.precalculatedCost !== null && r.precalculatedCost !== undefined)

        if (readingWithPrecalc) {
          // POUŽÍT PŘEDVYPOČÍTANÝ NÁKLAD Z EXCELU
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unitCost = (readingWithPrecalc as any).precalculatedCost
          unitConsumption = readingWithPrecalc.consumption || 0
          calculationBasis = `Převzato z externího výpočtu (Excel): ${unitCost.toFixed(2)} Kč`
          
          // Pro statistiku spočítáme celkovou spotřebu, i když ji nepoužíváme pro výpočet ceny
          buildingConsumption = allUnits.reduce((sum, u) => {
            const unitMeter = u.meters.find((m: { type: string; isActive: boolean }) => m.type === meterType && m.isActive)
            if (unitMeter && (unitMeter as { readings: { consumption: number }[] }).readings.length > 0) {
              return sum + ((unitMeter as { readings: { consumption: number }[] }).readings[0].consumption || 0)
            }
            return sum
          }, 0)

        } else if (meter && (meter as { readings: { consumption: number }[] }).readings.length > 0) {
          // STANDARDNÍ VÝPOČET PODLE SPOTŘEBY
          const reading = (meter as { readings: { consumption: number }[] }).readings[0]
          unitConsumption = reading.consumption || 0
          
          // Spočítat celkovou spotřebu domu
          buildingConsumption = allUnits.reduce((sum, u) => {
            const unitMeter = u.meters.find((m: { type: string; isActive: boolean }) => m.type === meterType && m.isActive)
            if (unitMeter && (unitMeter as { readings: { consumption: number }[] }).readings.length > 0) {
              return sum + ((unitMeter as { readings: { consumption: number }[] }).readings[0].consumption || 0)
            }
            return sum
          }, 0)
          
          if (buildingConsumption > 0) {
            unitCost = (totalServiceCost / buildingConsumption) * unitConsumption
            calculationBasis = `(${totalServiceCost.toFixed(2)} Kč / ${buildingConsumption.toFixed(2)} ${service.measurementUnit || 'j'}) × ${unitConsumption.toFixed(2)} ${service.measurementUnit || 'j'} = ${unitCost.toFixed(2)} Kč`
          } else {
            unitCost = 0
            calculationBasis = 'Chybí odečty měřidel'
          }
        } else {
          unitCost = 0
          calculationBasis = 'Jednotka nemá měřidlo'
        }
        break

      // 5. FIXNÍ ČÁSTKA NA JEDNOTKU (DLE POČTU BYTŮ)
      case 'FIXED_PER_UNIT':
        unitCost = service.fixedAmountPerUnit || 0
        calculationBasis = `Fixní částka ${unitCost.toFixed(2)} Kč/byt`
        break

      // 6. ROVNÝM DÍLEM
      case 'EQUAL_SPLIT':
        const unitCount = allUnits.length
        unitCost = totalServiceCost / unitCount
        calculationBasis = `${totalServiceCost.toFixed(2)} Kč / ${unitCount} jednotek = ${unitCost.toFixed(2)} Kč`
        break

      // 7. NEVYÚČTOVÁVAT (Fond oprav apod.)
      case 'NO_BILLING':
        unitCost = 0
        calculationBasis = 'Nevyúčtovává se (převod na účet)'
        break

      // 8. VLASTNÍ VZOREC
      case 'CUSTOM':
        // TODO: Implementovat vlastní vzorce
        unitCost = 0
        calculationBasis = 'Vlastní vzorec není nastaven'
        break

      default:
        unitCost = 0
        calculationBasis = 'Neznámý způsob výpočtu'
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      methodology: service.methodology,
      totalCost: totalServiceCost,
      unitCost,
      calculationBasis,
      unitConsumption,
      buildingConsumption,
    }
  }
}
