// Debug endpoint to check billing result data without authentication
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const { resultId } = await params;

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
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Simulate page.tsx logic - exact copy
  let prescriptions = (billingResult.monthlyPrescriptions as number[]) || [];
  
  // Fallback if prescriptions empty
  if (prescriptions.length === 0 || prescriptions.every(v => v === 0)) {
    if (billingResult.monthlyPayments && Array.isArray(billingResult.monthlyPayments)) {
      const payments = billingResult.monthlyPayments as number[];
      if (payments.some(v => v > 0)) {
        prescriptions = payments;
      }
    }
  }
  
  // Ensure length 12
  if (prescriptions.length < 12) {
    prescriptions = [...prescriptions, ...Array(12 - prescriptions.length).fill(0)];
  }

  let paid = (billingResult.monthlyPayments as number[]) || [];
  
  // Fallback if paid empty
  if (paid.length === 0 || paid.every(v => v === 0)) {
    if (billingResult.monthlyPrescriptions && Array.isArray(billingResult.monthlyPrescriptions)) {
      const presc = billingResult.monthlyPrescriptions as number[];
      if (presc.some(v => v > 0)) {
        paid = presc;
      }
    }
  }
  
  // Ensure length 12
  if (paid.length < 12) {
    paid = [...paid, ...Array(12 - paid.length).fill(0)];
  }

  const paymentsData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    prescribed: prescriptions[i] || 0,
    paid: paid[i] || 0
  }));

  return NextResponse.json({
    unitNumber: billingResult.unit.unitNumber,
    year: billingResult.billingPeriod.year,
    rawMonthlyPayments: billingResult.monthlyPayments,
    rawMonthlyPaymentsType: typeof billingResult.monthlyPayments,
    rawMonthlyPaymentsIsArray: Array.isArray(billingResult.monthlyPayments),
    rawMonthlyPrescriptions: billingResult.monthlyPrescriptions,
    rawMonthlyPrescriptionsType: typeof billingResult.monthlyPrescriptions,
    rawMonthlyPrescriptionsIsArray: Array.isArray(billingResult.monthlyPrescriptions),
    processedPrescriptions: prescriptions,
    processedPaid: paid,
    paymentsData: paymentsData,
    paymentsDataLength: paymentsData.length,
    hasData: paymentsData.some(p => p.paid > 0 || p.prescribed > 0)
  });
}
