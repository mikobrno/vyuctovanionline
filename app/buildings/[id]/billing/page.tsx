import React from 'react';
import { PrismaClient } from '@prisma/client';
import { BillingSummaryCards } from '@/components/billing/BillingSummaryCards';
import { BillingUnitTable } from '@/components/billing/BillingUnitTable';
import { BillingControls } from '@/components/billing/BillingControls';
import { notFound } from 'next/navigation';

const prisma = new PrismaClient();

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function BillingDashboardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { year } = await searchParams;
  
  // Defaultně aktuální rok, pokud není v URL
  const currentYear = year ? parseInt(year) : new Date().getFullYear();

  // 1. Načtení budovy
  const building = await prisma.building.findUnique({
    where: { id },
  });

  if (!building) return notFound();

  // 2. Načtení výsledků vyúčtování pro daný rok
  // Hledáme BillingResult, které patří k jednotkám v této budově a mají správný rok
  const billingResults = await prisma.billingResult.findMany({
    where: {
      year: currentYear,
      unit: {
        buildingId: id
      }
    },
    include: {
      unit: true // Potřebujeme číslo jednotky a jméno vlastníka
    },
    orderBy: {
      unit: {
        unitNumber: 'asc' // Řazení podle čísla bytu
      }
    }
  });

  // 3. Agregace dat pro karty (Sumy)
  const summary = billingResults.reduce(
    (acc, curr) => ({
      totalCost: acc.totalCost + curr.totalCost,
      totalAdvance: acc.totalAdvance + curr.totalAdvance,
      balance: acc.balance + curr.balance,
    }),
    { totalCost: 0, totalAdvance: 0, balance: 0 }
  );

  // 4. Příprava dat pro tabulku (Flat structure)
  const tableData = billingResults.map(r => ({
    id: r.id,
    unitNumber: r.unit.unitNumber,
    ownerName: r.unit.ownerName,
    totalCost: r.totalCost,
    totalAdvance: r.totalAdvance,
    balance: r.balance
  }));

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      {/* Hlavička stránky */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vyúčtování služeb</h1>
          <p className="text-muted-foreground mt-1">
            {building.name} • Rok {currentYear}
          </p>
        </div>
      </div>

      {/* Ovládací prvky */}
      <BillingControls buildingId={id} year={currentYear} />

      {/* Karty s přehledem */}
      <BillingSummaryCards 
        totalCost={summary.totalCost}
        totalAdvance={summary.totalAdvance}
        balance={summary.balance}
      />

      {/* Tabulka jednotek */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Detailní přehled jednotek</h2>
        <BillingUnitTable buildingId={id} results={tableData} />
      </div>
    </div>
  );
}
