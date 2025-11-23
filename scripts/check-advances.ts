
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdvances() {
  const advance = await prisma.advanceMonthly.findFirst({
    where: {
        amount: { gt: 0 }
    },
    include: {
      unit: true,
      service: true,
    },
  });

  if (advance) {
      console.log(`Found non-zero advance:`);
      console.log(`Unit: ${advance.unit.unitNumber}`);
      console.log(`Month: ${advance.month}`);
      console.log(`Amount: ${advance.amount}`);
      
      // Check all months for this unit
      const allForUnit = await prisma.advanceMonthly.findMany({
          where: { unitId: advance.unitId },
          orderBy: { month: 'asc' },
          include: { service: true }
      });
      console.log('All months for this unit:');
      allForUnit.forEach(a => console.log(`M${a.month} (${a.service.name}): ${a.amount}`));
  } else {
      console.log('No non-zero advances found.');
  }
}

checkAdvances()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
