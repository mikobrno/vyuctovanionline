import { prisma } from '../lib/prisma'

async function main() {
  const result = await prisma.billingResult.findFirst({
    where: { 
      unit: { 
        unitNumber: { contains: '151301' } 
      } 
    },
    select: { 
      id: true, 
      monthlyPayments: true, 
      monthlyPrescriptions: true,
      unit: { select: { unitNumber: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log('=== BillingResult pro 151301 ===')
  console.log('Unit:', result?.unit.unitNumber)
  console.log('monthlyPayments:', result?.monthlyPayments)
  console.log('monthlyPrescriptions:', result?.monthlyPrescriptions)
  
  // Typ kontrola
  if (result?.monthlyPayments) {
    console.log('\nTyp monthlyPayments:', typeof result.monthlyPayments)
    console.log('Je pole?', Array.isArray(result.monthlyPayments))
  }
  
  if (result?.monthlyPrescriptions) {
    console.log('\nTyp monthlyPrescriptions:', typeof result.monthlyPrescriptions)
    console.log('Je pole?', Array.isArray(result.monthlyPrescriptions))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
