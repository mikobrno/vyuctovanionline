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
    };
    unit: {
      name: string;
      owner: string;
      share: string;
    };
    period: {
      year: number;
      startDate: string;
      endDate: string;
    };
    services: Array<{
      name: string;
      unit: string;
      share: number;
      buildingCost: number;
      buildingUnits: number;
      pricePerUnit: number;
      userUnits: number;
      userCost: number;
      advance: number;
      result: number;
    }>;
    totals: {
      cost: number;
      advance: number;
      result: number;
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
  };
}

export const BillingStatement: React.FC<BillingStatementProps> = ({ data }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(val);

  const formatNumber = (val: number, decimals = 2) => 
    new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);

  return (
    <div className="max-w-[210mm] mx-auto bg-white p-8 text-sm font-sans print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{data.unit.owner}</h1>
          <div className="grid grid-cols-[120px_1fr] gap-1 text-gray-600">
            <span>Adresa společenství:</span>
            <span className="font-medium">{data.building.address}</span>
            <span>Bankovní spojení:</span>
            <span className="font-medium">{data.building.accountNumber}</span>
            <span>Variabilní symbol:</span>
            <span className="font-medium">{data.building.variableSymbol}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-600 mb-1">adminreal</div>
          <div className="text-xs text-gray-500">
            č. prostoru: {data.unit.name}<br/>
            zúčtovací období: {format(new Date(data.period.startDate), 'd.M.yyyy')} - {format(new Date(data.period.endDate), 'd.M.yyyy')}
          </div>
        </div>
      </div>

      <h2 className="text-center text-xl font-bold mb-6 border-b-2 border-gray-800 pb-2">
        Vyúčtování služeb: {data.period.year}
      </h2>

      {/* Main Table */}
      <div className="mb-8 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="p-2 text-left">Položka</th>
              <th className="p-2 text-center">Jednotka</th>
              <th className="p-2 text-center">Podíl</th>
              <th className="p-2 text-right border-l">Náklad (dům)</th>
              <th className="p-2 text-right">Jednotek</th>
              <th className="p-2 text-right">Kč/jedn</th>
              <th className="p-2 text-right border-l">Jednotek (uživatel)</th>
              <th className="p-2 text-right font-bold">Náklad (uživatel)</th>
              <th className="p-2 text-right">Záloha</th>
              <th className="p-2 text-right font-bold">Přeplatek/Nedoplatek</th>
            </tr>
          </thead>
          <tbody>
            {data.services.map((service, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="p-2 font-medium">{service.name}</td>
                <td className="p-2 text-center">{service.unit}</td>
                <td className="p-2 text-center">{service.share}%</td>
                <td className="p-2 text-right border-l">{formatCurrency(service.buildingCost)}</td>
                <td className="p-2 text-right">{formatNumber(service.buildingUnits)}</td>
                <td className="p-2 text-right">{formatNumber(service.pricePerUnit)}</td>
                <td className="p-2 text-right border-l">{formatNumber(service.userUnits)}</td>
                <td className="p-2 text-right font-bold">{formatCurrency(service.userCost)}</td>
                <td className="p-2 text-right">{formatCurrency(service.advance)}</td>
                <td className={`p-2 text-right font-bold ${service.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(service.result)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
              <td colSpan={3} className="p-3 text-left">Celkem náklady na odběrné místo</td>
              <td className="p-3 text-right border-l">{formatCurrency(data.services.reduce((acc, s) => acc + s.buildingCost, 0))}</td>
              <td colSpan={3} className="border-l"></td>
              <td className="p-3 text-right">{formatCurrency(data.totals.cost)}</td>
              <td className="p-3 text-right">{formatCurrency(data.totals.advance)}</td>
              <td className={`p-3 text-right ${data.totals.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(data.totals.result)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Result Box */}
      <div className="flex justify-between items-center bg-gray-50 p-6 border border-gray-300 mb-8 rounded-lg">
        <div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-2">
            <span className="font-bold">Pevné platby:</span>
            <span>Fond oprav: 11 928 Kč</span>
          </div>
          <div className="text-xs text-gray-500">
            Není evidován v účtovaném období přeplatek ani nedoplatek<br/>
            Není evidován v minulém období přeplatek ani nedoplatek
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-600 mb-1">
            {data.totals.result >= 0 ? 'PŘEPLATEK CELKEM' : 'NEDOPLATEK CELKEM'}
          </div>
          <div className={`text-3xl font-bold ${data.totals.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(data.totals.result)}
          </div>
          {data.totals.result < 0 && (
            <div className="mt-2 text-sm bg-red-100 text-red-800 p-2 rounded">
              Nedoplatek uhraďte na účet číslo: <strong>{data.building.accountNumber}</strong><br/>
              variabilní symbol <strong>{data.building.variableSymbol}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Payment Schedule */}
      <div className="mb-8">
        <h3 className="font-bold bg-gray-200 p-2 text-sm mb-2">Přehled úhrad za rok {data.period.year}</h3>
        <div className="grid grid-cols-12 gap-0 border text-xs">
          {data.payments.map((p, i) => (
            <div key={i} className="border-r last:border-r-0">
              <div className="bg-gray-50 p-1 text-center border-b">{p.month}/{data.period.year}</div>
              <div className="p-1 text-center font-medium">{formatNumber(p.paid, 0)} Kč</div>
            </div>
          ))}
        </div>
      </div>

      {/* Meter Readings */}
      {data.readings.length > 0 && (
        <div>
          <h3 className="font-bold bg-gray-200 p-2 text-sm mb-2">Měřené služby</h3>
          <table className="w-full text-xs border border-gray-300">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Služba</th>
                <th className="p-2 text-left">Měřidlo</th>
                <th className="p-2 text-right">Poč. stav</th>
                <th className="p-2 text-right">Kon. stav</th>
                <th className="p-2 text-right">Spotřeba</th>
              </tr>
            </thead>
            <tbody>
              {data.readings.map((reading, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  <td className="p-2">{reading.service}</td>
                  <td className="p-2">{reading.meterId}</td>
                  <td className="p-2 text-right">{formatNumber(reading.startValue)}</td>
                  <td className="p-2 text-right">{formatNumber(reading.endValue)}</td>
                  <td className="p-2 text-right font-bold">{formatNumber(reading.consumption)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-8 text-xs text-gray-500 border-t pt-4">
        <p>Jednotková cena za m3 vody činila v roce {data.period.year} dle ceníku BVaK 105,53 Kč.</p>
        <p>Případné reklamace uplatněte výhradně písemnou formou na adrese správce nejpozději do 30 dnů.</p>
      </div>
    </div>
  );
};
