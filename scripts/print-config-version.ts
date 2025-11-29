import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const versionId = process.argv[2]
  if (!versionId) {
    console.error('Usage: npx tsx scripts/print-config-version.ts <versionId>')
    process.exit(1)
  }

  const version = await prisma.calculationConfig.findUnique({ where: { id: versionId } })
  if (!version) {
    console.error('Version not found')
    process.exit(1)
  }

  console.log(JSON.stringify(version.config, null, 2))
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
