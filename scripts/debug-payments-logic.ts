import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const resultId = 'cmj1hjvof0001ey8kkftmoqa7';
  
  const billingResult = await prisma.billingResult.findUnique({
    where: { id: resultId },
    select: {
      id: true,
      monthlyPayments: true,
      monthlyPrescriptions: true,
      unit: { select: { unitNumber: true } },
      billingPeriod: { select: { year: true } }
    }
  });

  if (!billingResult) {
    console.log('Result not found');
    return;
  }

  console.log('='.repeat(60));
  console.log('Unit:', billingResult.unit.unitNumber);
  console.log('Year:', billingResult.billingPeriod.year);
  console.log('='.repeat(60));
  
  console.log('\nRAW DATA:');
  console.log('monthlyPayments:', billingResult.monthlyPayments);
  console.log('monthlyPayments type:', typeof billingResult.monthlyPayments);
  console.log('monthlyPayments isArray:', Array.isArray(billingResult.monthlyPayments));
  console.log('');
  console.log('monthlyPrescriptions:', billingResult.monthlyPrescriptions);
  console.log('monthlyPrescriptions type:', typeof billingResult.monthlyPrescriptions);
  console.log('monthlyPrescriptions isArray:', Array.isArray(billingResult.monthlyPrescriptions));

  // Simulate page.tsx logic - exact copy
  let prescriptions = (billingResult.monthlyPrescriptions as number[]) || [];
  
  console.log('\nPROCESSING PRESCRIPTIONS:');
  console.log('Initial prescriptions:', prescriptions);
  console.log('prescriptions.length:', prescriptions.length);
  console.log('prescriptions.every(v => v === 0):', prescriptions.every(v => v === 0));
  
  // Fallback if prescriptions empty
  if (prescriptions.length === 0 || prescriptions.every(v => v === 0)) {
    console.log('>>> Fallback triggered for prescriptions!');
    if (billingResult.monthlyPayments && Array.isArray(billingResult.monthlyPayments)) {
      const payments = billingResult.monthlyPayments as number[];
      if (payments.some(v => v > 0)) {
        prescriptions = payments;
        console.log('>>> Using monthlyPayments as prescriptions');
      }
    }
  }
  
  // Ensure length 12
  if (prescriptions.length < 12) {
    prescriptions = [...prescriptions, ...Array(12 - prescriptions.length).fill(0)];
  }
  
  console.log('Final prescriptions:', prescriptions);

  let paid = (billingResult.monthlyPayments as number[]) || [];
  
  console.log('\nPROCESSING PAID:');
  console.log('Initial paid:', paid);
  console.log('paid.length:', paid.length);
  console.log('paid.every(v => v === 0):', paid.every(v => v === 0));
  
  // Fallback if paid empty
  if (paid.length === 0 || paid.every(v => v === 0)) {
    console.log('>>> Fallback triggered for paid!');
    if (billingResult.monthlyPrescriptions && Array.isArray(billingResult.monthlyPrescriptions)) {
      const presc = billingResult.monthlyPrescriptions as number[];
      if (presc.some(v => v > 0)) {
        paid = presc;
        console.log('>>> Using monthlyPrescriptions as paid');
      }
    }
  }
  
  // Ensure length 12
  if (paid.length < 12) {
    paid = [...paid, ...Array(12 - paid.length).fill(0)];
  }
  
  console.log('Final paid:', paid);

  const paymentsData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    prescribed: prescriptions[i] || 0,
    paid: paid[i] || 0
  }));

  console.log('\n=== FINAL PAYMENTS DATA ===');
  console.log(JSON.stringify(paymentsData, null, 2));
  console.log('\npaymentsData.length:', paymentsData.length);
  console.log('Has any data:', paymentsData.some(p => p.paid > 0 || p.prescribed > 0));

  await prisma.$disconnect();
}

main().catch(console.error);
