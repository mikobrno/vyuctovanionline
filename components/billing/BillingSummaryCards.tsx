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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-gray-500 dark:text-slate-400">Celkové náklady domu</h3>
          <span className="h-4 w-4 text-gray-500 dark:text-slate-400">💰</span>
        </div>
        <div className="pt-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</div>
          <p className="text-xs text-gray-500 dark:text-slate-500">Suma všech faktur a nákladů</p>
        </div>
      </div>

      {/* Karta 2: Zálohy */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-gray-500 dark:text-slate-400">Vybrané zálohy</h3>
          <span className="h-4 w-4 text-gray-500 dark:text-slate-400">🐷</span>
        </div>
        <div className="pt-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAdvance)}</div>
          <p className="text-xs text-gray-500 dark:text-slate-500">Suma předpisů od vlastníků</p>
        </div>
      </div>

      {/* Karta 3: Bilance */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium text-gray-500 dark:text-slate-400">Bilance domu</h3>
          {balance >= 0 ? (
            <span className="h-4 w-4 text-green-600 dark:text-green-400">📈</span>
          ) : (
            <span className="h-4 w-4 text-red-600 dark:text-red-400">📉</span>
          )}
        </div>
        <div className="pt-4">
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-500">
            {balance >= 0 ? "Celkový přeplatek k vrácení" : "Celkový nedoplatek k vybrání"}
          </p>
        </div>
      </div>
    </div>
  );
}
