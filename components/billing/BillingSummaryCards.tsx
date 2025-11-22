import React from 'react';

interface Props {
  totalCost: number;
  totalAdvance: number;
  balance: number;
}

export function BillingSummaryCards({ totalCost, totalAdvance, balance }: Props) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-8">
      {/* Karta 1: Náklady */}
      <div className="rounded-xl border bg-card text-card-foreground shadow bg-white p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Celkové náklady domu</h3>
          <span className="h-4 w-4 text-muted-foreground">💰</span>
        </div>
        <div className="pt-4">
          <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
          <p className="text-xs text-muted-foreground">Suma všech faktur a nákladů</p>
        </div>
      </div>

      {/* Karta 2: Zálohy */}
      <div className="rounded-xl border bg-card text-card-foreground shadow bg-white p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Vybrané zálohy</h3>
          <span className="h-4 w-4 text-muted-foreground">🐷</span>
        </div>
        <div className="pt-4">
          <div className="text-2xl font-bold">{formatCurrency(totalAdvance)}</div>
          <p className="text-xs text-muted-foreground">Suma předpisů od vlastníků</p>
        </div>
      </div>

      {/* Karta 3: Bilance */}
      <div className="rounded-xl border bg-card text-card-foreground shadow bg-white p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Bilance domu</h3>
          {balance >= 0 ? (
            <span className="h-4 w-4 text-green-600">📈</span>
          ) : (
            <span className="h-4 w-4 text-red-600">📉</span>
          )}
        </div>
        <div className="pt-4">
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">
            {balance >= 0 ? "Celkový přeplatek k vrácení" : "Celkový nedoplatek k vybrání"}
          </p>
        </div>
      </div>
    </div>
  );
}
