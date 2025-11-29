import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Najdi službu Studená voda
  const service = await prisma.service.findFirst({
    where: { name: { contains: 'Studen' } },
    select: { 
      id: true, 
      name: true, 
      costWithMeter: true, 
      costWithoutMeter: true, 
      useDualCost: true,
      guidanceNumber: true,
      buildingId: true
    }
  })
  
  console.log('Service found:', service)

  if (!service) return

  // Načti byt 09 s osobo-měsíci po měsících
  const unit09 = await prisma.unit.findFirst({
    where: { 
      buildingId: service.buildingId,
      unitNumber: { contains: '09' }
    },
    include: {
      personMonths: true
    }
  })

  if (unit09) {
    console.log('\n=== BYT 09 OSOBO-MĚSÍCE ===')
    console.log('PersonMonths records:', unit09.personMonths)
    const total = unit09.personMonths.reduce((s, pm) => s + pm.personCount, 0)
    console.log('Součet personCount:', total)
    
    // Počet osob (pokud je to konstantní)
    if (unit09.personMonths.length > 0) {
      const avgPersons = total / unit09.personMonths.length
      console.log('Průměr osob/měsíc:', avgPersons)
      console.log('Celoroční osobo-měsíce (avg*12):', avgPersons * 12)
    }
  }

  // Všechny jednotky bez vodoměru - celkem osobo-měsíce
  const units = await prisma.unit.findMany({
    where: { buildingId: service.buildingId },
    include: {
      meters: { where: { type: 'COLD_WATER', isActive: true } },
      personMonths: true
    }
  })

  let totalPMWithoutMeter = 0
  let unit09PM = 0
  
  for (const u of units) {
    const hasMeter = u.meters.length > 0
    const pm = u.personMonths.reduce((s, x) => s + x.personCount, 0)
    if (!hasMeter) totalPMWithoutMeter += pm
    if (u.unitNumber.includes('09')) unit09PM = pm
  }

  console.log('\n=== FINÁLNÍ VÝPOČET ===')
  console.log('Celkem PM bez vodoměru:', totalPMWithoutMeter)
  console.log('Byt 09 PM:', unit09PM)
  
  const costB = service.costWithoutMeter || 0
  const gn = service.guidanceNumber || 35
  
  // Výpočet dle vzorce: (PM/12*35) / (totalPM/12*35) * costB
  // = PM / totalPM * costB (směrné číslo se zkrátí)
  const unitCost = (unit09PM / totalPMWithoutMeter) * costB
  console.log(`Náklad: (${unit09PM}/${totalPMWithoutMeter}) * ${costB} = ${unitCost.toFixed(2)} Kč`)
  console.log('OČEKÁVÁNO: 5745.69 Kč')
  
  // Zpětný výpočet - jaké PM by muselo být pro 5745.69?
  const expectedCost = 5745.69
  const neededPM = (expectedCost / costB) * totalPMWithoutMeter
  console.log(`\nPro 5745.69 Kč by bylo potřeba PM: ${neededPM.toFixed(2)}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
