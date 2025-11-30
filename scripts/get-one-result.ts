
import { prisma } from '../lib/prisma';

async function main() {
  const result = await prisma.billingResult.findFirst();
  if (result) {
    console.log('BillingResult ID:', result.id);
    console.log('Building ID:', (await prisma.billingPeriod.findUnique({where: {id: result.billingPeriodId}}))?.buildingId);
  } else {
    console.log('No billing result found');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
