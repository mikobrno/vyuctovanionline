"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface BillingResultItem {
  id: string;
  unitNumber: string;
  ownerName: string | null;
  totalCost: number;
  totalAdvance: number;
  balance: number;
}

interface Props {
  buildingId: string;
  results: BillingResultItem[];
}

export function BillingUnitTable({ buildingId, results }: Props) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

  const handleDownloadPdf = (resultId: string) => {
    // Otevře API endpoint pro generování PDF v novém okně
    window.open(`/api/buildings/${buildingId}/billing/${resultId}/pdf`, '_blank');
  };

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Jednotka</TableHead>
            <TableHead>Vlastník</TableHead>
            <TableHead className="text-right">Náklad</TableHead>
            <TableHead className="text-right">Zálohy</TableHead>
            <TableHead className="text-right">Výsledek</TableHead>
            <TableHead className="text-right">Akce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.unitNumber}</TableCell>
              <TableCell>{row.ownerName || "Neznámý"}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.totalAdvance)}</TableCell>
              <TableCell className="text-right">
                <Badge 
                  variant={row.balance >= 0 ? "default" : "destructive"} 
                  className={row.balance >= 0 ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                >
                  {row.balance >= 0 ? "Přeplatek" : "Nedoplatek"} {formatCurrency(Math.abs(row.balance))}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDownloadPdf(row.id)}
                  title="Stáhnout PDF"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {results.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Zatím nebylo provedeno žádné vyúčtování. Spusťte výpočet tlačítkem výše.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
