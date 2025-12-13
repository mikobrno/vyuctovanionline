// Simulate the exact logic from page.tsx for paymentsData
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const billingResult = await prisma.billingResult.findUnique({
    where: { id: 'cmj1hjvof0001ey8kkftmoqa7' },
    select: {
      monthlyPayments: true,
      monthlyPrescriptions: true,
    }
  });

  if (!billingResult) {
    console.log('Result not found');
    return;
  }

  console.log('=== Simulating page.tsx logic ===');
  console.log('billingResult.monthlyPayments:', billingResult.monthlyPayments);
  console.log('Type:', typeof billingResult.monthlyPayments);
  console.log('Is Array:', Array.isArray(billingResult.monthlyPayments));
  
  console.log('\nbillingResult.monthlyPrescriptions:', billingResult.monthlyPrescriptions);
  console.log('Type:', typeof billingResult.monthlyPrescriptions);
  console.log('Is Array:', Array.isArray(billingResult.monthlyPrescriptions));

  // Exact logic from page.tsx lines 218-230
  let prescriptions = (billingResult.monthlyPrescriptions as number[]) || [];
  console.log('\n1. prescriptions after cast:', prescriptions);

  // Exact logic from page.tsx lines 262-270
  let paid = (billingResult.monthlyPayments as number[]) || [];
  console.log('2. paid after cast:', paid);

  // Ensure length 12
  if (prescriptions.length < 12) {
    prescriptions = [...prescriptions, ...Array(12 - prescriptions.length).fill(0)];
  }
  if (paid.length < 12) {
    paid = [...paid, ...Array(12 - paid.length).fill(0)];
  }

  console.log('\n3. prescriptions after length check:', prescriptions);
  console.log('4. paid after length check:', paid);

  // Create paymentsData
  const paymentsData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    prescribed: prescriptions[i] || 0,
    paid: paid[i] || 0
  }));

  console.log('\n=== Final paymentsData ===');
  console.log(JSON.stringify(paymentsData, null, 2));

  // Check if any values are > 0
  const hasData = paymentsData.some(p => p.paid > 0 || p.prescribed > 0);
  console.log('\nHas any data:', hasData);

  await prisma.$disconnect();
}

main().catch(console.error);
