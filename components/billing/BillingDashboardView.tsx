"use client";

import { useEffect, useState } from 'react';
import { BillingControls } from './BillingControls';
import { BillingSummaryCards } from './BillingSummaryCards';
import { BillingUnitTable } from './BillingUnitTable';

export interface BillingResultItem {
  id: string;
  unitNumber: string;
  ownerName: string | null;
  totalCost: number;
  totalAdvance: number;
  balance: number;
}

interface SummaryData {
  totalCost: number;
  totalAdvance: number;
  balance: number;
}

interface BillingDashboardViewProps {
  buildingId: string;
  year: number;
  status?: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'SENT';
  billingPeriodId?: string;
  summary: SummaryData;
  results: BillingResultItem[];
}

export function BillingDashboardView({
  buildingId,
  year,
  status,
  billingPeriodId,
  summary,
  results,
}: BillingDashboardViewProps) {
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>(() => results.map((r) => r.id));
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedResultIds(results.map((r) => r.id));
  }, [results]);

  const totalCount = results.length;
  const selectedCount = selectedResultIds.length;

  const handleSelectAllChange = (checked: boolean) => {
    setSelectedResultIds(checked ? results.map((r) => r.id) : []);
  };

  const toggleResultSelection = (resultId: string) => {
    setSelectedResultIds((prev) =>
      prev.includes(resultId) ? prev.filter((id) => id !== resultId) : [...prev, resultId]
    );
  };

  const handleDeleteResult = async (resultId: string, unitLabel: string) => {
    if (!confirm(`Opravdu chcete odstranit jednotku ${unitLabel} z tohoto vyúčtování?`)) {
      return;
    }

    try {
      setDeletingResultId(resultId);
      setSelectedResultIds((prev) => prev.filter((id) => id !== resultId));

      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Smazání se nepodařilo');
      }

      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Nepodařilo se odstranit jednotku');
      setDeletingResultId(null);
    }
  };

  return (
    <div className="space-y-8">
      <BillingControls
        buildingId={buildingId}
        year={year}
        status={status}
        billingPeriodId={billingPeriodId}
        selectedResultIds={selectedResultIds}
      />

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Vybrané jednotky</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {selectedCount} / {totalCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => handleSelectAllChange(true)}
            disabled={totalCount === 0 || selectedCount === totalCount}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40"
          >
            Vybrat vše
          </button>
          <button
            type="button"
            onClick={() => handleSelectAllChange(false)}
            disabled={selectedCount === 0}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40"
          >
            Zrušit výběr
          </button>
        </div>
      </div>

      <BillingSummaryCards
        totalCost={summary.totalCost}
        totalAdvance={summary.totalAdvance}
        balance={summary.balance}
      />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight dark:text-white">Detailní přehled jednotek</h2>
        <BillingUnitTable
          buildingId={buildingId}
          results={results}
          selectedIds={selectedResultIds}
          onToggleSelection={toggleResultSelection}
          onSelectAll={handleSelectAllChange}
          onDeleteResult={handleDeleteResult}
          deletingResultId={deletingResultId}
        />
      </div>
    </div>
  );
}
