import { prisma } from '../lib/prisma'

async function main() {
  const services = await prisma.service.findMany({
    where: { buildingId: '7f913bdc-d937-419c-b783-d7165ecb6492' },
    select: { id: true, name: true }
  })
  
  console.log('Služby v DB pro Zborovská:')
  services.forEach(s => console.log('-', s.name))
  
  await prisma.$disconnect()
}

main()
