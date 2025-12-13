// One-off maintenance script: rename Mikšíčkova building in DB.
// Usage: node scripts/rename-building-miksickova.js

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const res = await prisma.building.updateMany({
      where: { bankAccount: '2001002103/2010' },
      data: { name: 'Společenství vlastníků Mikšíčkova 20' },
    });

    console.log('Updated buildings:', res);

    const check = await prisma.building.findMany({
      where: { bankAccount: '2001002103/2010' },
      select: { id: true, name: true, address: true, bankAccount: true },
    });

    console.log('Current buildings:', JSON.stringify(check, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
