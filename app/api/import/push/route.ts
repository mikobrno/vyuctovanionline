import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const maxDuration = 60 // Prodloužený timeout pro větší importy

// --- Definice typů pro vstupní JSON ---

interface UnitCost {
  serviceName: string
  total: number      // Celkový náklad na dům (pro info)
  userCost: number   // Náklad na jednotku
  advance: number    // Záloha
  unitDetails?: {
    buildingUnits?: string // např. "100 m2"
    price?: string         // např. "50"
    userUnits?: string     // např. "10"
  }
}

interface UnitMeter {
  serial: string
  service: string
  start: number
  end: number
  cons: number
}

interface UnitData {
  name: string
  owner: string
  email?: string
  variableSymbol?: string
  bankAccount?: string
  balance: number
  costs: UnitCost[]
  meters: UnitMeter[]
  monthly: {
    advances: number[]
    payments: number[]
  }
}

interface PushImportBody {
  buildingName: string
  year: number
  units: UnitData[]
}

// --- Pomocné funkce ---

function normalizeServiceName(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function stripUnitPrefixes(name: string): string {
  return name.replace(/^(byt|nebyt|jednotka|garaz|atelier)\s*\.?\s*/i, '').trim()
}

// --- Hlavní API Handler ---

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PushImportBody
    
    if (!body.buildingName || !body.year || !Array.isArray(body.units)) {
      return NextResponse.json({ error: 'Neplatný formát dat. Chybí buildingName, year nebo units.' }, { status: 400 })
    }

    console.log(`[Push Import] Začínám import pro: ${body.buildingName}, rok: ${body.year}, jednotek: ${body.units.length}`)

    // 1. Najít nebo vytvořit budovu
    let building = await prisma.building.findFirst({
      where: { name: body.buildingName }
    })

    if (!building) {
      console.log(`[Push Import] Vytvářím novou budovu: ${body.buildingName}`)
      building = await prisma.building.create({
        data: {
          name: body.buildingName,
          address: 'Importováno z Excelu',
          city: '',
          zip: ''
        }
      })
    }

    // 2. Najít nebo vytvořit zúčtovací období
    const billingPeriod = await prisma.billingPeriod.upsert({
      where: {
        buildingId_year: {
          buildingId: building.id,
          year: body.year
        }
      },
      create: {
        buildingId: building.id,
        year: body.year
      },
      update: {}
    })

    // 3. Smazat staré výsledky pro tento rok (Snapshot logika - přepisujeme vše)
    await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
    await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })

    // 4. Příprava služeb (zajistit, že existují v DB)
    const uniqueServiceNames = new Set<string>()
    body.units.forEach(u => u.costs.forEach(c => uniqueServiceNames.add(c.serviceName)))

    const serviceMap = new Map<string, string>() // NormalizedName -> ServiceId

    // Načíst existující služby
    const existingServices = await prisma.service.findMany({ where: { buildingId: building.id } })
    existingServices.forEach(s => serviceMap.set(normalizeServiceName(s.name), s.id))

    // Vytvořit chybějící služby
    for (const sName of uniqueServiceNames) {
      const normalized = normalizeServiceName(sName)
      if (!serviceMap.has(normalized)) {
        const newService = await prisma.service.create({
          data: {
            buildingId: building.id,
            name: sName,
            code: normalized.substring(0, 10).toUpperCase(), // Generování kódu
            methodology: 'OWNERSHIP_SHARE' // Default
          }
        })
        serviceMap.set(normalized, newService.id)
      }
    }

    // 5. Zpracování jednotek
    let createdResults = 0
    
    for (const unitData of body.units) {
      // A. Najít nebo vytvořit jednotku
      const normalizedUnitName = stripUnitPrefixes(unitData.name)
      let unit = await prisma.unit.findFirst({
        where: {
          buildingId: building.id,
          OR: [
            { unitNumber: unitData.name },
            { unitNumber: normalizedUnitName }
          ]
        }
      })

      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            buildingId: building.id,
            unitNumber: unitData.name,
            type: 'APARTMENT',
            shareNumerator: 1,
            shareDenominator: 1,
            totalArea: 0
          }
        })
      } else {
        // Aktualizace VS pokud je k dispozici
        if (unitData.variableSymbol && unit.variableSymbol !== unitData.variableSymbol) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { variableSymbol: unitData.variableSymbol }
          })
        }
      }

      // B. Vlastník (zjednodušená logika - pokud je jméno, zkusíme najít nebo vytvořit)
      if (unitData.owner) {
        // Zde by mohla být složitější logika pro parsing jména, zatím bereme celý string
        const ownerName = unitData.owner
        let owner = await prisma.owner.findFirst({
          where: { 
            OR: [
              { email: unitData.email || undefined },
              { lastName: { contains: ownerName } } // Velmi hrubý odhad
            ]
          }
        })

        // Pokud nemáme vlastníka a máme data, vytvoříme ho (volitelné, záleží na preferencích)
        // Pro tento import zatím jen logujeme, nebo bychom mohli aktualizovat Ownership
      }

      // C. Vytvoření BillingResult (Hlavička vyúčtování pro jednotku)
      const totalCost = unitData.costs.reduce((sum, c) => sum + c.userCost, 0)
      const totalAdvance = unitData.costs.reduce((sum, c) => sum + c.advance, 0)
      
      const billingResult = await prisma.billingResult.create({
        data: {
          billingPeriodId: billingPeriod.id,
          unitId: unit.id,
          totalCost: totalCost,
          totalAdvancePrescribed: totalAdvance,
          totalAdvancePaid: totalAdvance, // Předpokládáme, že co je v Excelu jako záloha, je zaplaceno
          result: unitData.balance,
          repairFund: 0, // Pokud by bylo v JSONu, přidat
          
          // Uložení měsíčních dat
          monthlyPrescriptions: unitData.monthly.advances,
          monthlyPayments: unitData.monthly.payments,
          
          // Uložení všech měřidel k výsledku
          meterReadingsJson: unitData.meters.length > 0 ? JSON.stringify(unitData.meters) : Prisma.JsonNull,

          // Uložení metadat pro tisk
          summaryJson: JSON.stringify({
            ownerName: unitData.owner,
            email: unitData.email,
            variableSymbol: unitData.variableSymbol,
            bankAccount: unitData.bankAccount
          })
        }
      })

      // D. Vytvoření BillingServiceCost (Položky vyúčtování)
      for (const cost of unitData.costs) {
        const serviceId = serviceMap.get(normalizeServiceName(cost.serviceName))
        if (!serviceId) continue // Should not happen

        // Najít měřidla pro tuto službu
        const relevantMeters = unitData.meters.filter(m => 
          normalizeServiceName(m.service) === normalizeServiceName(cost.serviceName)
        )

        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId: serviceId,
            unitId: unit.id,
            
            buildingTotalCost: cost.total,
            unitCost: cost.userCost,
            unitAdvance: cost.advance,
            unitBalance: cost.userCost - cost.advance,
            
            // V19+ pole pro věrný tisk
            buildingUnits: cost.unitDetails?.buildingUnits,
            unitPrice: cost.unitDetails?.price,
            unitUnits: cost.unitDetails?.userUnits,
            
            // Uložení odečtů jako JSON
            meterReadings: relevantMeters.length > 0 ? JSON.stringify(relevantMeters) : null
          }
        })
      }
      
      createdResults++
    }

    return NextResponse.json({
      success: true,
      message: `Import dokončen. Zpracováno ${createdResults} jednotek.`,
      stats: {
        building: building.name,
        year: body.year,
        units: createdResults
      }
    })

  } catch (error) {
    console.error('[Push Import Error]', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba při importu' 
    }, { status: 500 })
  }
}
