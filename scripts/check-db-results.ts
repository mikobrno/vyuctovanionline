
import { prisma } from '../lib/prisma';

async function main() {
  const buildingId = '6bc262a1-14ed-4f79-a8fb-d4623dbf3694';
  const year = 2024;

  const results = await prisma.billingResult.findMany({
    where: {
      billingPeriod: {
        buildingId,
        year
      },
      unit: {
        unitNumber: '318/01'
      }
    },
    include: {
      unit: true
    }
  });

  console.log('Billing Results in DB:', JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main();
