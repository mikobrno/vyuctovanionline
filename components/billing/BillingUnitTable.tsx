"use client";

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { BillingResultItem } from './BillingDashboardView';

interface Props {
  buildingId: string;
  results: BillingResultItem[];
  selectedIds: string[];
  onToggleSelection: (resultId: string) => void;
  onSelectAll: (checked: boolean) => void;
  onDeleteResult: (resultId: string, unitLabel: string) => Promise<void>;
  deletingResultId: string | null;
}

export function BillingUnitTable({
  buildingId,
  results,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeleteResult,
  deletingResultId,
}: Props) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

  const handleDownloadPdf = (resultId: string) => {
    window.open(`/api/buildings/${buildingId}/billing/${resultId}/pdf`, '_blank');
  };

  const handleTestEmail = async (resultId: string) => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'kost@onlinesprava.cz' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací email odeslán na kost@onlinesprava.cz!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleTestSms = async (resultId: string) => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '777338203' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací SMS odeslána na 777338203!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const selectAllRef = useRef<HTMLInputElement>(null);
  const totalCount = results.length;
  const selectedCount = selectedIds.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const indeterminate = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-900/50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected && totalCount > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Vybrat všechny jednotky"
                />
                <span>Jednotka</span>
              </div>
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Vlastník</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Náklad</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Zálohy</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Výsledek</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Akce</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
          {results.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => onToggleSelection(row.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Vybrat jednotku ${row.unitNumber}`}
                  />
                  <Link href={`/buildings/${buildingId}/billing/${row.id}`} className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300">
                    {row.unitNumber}
                  </Link>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{row.ownerName || "Neznámý"}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-slate-400">{formatCurrency(row.totalCost)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-slate-400">{formatCurrency(row.totalAdvance)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  row.balance >= 0 
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                }`}>
                  {row.balance >= 0 ? "Přeplatek" : "Nedoplatek"} {formatCurrency(Math.abs(row.balance))}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleTestEmail(row.id)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    title="Odeslat testovací email na kost@onlinesprava.cz"
                  >
                    Test Email
                  </button>
                  <button
                    onClick={() => handleTestSms(row.id)}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-xs font-medium px-2 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                    title="Odeslat testovací SMS na 777338203"
                  >
                    Test SMS
                  </button>
                  <button 
                    onClick={() => handleDownloadPdf(row.id)}
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 px-3 py-1 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-600 shadow-sm"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => onDeleteResult(row.id, row.unitNumber)}
                    disabled={deletingResultId === row.id}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Smazat tuto jednotku z vyúčtování"
                  >
                    {deletingResultId === row.id ? 'Mažu…' : 'Smazat'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                Zatím nebylo provedeno žádné vyúčtování. Spusťte výpočet tlačítkem výše.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
