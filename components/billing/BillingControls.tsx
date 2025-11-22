"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  buildingId: string;
  year: number;
  status?: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'SENT';
  billingPeriodId?: string;
}

export function BillingControls({ buildingId, year, status = 'DRAFT', billingPeriodId }: Props) {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleCalculate = async () => {
    if (!confirm(`Opravdu chcete spustit nový výpočet pro rok ${year}? Stávající výsledky budou přepsány.`)) return;
    
    setIsCalculating(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });

      if (!response.ok) throw new Error('Chyba při výpočtu');
      router.refresh(); 
    } catch (error) {
      console.error("Chyba výpočtu:", error);
      alert("Výpočet selhal.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Opravdu chcete SMAZAT celé vyúčtování pro rok ${year}? Tato akce je nevratná.`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/period?year=${year}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Chyba při mazání');
      router.refresh();
    } catch (error) {
      console.error("Chyba mazání:", error);
      alert("Mazání selhalo.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLock = async () => {
    const newStatus = status === 'APPROVED' ? 'DRAFT' : 'APPROVED';
    const action = status === 'APPROVED' ? 'odemknout' : 'uzamknout';
    
    if (!confirm(`Opravdu chcete ${action} vyúčtování pro rok ${year}?`)) return;

    setIsLocking(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/period?year=${year}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Chyba při změně statusu');
      router.refresh();
    } catch (error) {
      console.error("Chyba statusu:", error);
      alert("Změna statusu selhala.");
    } finally {
      setIsLocking(false);
    }
  };

  const handleSendAll = async () => {
    if (!billingPeriodId) return;
    if (!confirm(`Opravdu chcete odeslat notifikace (Email + SMS) všem vlastníkům v období ${year}?`)) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing-periods/${billingPeriodId}/send-all-notifications`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || 'Nepodařilo se odeslat notifikace');
      }

      alert(`Odesláno: Email: ${data.details.sentEmail}, SMS: ${data.details.sentSms}, Chyby: ${data.details.failed}`);
      router.refresh();
    } catch (error) {
      console.error("Chyba odesílání:", error);
      alert(error instanceof Error ? error.message : 'Nepodařilo se odeslat notifikace');
    } finally {
      setIsSending(false);
    }
  };

  const isLocked = status === 'APPROVED' || status === 'SENT';

  return (
    <div className="flex flex-wrap gap-3 mb-6 items-center">
      {/* Tlačítko Výpočet */}
      <button 
        onClick={handleCalculate} 
        disabled={isCalculating || isLocked} 
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-11 px-8 text-white ${
          isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
        }`}
      >
        {isCalculating ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
            Počítám...
          </>
        ) : (
          <>
            <span className="mr-2">⚡</span>
            Spustit Výpočet {year}
          </>
        )}
      </button>

      {/* Tlačítko Smazat */}
      <button 
        onClick={handleDelete} 
        disabled={isDeleting || isLocked} 
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-11 px-4 border ${
          isLocked ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-red-200 text-red-600 hover:bg-red-50'
        }`}
      >
        {isDeleting ? 'Mazání...' : '🗑️ Smazat vyúčtování'}
      </button>

      {/* Tlačítko Zámek */}
      <button 
        onClick={handleLock} 
        disabled={isLocking} 
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-11 px-4 border ${
          isLocked 
            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {isLocking ? 'Ukládám...' : (
          <>
            <span className="mr-2">{isLocked ? '🔒' : '🔓'}</span>
            {isLocked ? 'Vyúčtování uzamčeno' : 'Uzamknout vyúčtování'}
          </>
        )}
      </button>

      {/* Tlačítko Odeslat */}
      {billingPeriodId && (
        <button 
          onClick={handleSendAll} 
          disabled={isSending} 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-11 px-4 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
        >
          {isSending ? 'Odesílám...' : '🚀 Odeslat vše (Email + SMS)'}
        </button>
      )}
    </div>
  );
}
