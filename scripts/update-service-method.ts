import { PrismaClient, CalculationMethod } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [serviceId, method] = process.argv.slice(2)
  if (!serviceId || !method) {
    console.error('Usage: npx tsx scripts/update-service-method.ts <serviceId> <method>')
    process.exit(1)
  }

  if (!Object.prototype.hasOwnProperty.call(CalculationMethod, method)) {
    console.error(`Unknown method ${method}`)
    process.exit(1)
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { methodology: method as CalculationMethod }
  })

  console.log(`Updated ${serviceId} -> ${method}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
