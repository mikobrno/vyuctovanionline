import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Začínám seedování databáze...')

  // Vymazat existující data
  await prisma.billingServiceCost.deleteMany()
  await prisma.billingResult.deleteMany()
  await prisma.billingPeriod.deleteMany()
  await prisma.personMonth.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.advancePaymentRecord.deleteMany()
  await prisma.advancePayment.deleteMany()
  await prisma.meterReading.deleteMany()
  await prisma.meter.deleteMany()
  await prisma.cost.deleteMany()
  await prisma.service.deleteMany()
  await prisma.ownership.deleteMany()
  await prisma.owner.deleteMany()
  await prisma.unit.deleteMany()
  await prisma.building.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Databáze vyčištěna')

  // Vytvořit uživatele
  const adminPassword = await bcrypt.hash('admin123', 10)
  const managerPassword = await bcrypt.hash('spravce123', 10)

  await prisma.user.create({
    data: {
      email: 'admin@vyuctovani.cz',
      password: adminPassword,
      name: 'Administrátor',
      role: 'ADMIN',
    },
  })

  await prisma.user.create({
    data: {
      email: 'spravce@vyuctovani.cz',
      password: managerPassword,
      name: 'Jan Správce',
      role: 'MANAGER',
    },
  })

  console.log('✅ Uživatelé vytvořeni')

  // Vytvořit bytový dům
  const building = await prisma.building.create({
    data: {
      name: 'Společenství vlastníků pro dům Neptun',
      address: 'Neptunova 123',
      city: 'Praha',
      zip: '11000',
      ico: '12345678',
      bankAccount: '1234567890/0100',
    },
  })

  console.log('✅ Bytový dům vytvořen')

  // Vytvořit služby
  const services = await Promise.all([
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Fond oprav',
        code: 'FO',
        methodology: 'podíl',
        order: 1,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Fond společenství',
        code: 'FS',
        methodology: 'vlastnický podíl',
        order: 2,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Správa',
        code: 'SPRAVA',
        methodology: 'na byt',
        order: 3,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Vodné a stočné',
        code: 'VODNE',
        methodology: 'odečet SV',
        measurementUnit: 'm³',
        order: 4,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Teplo',
        code: 'TEPLO',
        methodology: 'rovným dílem 1/22',
        order: 5,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Ohřev TUV',
        code: 'TUV',
        methodology: 'odečet TUV',
        measurementUnit: 'm³',
        order: 6,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Elektřina',
        code: 'ELEKTRO',
        methodology: 'vlastnický podíl',
        order: 7,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Úklid venkovní',
        code: 'UKLID_VENK',
        methodology: 'vlastnický podíl',
        order: 8,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Pojištění domu',
        code: 'POJISTENI',
        methodology: 'vlastnický podíl',
        order: 9,
      },
    }),
    prisma.service.create({
      data: {
        buildingId: building.id,
        name: 'Úklid vnitřní',
        code: 'UKLID_VNITR',
        methodology: 'vlastnický podíl',
        order: 10,
      },
    }),
  ])

  console.log('✅ Služby vytvořeny')

  // Vytvořit vlastníky
  const owners = await Promise.all([
    prisma.owner.create({
      data: {
        firstName: 'Jan',
        lastName: 'Novák',
        email: 'jan.novak@email.cz',
        phone: '+420 601 234 567',
        address: 'Neptunova 123/1, Praha',
        salutation: 'Vážený pane Nováku',
      },
    }),
    prisma.owner.create({
      data: {
        firstName: 'Marie',
        lastName: 'Svobodová',
        email: 'marie.svobodova@email.cz',
        phone: '+420 602 345 678',
        address: 'Neptunova 123/2, Praha',
        salutation: 'Vážená paní Svobodová',
      },
    }),
    prisma.owner.create({
      data: {
        firstName: 'Petr',
        lastName: 'Dvořák',
        email: 'petr.dvorak@email.cz',
        phone: '+420 603 456 789',
        address: 'Neptunova 123/3, Praha',
        salutation: 'Vážený pane Dvořáku',
      },
    }),
  ])

  console.log('✅ Vlastníci vytvořeni')

  // Vytvořit jednotky
  const units = await Promise.all([
    prisma.unit.create({
      data: {
        buildingId: building.id,
        unitNumber: '318/01',
        type: 'APARTMENT',
        shareNumerator: 764,
        shareDenominator: 14238,
        totalArea: 65.5,
        floorArea: 55.0,
        residents: 2,
        variableSymbol: '31801',
      },
    }),
    prisma.unit.create({
      data: {
        buildingId: building.id,
        unitNumber: '318/02',
        type: 'APARTMENT',
        shareNumerator: 820,
        shareDenominator: 14238,
        totalArea: 72.3,
        floorArea: 60.0,
        residents: 3,
        variableSymbol: '31802',
      },
    }),
    prisma.unit.create({
      data: {
        buildingId: building.id,
        unitNumber: '318/03',
        type: 'APARTMENT',
        shareNumerator: 650,
        shareDenominator: 14238,
        totalArea: 58.2,
        floorArea: 48.0,
        residents: 1,
        variableSymbol: '31803',
      },
    }),
  ])

  console.log('✅ Jednotky vytvořeny')

  // Přiřadit vlastníky k jednotkám
  await Promise.all([
    prisma.ownership.create({
      data: {
        unitId: units[0].id,
        ownerId: owners[0].id,
        validFrom: new Date('2024-01-01'),
        sharePercent: 100,
      },
    }),
    prisma.ownership.create({
      data: {
        unitId: units[1].id,
        ownerId: owners[1].id,
        validFrom: new Date('2024-01-01'),
        sharePercent: 100,
      },
    }),
    prisma.ownership.create({
      data: {
        unitId: units[2].id,
        ownerId: owners[2].id,
        validFrom: new Date('2024-01-01'),
        sharePercent: 100,
      },
    }),
  ])

  console.log('✅ Vlastnictví přiřazeno')

  // Vytvořit měřidla pro každou jednotku
  for (const unit of units) {
    await Promise.all([
      prisma.meter.create({
        data: {
          unitId: unit.id,
          serialNumber: `76884987-TUV`,
          type: 'HOT_WATER',
          initialReading: 0,
          isActive: true,
        },
      }),
      prisma.meter.create({
        data: {
          unitId: unit.id,
          serialNumber: `76888144-SV`,
          type: 'COLD_WATER',
          initialReading: 0,
          isActive: true,
        },
      }),
      prisma.meter.create({
        data: {
          unitId: unit.id,
          serialNumber: `TEPLO-${unit.unitNumber}`,
          type: 'HEATING',
          initialReading: 0,
          isActive: true,
        },
      }),
      prisma.meter.create({
        data: {
          unitId: unit.id,
          serialNumber: `ELEKTRO-${unit.unitNumber}`,
          type: 'ELECTRICITY',
          initialReading: 0,
          isActive: true,
        },
      }),
    ])
  }

  console.log('✅ Měřidla vytvořena')

  // Vytvořit náklady na dům pro rok 2024
  const year = 2024
  await Promise.all([
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[0].id, // Teplo
        amount: 450000,
        description: 'Roční náklady na vytápění',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[1].id, // TUV
        amount: 85000,
        description: 'Teplá užitková voda',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[2].id, // SV
        amount: 45000,
        description: 'Studená voda',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[3].id, // Vodné
        amount: 92000,
        description: 'Vodné a stočné',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[4].id, // Správa
        amount: 180000,
        description: 'Správa domu - roční náklady',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
    prisma.cost.create({
      data: {
        buildingId: building.id,
        serviceId: services[5].id, // Fond oprav
        amount: 240000,
        description: 'Fond oprav',
        invoiceDate: new Date('2024-12-31'),
        period: year,
      },
    }),
  ])

  console.log('✅ Náklady vytvořeny')

  console.log('🎉 Seedování dokončeno!')
  console.log('')
  console.log('📝 Přihlašovací údaje:')
  console.log('   Admin: admin@vyuctovani.cz / admin123')
  console.log('   Správce: spravce@vyuctovani.cz / spravce123')
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
