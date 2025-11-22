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

  // 1b. Načtení statusu období (pro zámek)
  const billingPeriod = await prisma.billingPeriod.findUnique({
    where: { buildingId_year: { buildingId: id, year: currentYear } }
  });

  // 2. Načtení výsledků vyúčtování pro daný rok
  // Hledáme BillingResult, které patří k jednotkám v této budově a mají správný rok
  const billingResults = await prisma.billingResult.findMany({
    where: {
      billingPeriod: {
        year: currentYear
      },
      unit: {
        buildingId: id
      }
    },
    include: {
      unit: {
        include: {
          ownerships: {
            include: {
              owner: true
            },
            // Můžeme zkusit seřadit podle platnosti, abychom vzali nejnovějšího
            orderBy: {
              validFrom: 'desc'
            },
            take: 1
          }
        }
      }
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
      totalAdvance: acc.totalAdvance + curr.totalAdvancePrescribed,
      balance: acc.balance + curr.result,
    }),
    { totalCost: 0, totalAdvance: 0, balance: 0 }
  );

  // 4. Příprava dat pro tabulku (Flat structure)
  const tableData = billingResults.map(r => {
    const owner = r.unit.ownerships[0]?.owner;
    const ownerName = owner ? `${owner.lastName} ${owner.firstName}` : "Neznámý";

    return {
      id: r.id,
      unitNumber: r.unit.unitNumber,
      ownerName: ownerName,
      totalCost: r.totalCost,
      totalAdvance: r.totalAdvancePrescribed,
      balance: r.result
    };
  });

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      {/* Hlavička stránky */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="mb-2">
            <a href={`/buildings/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Zpět na detail budovy
            </a>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vyúčtování služeb</h1>
          <p className="text-muted-foreground mt-1">
            {building.name} • Rok {currentYear}
          </p>
        </div>
        <div>
          <a 
            href={`/buildings/${id}?tab=results`} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
          >
            Přehled výsledků
          </a>
        </div>
      </div>

      {/* Ovládací prvky */}
      <BillingControls 
        buildingId={id} 
        year={currentYear} 
        status={billingPeriod?.status || 'DRAFT'} 
        billingPeriodId={billingPeriod?.id}
      />

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
