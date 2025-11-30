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
      address?: string;
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
    qrCodeUrl?: string;
  };
}

export const BillingStatement: React.FC<BillingStatementProps> = ({ data }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(val);

  const formatNumber = (val: number, decimals = 2) => 
    new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);

  const isBrnoReal = data.building.managerName?.toLowerCase().includes('brnoreal');
  const logoSrc = isBrnoReal ? '/brnoreal.png' : '/adminreal.png';

  const displayedServices = data.services;

  return (
    <div className="max-w-[297mm] mx-auto bg-white p-8 text-sm font-sans print:p-0 print:max-w-none">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{data.unit.owner}</h1>
          <div className="grid grid-cols-[120px_1fr] gap-1 text-gray-600">
            <span>Adresa:</span>
            <span className="font-medium">{data.unit.address || data.building.address}</span>
            {data.unit.email && (
              <>
                <span>Email:</span>
                <span className="font-medium">{data.unit.email}</span>
              </>
            )}
            {data.unit.phone && (
              <>
                <span>Telefon:</span>
                <span className="font-medium">{data.unit.phone}</span>
              </>
            )}
            <span>Bankovní spojení číslo:</span>
            <span className="font-medium">{data.unit.bankAccount || '-'}</span>
            <span>Variabilní symbol pro platbu nedoplatku:</span>
            <span className="font-medium">{data.building.variableSymbol}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-2 flex justify-end">
            <img src={logoSrc} alt={isBrnoReal ? "BrnoReal" : "AdminReal"} className="h-16 object-contain" />
          </div>
          <div className="text-xs text-gray-500">
            č. prostoru: {data.unit.name}<br/>
            zúčtovací období: {format(new Date(data.period.startDate), 'd.M.yyyy')} - {format(new Date(data.period.endDate), 'd.M.yyyy')}
          </div>
        </div>
      </div>

      <h2 className="text-center text-lg font-bold mb-6 bg-gray-100 py-1 border-y border-gray-300 text-gray-800">
        Vyúčtování služeb: {data.period.year}
      </h2>

      {/* Main Table */}
      <div className="mb-8 overflow-x-auto">
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th colSpan={3} className="p-2 text-center border-r border-slate-600">Parametry služby</th>
              <th colSpan={3} className="p-2 text-center border-r border-slate-600">Celkové náklady domu</th>
              <th colSpan={2} className="p-2 text-center border-r border-slate-600">Náklady jednotky</th>
              <th colSpan={2} className="p-2 text-center">Vyúčtování</th>
            </tr>
            <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
              <th className="p-2 text-left font-semibold">Položka</th>
              <th className="p-2 text-center font-semibold">Jednotka</th>
              <th className="p-2 text-center font-semibold border-r border-gray-300">Podíl</th>
              
              <th className="p-2 text-right font-semibold">Náklad (dům)</th>
              <th className="p-2 text-right font-semibold">Jednotek</th>
              <th className="p-2 text-right font-semibold border-r border-gray-300">Kč/jedn</th>
              
              <th className="p-2 text-right font-semibold">Jednotek</th>
              <th className="p-2 text-right font-semibold border-r border-gray-300">Náklad</th>
              
              <th className="p-2 text-right font-semibold">Záloha</th>
              <th className="p-2 text-right font-semibold">Přeplatek/nedoplatek</th>
            </tr>
          </thead>
          <tbody>
            {displayedServices
              .filter(service => !(service.buildingCost === 0 && service.advance === 0))
              .filter(service => service.name !== 'Celková záloha' && service.name !== 'TOTAL_ADVANCE')
              .map((service, idx) => (
              <tr key={idx} className={`border-b border-gray-200 hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="p-2 font-medium text-gray-800">{service.name}</td>
                <td className="p-2 text-center text-gray-600">{service.unit}</td>
                <td className="p-2 text-center text-gray-600 border-r border-gray-200">{service.share}%</td>
                
                <td className="p-2 text-right text-gray-600">{formatCurrency(service.buildingCost)}</td>
                <td
                  className={`p-2 text-gray-600 ${service.buildingUnits > 0 ? 'text-right' : 'text-center text-gray-400'}`}
                >
                  {service.buildingUnits > 0 ? formatNumber(service.buildingUnits) : '-'}
                </td>
                <td className="p-2 text-right text-gray-600 border-r border-gray-200">{service.pricePerUnit > 0 ? formatNumber(service.pricePerUnit) : ''}</td>
                
                <td
                  className={`p-2 font-medium ${service.userUnits > 0 ? 'text-right text-gray-800' : 'text-center text-gray-400'}`}
                >
                  {service.userUnits > 0 ? formatNumber(service.userUnits) : '-'}
                </td>
                <td className="p-2 text-right font-bold text-gray-800 bg-yellow-50 border-r border-gray-200">{formatCurrency(service.userCost)}</td>
                
                <td className="p-2 text-right text-gray-600">{formatCurrency(service.advance)}</td>
                <td className={`p-2 text-right font-bold ${service.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(service.result)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
              <td colSpan={3} className="p-3 text-left border-r border-slate-300">CELKEM NÁKLADY NA ODBĚRNÉ MÍSTO</td>
              
              <td className="p-3 text-right">{formatCurrency(displayedServices.reduce((acc, s) => acc + s.buildingCost, 0))}</td>
              <td colSpan={2} className="border-r border-slate-300"></td>
              
              <td className="p-3 text-right"></td>
              <td className="p-3 text-right bg-yellow-100 border-r border-slate-300">{formatCurrency(data.totals.cost)}</td>
              
              <td className="p-3 text-right">{formatCurrency(data.totals.advance)}</td>
              <td className={`p-3 text-right text-lg ${data.totals.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(data.totals.result)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Schedule */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Payments Table */}
        <div>
          <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">Přehled úhrad za rok {data.period.year}</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Měsíc</th>
                <th className="text-right py-1">Uhrazeno</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.month} className="border-b border-gray-100">
                  <td className="py-1">{payment.month}</td>
                  <td className="text-right py-1">{formatCurrency(payment.paid)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td className="py-2">Celkem</td>
                <td className="text-right py-2">
                  {formatCurrency(data.payments.reduce((sum, p) => sum + p.paid, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Prescriptions Table */}
        <div>
          <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">Přehled předpisů za rok {data.period.year}</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Měsíc</th>
                <th className="text-right py-1">Předpis</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.month} className="border-b border-gray-100">
                  <td className="py-1">{payment.month}</td>
                  <td className="text-right py-1">{formatCurrency(payment.prescribed)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td className="py-2">Celkem</td>
                <td className="text-right py-2">
                  {formatCurrency(data.payments.reduce((sum, p) => sum + p.prescribed, 0))}
                </td>
              </tr>
            </tbody>
          </table>
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
      
      <div className="mt-8 border-t-2 border-gray-800 pt-4">
        <div className="flex justify-between items-center mb-6">
          <div className="text-lg">
            Výsledek vyúčtování: <span className={data.totals.result >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
              {data.totals.result >= 0 ? "PŘEPLATEK" : "NEDOPLATEK"}
            </span>
          </div>
          <div className={`text-3xl font-bold ${data.totals.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(data.totals.result)}
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-8">
          <div className="text-sm text-gray-600 space-y-2">
            {data.totals.result < 0 ? (
               <p className="bg-gray-100 p-2 font-bold text-gray-800 border-l-4 border-red-500">
                 Nedoplatek uhraďte na účet číslo: {data.building.accountNumber} pod variabilním symbolem {data.building.variableSymbol}
               </p>
            ) : (
               <p className="bg-gray-100 p-2 font-bold text-gray-800 border-l-4 border-green-500">
                 Přeplatek Vám bude vyplacen na číslo účtu {data.building.accountNumber}
               </p>
            )}

            <div className="mt-4 space-y-1 text-xs">
              <p>Jednotková cena za m3 vody činila v roce {data.period.year} dle ceníku BVaK 105,53 Kč. Hodnota uvedená ve vyúčtování již zahrnuje rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.</p>
              <p>Případné reklamace uplatněte výhradně písemnou (elektronickou) formou na adrese správce (viz. záhlaví) nejpozději do 30 dnů od doručení vyúčtování včetně případné změny Vašeho osobního účtu pro vyplacení přeplatku.</p>
              <p>Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.</p>
            </div>
          </div>
          
          {data.qrCodeUrl && data.totals.result < 0 ? (
            <div className="flex flex-col items-center justify-center border p-4 rounded bg-gray-50">
              <div className="font-bold mb-2 text-center">QR Platba</div>
              <img src={data.qrCodeUrl} alt="QR Platba" className="w-32 h-32" />
              <div className="text-xs text-center mt-1 text-gray-500">Naskenujte pro platbu</div>
            </div>
          ) : data.totals.result < 0 ? (
            <div className="flex flex-col items-center justify-center border p-4 rounded bg-gray-50 text-gray-400 text-xs text-center">
              <div className="font-bold mb-1">QR Platba nedostupná</div>
              {!data.building.accountNumber && <div>Chybí číslo účtu domu</div>}
              {!data.building.variableSymbol && <div>Chybí variabilní symbol</div>}
            </div>
          ) : null}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-500">
          <div>Datum: {format(new Date(), 'd.M.yyyy')}</div>
          <div>info@adminreal.cz | mobil: 607 959 876</div>
          <div>www.adminreal.cz | www.onlinesprava.cz</div>
        </div>
      </div>
    </div>
  );
};
