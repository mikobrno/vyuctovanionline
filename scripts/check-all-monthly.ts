import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const results = await prisma.billingResult.findMany({
    take: 5,
    select: {
      id: true,
      monthlyPayments: true,
      monthlyPrescriptions: true,
      unit: { select: { unitNumber: true } }
    }
  });

  for (const r of results) {
    console.log('='.repeat(50));
    console.log('Unit:', r.unit.unitNumber);
    console.log('ID:', r.id);
    console.log('monthlyPayments:', r.monthlyPayments);
    console.log('monthlyPrescriptions:', r.monthlyPrescriptions);
    console.log('Has payments data:', Array.isArray(r.monthlyPayments) && (r.monthlyPayments as number[]).some(v => v > 0));
    console.log('Has prescriptions data:', Array.isArray(r.monthlyPrescriptions) && (r.monthlyPrescriptions as number[]).some(v => v > 0));
  }

  await prisma.$disconnect();
}

main();
