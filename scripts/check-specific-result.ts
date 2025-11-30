
import { prisma } from '../lib/prisma';

async function main() {
  const id = 'cmilpv21k0003jkog4q67vwxw';
  const result = await prisma.billingResult.findUnique({
    where: { id }
  });
  if (result) {
    console.log('Monthly Prescriptions:', result.monthlyPrescriptions);
    console.log('Monthly Payments:', result.monthlyPayments);
  } else {
    console.log('Not found');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
