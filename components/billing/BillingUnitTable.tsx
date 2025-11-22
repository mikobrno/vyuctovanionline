"use client";

import Link from 'next/link';

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
    window.open(`/api/buildings/${buildingId}/billing/${resultId}/pdf`, '_blank');
  };

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jednotka</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vlastník</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Náklad</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Zálohy</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Výsledek</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {results.map((row) => (
            <tr key={row.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link href={`/buildings/${buildingId}/billing/${row.id}`} className="text-blue-600 hover:underline hover:text-blue-800">
                  {row.unitNumber}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.ownerName || "Neznámý"}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(row.totalCost)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(row.totalAdvance)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  row.balance >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {row.balance >= 0 ? "Přeplatek" : "Nedoplatek"} {formatCurrency(Math.abs(row.balance))}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => handleDownloadPdf(row.id)}
                    className="text-gray-700 hover:text-gray-900 bg-white border border-gray-300 px-3 py-1 rounded-md text-sm"
                  >
                    PDF
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                Zatím nebylo provedeno žádné vyúčtování. Spusťte výpočet tlačítkem výše.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
