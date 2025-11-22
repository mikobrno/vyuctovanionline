"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calculator, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';

interface Props {
  buildingId: string;
  year: number;
}

export function BillingControls({ buildingId, year }: Props) {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      // Volání API endpointu pro výpočet
      const response = await fetch(`/api/buildings/${buildingId}/billing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });

      if (!response.ok) {
        throw new Error('Chyba při výpočtu');
      }
      
      // Obnoví data na stránce (Next.js Server Components refresh)
      router.refresh(); 
    } catch (error) {
      console.error("Chyba výpočtu:", error);
      alert("Výpočet selhal. Zkontrolujte konzoli.");
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="flex gap-3 mb-6">
      <Button onClick={handleCalculate} disabled={isCalculating} size="lg">
        {isCalculating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Počítám vyúčtování...
          </>
        ) : (
          <>
            <Calculator className="mr-2 h-4 w-4" />
            Spustit Výpočet {year}
          </>
        )}
      </Button>
    </div>
  );
}
