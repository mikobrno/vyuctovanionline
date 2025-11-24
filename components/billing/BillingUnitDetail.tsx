'use client'

import Link from 'next/link'

interface BillingUnitDetailProps {
  buildingId: string
  billingPeriod: any
  billingResult: any
  payments: any[]
}

export default function BillingUnitDetail({ 
  buildingId, 
  billingPeriod, 
  billingResult,
  payments 
}: BillingUnitDetailProps) {
  const owner = billingResult.unit.ownerships[0]?.owner

  const handlePrintPDF = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Hlavička */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Vyúčtování {billingResult.unit.unitNumber}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-slate-400">
            {billingPeriod.building.name} • Rok {billingPeriod.year}
          </p>
        </div>
        <div className="flex gap-3 print:hidden">
          <button
            onClick={handlePrintPDF}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors shadow-sm"
          >
            🖨️ Tisknout PDF
          </button>
          <Link
            href={`/buildings/${buildingId}/billing/calculate?year=${billingPeriod.year}`}
            className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            ← Zpět
          </Link>
        </div>
      </div>

      {/* Tisknutelný výpis */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 print:shadow-none print:border-none print:p-0">
        {/* Hlavička výpisu */}
        <div className="border-b-2 border-gray-200 dark:border-slate-700 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {billingPeriod.building.name}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 mt-1">{billingPeriod.building.address}</p>
              <p className="text-gray-600 dark:text-slate-400">{billingPeriod.building.city}, {billingPeriod.building.zip}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-slate-500">Vyúčtování za rok</div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{billingPeriod.year}</div>
            </div>
          </div>
        </div>

        {/* Údaje o jednotce a vlastníkovi */}
        <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-500 uppercase mb-2">Jednotka</h3>
            <div className="space-y-1">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{billingResult.unit.unitNumber}</div>
              <div className="text-sm text-gray-600 dark:text-slate-400">Výměra: {billingResult.unit.totalArea} m²</div>
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Podíl: {billingResult.unit.shareNumerator}/{billingResult.unit.shareDenominator}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">VS: {billingResult.unit.variableSymbol}</div>
            </div>
          </div>
          
          {owner && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-500 uppercase mb-2">Vlastník</h3>
              <div className="space-y-1">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {owner.firstName} {owner.lastName}
                </div>
                {owner.email && <div className="text-sm text-gray-600 dark:text-slate-400">{owner.email}</div>}
                {owner.phone && <div className="text-sm text-gray-600 dark:text-slate-400">{owner.phone}</div>}
                {owner.address && <div className="text-sm text-gray-600 dark:text-slate-400">{owner.address}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Rozúčtování nákladů */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rozúčtování nákladů</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50 border-b-2 border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Služba</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Jednotka</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Spotřeba</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Náklad celkem</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Váš náklad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {billingResult.serviceCosts.map((serviceCost: any) => (
                  <tr key={serviceCost.id}>
                    <td className="px-4 py-3 text-gray-900 dark:text-slate-300">{serviceCost.service.name}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-slate-300">
                      {serviceCost.service.measurementUnit || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-slate-300">
                      {serviceCost.unitConsumption ? 
                        serviceCost.unitConsumption.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) : 
                        '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-slate-300">
                      {serviceCost.buildingTotalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {serviceCost.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-200 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    Celkem náklady:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                    {billingResult.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Způsob výpočtu */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Způsob výpočtu:</h4>
            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
              {billingResult.serviceCosts.map((serviceCost: any) => (
                <div key={serviceCost.id}>
                  <span className="font-medium">{serviceCost.service.name}:</span>{' '}
                  {serviceCost.calculationBasis}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Přehled úhrad */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Přehled úhrad záloh</h3>
          
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Datum</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Popis</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Částka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2 text-gray-900 dark:text-slate-300">
                        {new Date(payment.paymentDate).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-slate-300">{payment.description || 'Úhrada záloh'}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-slate-300">
                        {payment.amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      Celkem uhrazeno:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {billingResult.totalAdvancePaid.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-slate-400 text-sm">Nebyly zaznamenány žádné platby</p>
          )}
        </div>

        {/* Výsledek vyúčtování */}
        <div className="border-2 border-gray-300 dark:border-slate-600 rounded-xl p-6 bg-gray-50 dark:bg-slate-900/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Výsledek vyúčtování</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-900 dark:text-slate-300">Celkové náklady:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {billingResult.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-900 dark:text-slate-300">Uhrazené zálohy:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {billingResult.totalAdvancePaid.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
              </span>
            </div>
            
            <div className="border-t-2 border-gray-300 dark:border-slate-600 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {billingResult.result > 0 ? 'Přeplatek:' : 
                   billingResult.result < 0 ? 'Nedoplatek:' : 
                   'Vyrovnáno:'}
                </span>
                <span className={`text-3xl font-bold ${
                  billingResult.result > 0 ? 'text-green-600 dark:text-green-400' : 
                  billingResult.result < 0 ? 'text-red-600 dark:text-red-400' : 
                  'text-gray-900 dark:text-white'
                }`}>
                  {billingResult.result > 0 && '+'}{Math.abs(billingResult.result).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                </span>
              </div>
            </div>

            {billingResult.result < 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mt-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>K úhradě:</strong> Prosíme o úhradu nedoplatku ve výši{' '}
                  <strong>{Math.abs(billingResult.result).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</strong>{' '}
                  na účet {billingPeriod.building.bankAccount || '[číslo účtu]'}, variabilní symbol: {billingResult.unit.variableSymbol}
                </p>
              </div>
            )}

            {billingResult.result > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mt-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Přeplatek bude:</strong> Vrácen na Váš účet nebo použit jako záloha pro příští období
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Patička */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-400">
          <p>
            Vyúčtování vypracováno dne {new Date().toLocaleDateString('cs-CZ')}
          </p>
          <p className="mt-2">
            V případě dotazů nás kontaktujte na e-mailu nebo telefonu uvedeném výše.
          </p>
        </div>
      </div>
    </div>
  )
}
