import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Celkové náklady domu</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
          <p className="text-xs text-muted-foreground">Suma všech faktur a nákladů</p>
        </CardContent>
      </Card>

      {/* Karta 2: Zálohy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vybrané zálohy</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalAdvance)}</div>
          <p className="text-xs text-muted-foreground">Suma předpisů od vlastníků</p>
        </CardContent>
      </Card>

      {/* Karta 3: Bilance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bilance domu</CardTitle>
          {balance >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">
            {balance >= 0 ? "Celkový přeplatek k vrácení" : "Celkový nedoplatek k vybrání"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
