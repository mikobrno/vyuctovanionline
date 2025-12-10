'use client';

import React from 'react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface BillingStatementProps {
  data: {
    building: {
      name: string;
      address: string;
      accountNumber: string;
      variableSymbol: string;
      managerName?: string;
    };
    unit: {
      name: string;
      owner: string;
      share: string;
      address?: string; // Adresa vlastníka (pokud se liší)
      email?: string;
      phone?: string;
      bankAccount?: string;  // bankovní účet vlastníka pro přeplatek
    };
    period: {
      year: number;
      startDate: string;
      endDate: string;
    };
    services: Array<{
      name: string;
      unit: string;
      share?: number | string | null;
      buildingCost: number;
      buildingUnits: number | string; // Allow string for exact formatting
      pricePerUnit: number | string; // Allow string for exact formatting
      userUnits: number | string; // Allow string for exact formatting
      userCost: number;
      advance: number;
      result: number;
    }>;
    totals: {
      cost: number;
      advance: number;
      result: number;
      repairFund?: number; // Fond oprav (zobrazuje se v Pevné platby)
    };
    readings: Array<{
      service: string;
      meterId: string;
      startValue: number;
      endValue: number;
      consumption: number;
    }>;
    payments: Array<{
      month: number;
      prescribed: number;
      paid: number;
    }>;
    qrCodeUrl?: string;
    note?: string | null;
    fixedPayments?: Array<{ name: string; amount: number }>;
  };
}

export const BillingStatement: React.FC<BillingStatementProps> = ({ data }) => {
  // --- Formatters ---
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(val).replace('Kč', '').trim() + ' Kč';

  const formatNumber = (val: number | string, decimals = 2) => {
    if (typeof val === 'string') return val;
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
  };

  const formatShare = (share: number | string | null | undefined) => {
    if (share === null || share === undefined || share === '') return '-';
    if (typeof share === 'string') return share;
    return `${formatNumber(share, 2)} %`;
  };

  // --- Logic ---
  const instructionNote = data.note?.trim();
  const fixedPayments = [...(data.fixedPayments ?? [])];
  if (data.totals.repairFund && data.totals.repairFund > 0) {
    fixedPayments.push({ name: 'Fond oprav', amount: data.totals.repairFund });
  }

  const isBrnoReal = data.building.managerName?.toLowerCase().includes('brnoreal');
  // Use adminreal.png as default, simple fallback in img tag
  const logoSrc = isBrnoReal ? '/brnoreal.png' : '/adminreal.png';

  const displayedServices = data.services;

  // Landscape check logic: Using a hardcoded style class for width
  return (
    <div className="max-w-[297mm] mx-auto bg-white p-6 text-[11px] font-sans leading-tight print:p-0 print:max-w-none text-black">
      {/* Header */}
      <div className="flex justify-between items-start mb-2 pb-2 border-b-2 border-black">
        <div className="w-1/2">
          <h1 className="text-xl font-bold mb-1">{data.unit.owner}</h1>
          <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-0.5">
            <span className="font-bold">adresa společenství:</span>
            <span>{data.building.name}, {data.building.address}</span>

            <span className="font-bold">bankovní spojení společenství:</span>
            <span>{data.building.accountNumber}</span>
          </div>
        </div>
        <div className="w-1/2 text-right flex flex-col items-end">
          {/* Logo with error handling to hide if missing */}
          <img
            src={logoSrc}
            alt="logo"
            className="h-12 object-contain mb-2"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <div className="text-[10px] text-gray-600 mb-1">
            {isBrnoReal ? 'BrnoReal' : 'AdminReal s.r.o., Veveří 2581/102, 616 00 Brno, IČO 02827476'}
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-4 text-left mt-2 w-full justify-end">
            <div className="text-right">
              <div className="mb-0.5"><span className="font-bold">bankovní spojení člena:</span> {data.unit.bankAccount || '-'}</div>
              <div><span className="font-bold">variabilní symbol pro platbu nedoplatku:</span> {data.building.variableSymbol}</div>
            </div>
            <div className="text-right border-l pl-2 border-gray-300">
              <div className="font-bold">č. prostoru: {data.unit.name}</div>
              <div>zúčtovací období: {format(new Date(data.period.startDate), 'd.1.yyyy')} - {format(new Date(data.period.endDate), 'd.12.yyyy')}</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-center text-lg font-bold mb-2 border-b-2 border-black pb-1">
        Vyúčtování služeb: {data.period.year}
      </h2>

      {/* Main Table */}
      <div className="mb-4">
        <table className="w-full border-collapse border-b-2 border-black">
          <thead>
            <tr className="border-b border-black">
              <th colSpan={3} className="p-1 border-r border-black font-normal text-right pr-4 bg-gray-100"></th>
              <th colSpan={3} className="p-1 border-r border-black font-normal text-center bg-gray-100">Odběrné místo (dům)</th>
              <th colSpan={4} className="p-1 font-normal text-center bg-gray-100">Uživatel</th>
            </tr>
            <tr className="bg-gray-200 border-b border-black font-semibold text-center">
              <th className="p-1 text-left w-[25%]">Položka</th>
              <th className="p-1 text-center w-[10%]">Jednotka</th>
              <th className="p-1 text-center w-[8%] border-r border-black">Podíl</th>

              <th className="p-1 text-right w-[10%]">Náklad</th>
              <th className="p-1 text-right w-[8%]">Jednotek</th>
              <th className="p-1 text-right w-[8%] border-r border-black">Kč/jedn</th>

              <th className="p-1 text-right w-[8%]">Jednotek</th>
              <th className="p-1 text-right w-[10%]">Náklad</th>
              <th className="p-1 text-right w-[10%]">Záloha</th>
              <th className="p-1 text-right w-[10%] bg-gray-300">Přeplatky|nedoplatky</th>
            </tr>
          </thead>
          <tbody>
            {displayedServices
              .filter(service => !(service.buildingCost === 0 && service.advance === 0))
              .map((service, idx) => (
                <tr key={idx} className={`border-b border-gray-300 last:border-black ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="p-1 px-2 text-left bg-gray-100 font-medium border-r border-gray-300">{service.name}</td>
                  <td className="p-1 text-center">{service.unit}</td>
                  <td className="p-1 text-center border-r border-black">{formatShare(service.share)}</td>

                  <td className="p-1 text-right">{formatNumber(service.buildingCost)}</td>
                  <td className="p-1 text-right">{formatNumber(service.buildingUnits)}</td>
                  <td className="p-1 text-right border-r border-black">{formatNumber(service.pricePerUnit)}</td>

                  <td className="p-1 text-right bg-white">{formatNumber(service.userUnits)}</td>
                  <td className="p-1 text-right font-semibold bg-white">{formatNumber(service.userCost)}</td>
                  <td className="p-1 text-right bg-white">{formatNumber(service.advance)}</td>
                  <td className="p-1 text-right font-bold bg-gray-100 border-l border-black">
                    {formatNumber(service.result)}
                  </td>
                </tr>
              ))}
            {/* Totals Row */}
            <tr className="font-bold text-black text-[12px]">
              <td colSpan={3} className="p-2 text-left">Celkem náklady na odběrné místa</td>
              <td className="p-2 text-right">{formatNumber(displayedServices.reduce((acc, s) => acc + s.buildingCost, 0))}</td>
              <td colSpan={2} className="border-r border-black"></td>
              <td className="p-2 text-right" colSpan={1}>Celkem vyúčtování:</td>
              <td className="p-2 text-right">{formatNumber(data.totals.cost)}</td>
              <td className="p-2 text-right">{formatNumber(data.totals.advance)}</td>
              <td className="p-2 text-right border-l border-black">{formatNumber(data.totals.result)} Kč</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Results Summary Box */}
      <div className="flex justify-end mb-6">
        <div className="w-[350px]">
          <div className="flex justify-between items-center text-sm mb-1">
            <span>Nedoplatek v účtovaném období</span>
            <span className="font-bold">{data.totals.result < 0 ? formatNumber(data.totals.result) : "0,00"} Kč</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-1">
            <span>Není evidován v minulém období přeplatek ani nedoplatek</span>
            <span className="font-bold">0,00 Kč</span>
          </div>

          <div className="flex justify-between items-center text-lg font-bold border-t-2 border-black pt-1 mt-1">
            <span className="uppercase">{data.totals.result >= 0 ? "PŘEPLATEK CELKEM" : "NEDOPLATEK CELKEM"}</span>
            <span>{formatNumber(data.totals.result).replace(/\s/g, ' ')} Kč</span>
          </div>

          {data.totals.result < 0 && (
            <div className="bg-gray-200 text-center font-bold p-1 mt-2 border border-gray-400">
              Nedoplatek uhraďte na účet číslo: {data.building.accountNumber}, variabilní symbol {data.building.variableSymbol}
            </div>
          )}
        </div>
      </div>

      {/* Pevné platby & Payment Grid Header */}
      <div className="grid grid-cols-[1fr_2fr] gap-8 mb-4">
        {/* Pevné platby */}
        <div>
          <table className="w-full border-collapse border border-gray-400 text-xs">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 p-1">Pevné platby</th>
                <th className="border border-gray-400 p-1 text-right">Celkem za rok</th>
              </tr>
            </thead>
            <tbody>
              {fixedPayments.map((p, i) => (
                <tr key={i}>
                  <td className="border border-gray-400 p-1">{p.name}</td>
                  <td className="border border-gray-400 p-1 text-right font-bold">{formatNumber(p.amount)} Kč</td>
                </tr>
              ))}
              {fixedPayments.length === 0 && (
                <tr><td colSpan={2} className="p-1 text-center text-gray-400">-</td></tr>
              )}
            </tbody>
          </table>

          {/* QR Code if needed */}
          {data.qrCodeUrl && data.totals.result < 0 && (
            <div className="mt-4">
              <img src={data.qrCodeUrl} className="w-24 h-24 border" alt="QR Code" />
            </div>
          )}
        </div>

        {/* Payment Schedule Tables */}
        <div>
          {/* Payments Grid (Horizontal 12 months) */}
          <div className="mb-2">
            <div className="bg-gray-200 font-bold text-center border border-gray-400 p-0.5 text-xs">Přehled úhrad za rok {data.period.year}</div>
            <div className="grid grid-cols-[80px_repeat(12,_1fr)] text-[10px] border-l border-b border-gray-400">
              <div className="border-r border-t border-gray-400 p-0.5 font-bold">Měsíc</div>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-t border-gray-400 p-0.5 text-center">{i + 1}/{data.period.year}</div>
              ))}

              <div className="border-r border-gray-400 p-0.5 font-bold">Uhrazeno</div>
              {data.payments.map((p, i) => (
                <div key={i} className="border-r border-gray-400 p-0.5 text-right px-1">{formatNumber(p.paid, 0)}</div>
              ))}

              <div className="border-r border-gray-400 p-0.5 font-bold">Předpis</div>
              {data.payments.map((p, i) => (
                <div key={i} className="border-r border-gray-400 p-0.5 text-right px-1">{formatNumber(p.prescribed, 0)}</div>
              ))}
            </div>
            <div className="flex border-b border-r border-l border-gray-400 text-xs">
              <div className="w-[80px] p-1 font-bold">Celkem</div>
              <div className="flex-1 text-right p-1 font-bold">
                Nedoplatek za rok celkem: {formatNumber(data.totals.result)} Kč
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meter Readings - Zobrazit pokud jsou */}
      {data.readings.length > 0 && (
        <div className="mt-4 border-t border-black pt-2">
          <h3 className="font-bold mb-2">Stavy měřidel</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1">Služba</th>
                <th className="text-left py-1">Číslo měřidla</th>
                <th className="text-right py-1">Počáteční stav</th>
                <th className="text-right py-1">Konečný stav</th>
                <th className="text-right py-1">Spotřeba</th>
              </tr>
            </thead>
            <tbody>
              {data.readings.map((r, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1">{r.service}</td>
                  <td className="py-1">{r.meterId}</td>
                  <td className="text-right py-1">{formatNumber(r.startValue)}</td>
                  <td className="text-right py-1">{formatNumber(r.endValue)}</td>
                  <td className="text-right py-1 font-bold">{formatNumber(r.consumption)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Text */}
      <div className="mt-8 pt-2 border-t border-black text-[10px] text-gray-700 space-y-1">
        <p>Jednotková cena za m3 vody činila v roce {data.period.year} dle ceníku BVaK 105,53 Kč. Hodnota uvedená ve vyúčtování již zahrnuje rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.</p>
        <p>Případné reklamace uplatněte výhradně písemnou (elektronickou) formou na adrese správce (viz záhlaví) nejpozději do 30 dnů od doručení vyúčtování včetně případné změny Vašeho osobního účtu pro vyplacení přeplatku.</p>
        <p>Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.</p>
      </div>

      <div className="mt-4 flex justify-between text-[10px] text-gray-500">
        <div>Datum: {format(new Date(), 'd.M.yyyy')}</div>
        <div>info@adminreal.cz | mobil: 607 959 876</div>
        <div className="text-right">www.adminreal.cz | www.onlinesprava.cz</div>
      </div>
    </div>
  );
};
