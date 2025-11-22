
import { calculateBillingForBuilding } from '../lib/billingEngine';
import { prisma } from '../lib/prisma';

async function main() {
  const buildingId = '6bc262a1-14ed-4f79-a8fb-d4623dbf3694';
  const year = 2024;

  console.log('Starting debug calculation...');
  try {
    const result = await calculateBillingForBuilding(buildingId, year);
    console.log('Calculation result:', result);
  } catch (error) {
    console.error('Error during calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
