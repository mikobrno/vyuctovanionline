"use client";

import { useState } from 'react';
import type { UnitBillingData } from '@/types/export-full';
import type { ExportFullWarning, ExportFullPreviewStats } from '@/lib/exportFullParser';

interface ApiResponse {
  units: UnitBillingData[];
  warnings: ExportFullWarning[];
  stats: ExportFullPreviewStats;
  error?: string;
}

export default function ExportPreviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setError('Vyberte XLSX soubor s listem EXPORT_FULL.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/export-full/preview', { method: 'POST', body: formData });
      const json: ApiResponse = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Import se nezdařil.');
      } else {
        setData(json);
      }
    } catch (e) {
      console.error(e);
      setError('Došlo k chybě při odesílání.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Náhled EXPORT_FULL (XLSX)</h1>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Načítám...' : 'Nahrát a zobrazit'}
        </button>
      </div>
      {error && <div className="rounded border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {data && (
        <div className="space-y-4">
          <Stats stats={data.stats} />
          <Warnings warnings={data.warnings} />
          <Units units={data.units} />
        </div>
      )}
    </div>
  );
}

function Stats({ stats }: { stats: ExportFullPreviewStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {[
        ['Jednotky', stats.unitCount],
        ['Řádků', stats.rowCount],
        ['Služby', stats.serviceCount],
        ['Měřidla', stats.meterCount],
        ['Pevné platby', stats.fixedPaymentCount]
      ].map(([label, value]) => (
        <div key={label} className="rounded border bg-white px-3 py-2 shadow-sm">
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-lg font-semibold">{value as number}</div>
        </div>
      ))}
    </div>
  );
}

function Warnings({ warnings }: { warnings: ExportFullWarning[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <div className="font-semibold">Varování ({warnings.length}):</div>
      <ul className="list-disc pl-4">
        {warnings.map((w, idx) => (
          <li key={`${w.type}-${idx}`}>
            Řádek {w.row}: {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Units({ units }: { units: UnitBillingData[] }) {
  if (units.length === 0) return <div className="text-sm text-gray-600">Žádná data.</div>;
  return (
    <div className="space-y-4">
      {units.map((u) => (
        <div key={u.unitName} className="rounded border bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-lg font-semibold">{u.unitName}</div>
            <div className="text-sm text-gray-600">
              VS: {u.info.variableSymbol || '–'} | Email: {u.info.email || '–'} | Účet: {u.info.bankAccount || '–'} | Výsledek: {u.info.totalResult.toFixed(2)} Kč
            </div>
          </div>
          {u.services.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-sm font-semibold">Služby ({u.services.length}):</div>
              {u.services.map((s) => (
                <div key={`${u.unitName}-${s.name}`} className="rounded border px-2 py-1 text-sm">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-gray-700">
                    Náklad byt: {s.unitCost.toFixed(2)} | Záloha: {s.unitAdvance.toFixed(2)} | Výsledek: {s.unitBalance.toFixed(2)}
                  </div>
                  {(s.details.unit || s.details.buildingUnits || s.details.unitPrice || s.details.unitUnits) && (
                    <div className="text-gray-600">
                      Jednotka: {s.details.unit || '–'} | Dům: {s.details.buildingUnits || '–'} | Cena/j.: {s.details.unitPrice || '–'} | Spotřeba: {s.details.unitUnits || '–'}
                    </div>
                  )}
                  {s.meters.length > 0 && (
                    <div className="mt-1 text-gray-700">
                      Měřidla: {s.meters.map((m) => `${m.serial || '??'} ${m.start}→${m.end} (${m.consumption})`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {u.fixedPayments.length > 0 && (
            <div className="mt-2 text-sm">
              <div className="font-semibold">Pevné platby ({u.fixedPayments.length}):</div>
              {u.fixedPayments.map((p) => (
                <div key={`${u.unitName}-${p.name}`}>{p.name}: {p.amount.toFixed(2)} Kč</div>
              ))}
            </div>
          )}
          {(u.monthlyData.payments.some((v) => v !== 0) || u.monthlyData.advances.some((v) => v !== 0)) && (
            <div className="mt-2 text-sm text-gray-700">
              Úhrady (součet): {u.monthlyData.payments.reduce((a, b) => a + b, 0).toFixed(2)} | Předpisy (součet): {u.monthlyData.advances.reduce((a, b) => a + b, 0).toFixed(2)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
