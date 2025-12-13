import React from 'react'
import { format } from 'date-fns'

export interface BillingStatementData {
  building: {
    name: string
    address: string
    accountNumber: string
    variableSymbol: string
    managerName?: string
  }
  unit: {
    name: string
    owner: string
    share: string
    address?: string
    email?: string
    phone?: string
    bankAccount?: string
  }
  period: {
    year: number
    startDate: string
    endDate: string
  }
  services: Array<{
    name: string
    unit: string
    share?: number | string | null
    buildingCost: number
    buildingUnits: number | string
    pricePerUnit: number | string
    userUnits: number | string
    userCost: number
    advance: number
    result: number
  }>
  totals: {
    cost: number
    advance: number
    result: number
    repairFund?: number
    periodBalance?: number
    previousPeriodBalance?: number
    grandTotal?: number
  }
  readings: Array<{
    service: string
    meterId: string
    startValue: number
    endValue: number
    consumption: number
  }>
  payments: Array<{
    month: number
    prescribed: number
    paid: number
  }>
  qrCodeUrl?: string
  note?: string | null
  fixedPayments?: Array<{ name: string; amount: number }>
}

export interface BillingStatementProps {
  data: BillingStatementData
}

interface BillingStatementContentProps extends BillingStatementProps {
  enableLogoFallback?: boolean
}

export const BillingStatementContent: React.FC<BillingStatementContentProps> = ({ data, enableLogoFallback = false }) => {
  // Zajistit, že payments má vždy 12 prvků
  const payments = data.payments?.length === 12 
    ? data.payments 
    : Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        prescribed: data.payments?.[i]?.prescribed || 0,
        paid: data.payments?.[i]?.paid || 0
      }));

  const formatNumber = (val: number | string, decimals = 2) => {
    if (typeof val === 'string') return val
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val)
  }

  const formatShare = (share: number | string | null | undefined) => {
    if (share === null || share === undefined || share === '') return '-'
    if (typeof share === 'string') return share
    return `${formatNumber(share, 2)} %`
  }

  const fixedPayments = [...(data.fixedPayments ?? [])]
  if (data.totals.repairFund && data.totals.repairFund > 0) {
    fixedPayments.push({ name: 'Fond oprav', amount: data.totals.repairFund })
  }

  const isBrnoReal = data.building.managerName?.toLowerCase().includes('brnoreal')
  const logoSrc = isBrnoReal ? '/brnoreal.png' : '/adminreal.png'

  const logoProps: React.ImgHTMLAttributes<HTMLImageElement> = enableLogoFallback
    ? {
        onError: (e) => {
          e.currentTarget.style.display = 'none'
        }
      }
    : {}

  const displayedServices = data.services

  const serviceResult = data.totals.result
  const periodBalance = typeof data.totals.periodBalance === 'number' ? data.totals.periodBalance : null
  const previousPeriodBalance = typeof data.totals.previousPeriodBalance === 'number' ? data.totals.previousPeriodBalance : null
  const grandTotal = typeof data.totals.grandTotal === 'number' ? data.totals.grandTotal : null
  const effectiveGrandTotal = grandTotal ?? serviceResult

  return (
    <div className="mx-auto max-w-[297mm] bg-white p-8 text-[11px] font-sans leading-tight text-slate-900 print:max-w-none print:p-0">
      <div className="grid grid-cols-2 gap-6 pb-4 mb-4 border-b border-slate-300 print:border-black">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight mb-2">{data.unit.owner}</h1>
          <div className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1">
            <span className="text-slate-600">Adresa společenství</span>
            <span className="font-medium">{data.building.name}, {data.building.address}</span>

            <span className="text-slate-600">Bankovní spojení společenství</span>
            <span className="font-medium">{data.building.accountNumber}</span>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <img src={logoSrc} alt="logo" className="h-10 object-contain mb-2" {...logoProps} />
          <div className="text-[10px] text-slate-500 mb-2">
            {isBrnoReal ? 'BrnoReal' : 'AdminReal s.r.o., Veveří 2581/102, 616 00 Brno, IČO 02827476'}
          </div>

          <div className="w-full rounded-md border border-slate-200 print:border-slate-300 p-2">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px]">
              <div className="text-slate-600">Bankovní spojení člena</div>
              <div className="font-medium">{data.unit.bankAccount || '-'}</div>

              <div className="text-slate-600">Variabilní symbol pro platbu nedoplatku</div>
              <div className="font-medium">{data.building.variableSymbol}</div>

              <div className="text-slate-600">Č. prostoru</div>
              <div className="font-medium">{data.unit.name}</div>

              <div className="text-slate-600">Zúčtovací období</div>
              <div className="font-medium">
                {format(new Date(data.period.startDate), 'd.1.yyyy')} - {format(new Date(data.period.endDate), 'd.12.yyyy')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-center text-[16px] font-semibold tracking-tight mb-4">Vyúčtování služeb: {data.period.year}</h2>

      <div className="mb-4">
        <div className="rounded-md border border-slate-300 overflow-hidden print:border-black">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 print:border-black">
              <th colSpan={3} className="p-2 border-r border-slate-300 print:border-black font-normal text-right pr-4 bg-slate-50"></th>
              <th colSpan={3} className="p-2 border-r border-slate-300 print:border-black font-normal text-center bg-slate-50">
                Odběrné místo (dům)
              </th>
              <th colSpan={4} className="p-2 font-normal text-center bg-slate-50">Uživatel</th>
            </tr>
            <tr className="bg-slate-100 border-b border-slate-300 print:border-black font-semibold text-center">
              <th className="p-2 text-left w-[25%]">Položka</th>
              <th className="p-2 text-center w-[10%]">Jednotka</th>
              <th className="p-2 text-center w-[8%] border-r border-slate-300 print:border-black">Podíl</th>

              <th className="p-2 text-right w-[10%]">Náklad</th>
              <th className="p-2 text-right w-[8%]">Jednotek</th>
              <th className="p-2 text-right w-[8%] border-r border-slate-300 print:border-black">Kč/jedn</th>

              <th className="p-2 text-right w-[8%]">Jednotek</th>
              <th className="p-2 text-right w-[10%]">Náklad</th>
              <th className="p-2 text-right w-[10%]">Záloha</th>
              <th className="p-2 text-right w-[10%] bg-slate-200">Přeplatky | nedoplatky</th>
            </tr>
          </thead>
          <tbody>
            {displayedServices
              .filter((service) => !(service.buildingCost === 0 && service.advance === 0))
              .map((service, idx) => (
                <tr key={idx} className={`border-b border-slate-200 print:border-slate-300 last:border-slate-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-2 px-3 text-left bg-slate-50 font-medium border-r border-slate-200 print:border-slate-300">{service.name}</td>
                  <td className="p-2 text-center">{service.unit}</td>
                  <td className="p-2 text-center border-r border-slate-300 print:border-black">{formatShare(service.share)}</td>

                  <td className="p-2 text-right tabular-nums">{formatNumber(service.buildingCost)}</td>
                  <td className="p-2 text-right tabular-nums">{formatNumber(service.buildingUnits)}</td>
                  <td className="p-2 text-right tabular-nums border-r border-slate-300 print:border-black">{formatNumber(service.pricePerUnit)}</td>

                  <td className="p-2 text-right tabular-nums">{formatNumber(service.userUnits)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{formatNumber(service.userCost)}</td>
                  <td className="p-2 text-right tabular-nums">{formatNumber(service.advance)}</td>
                  <td className="p-2 text-right tabular-nums font-bold bg-slate-100 border-l border-slate-300 print:border-black">{formatNumber(service.result)}</td>
                </tr>
              ))}
            <tr className="font-bold text-[12px] bg-slate-50">
              <td colSpan={3} className="p-3 text-left">
                Celkem náklady na odběrné místo
              </td>
              <td className="p-3 text-right tabular-nums">
                {formatNumber(displayedServices.reduce((acc, s) => acc + s.buildingCost, 0))}
              </td>
              <td colSpan={2} className="border-r border-slate-300 print:border-black"></td>
              <td className="p-3 text-right" colSpan={1}>
                Celkem vyúčtování
              </td>
              <td className="p-3 text-right tabular-nums">{formatNumber(data.totals.cost)}</td>
              <td className="p-3 text-right tabular-nums">{formatNumber(data.totals.advance)}</td>
              <td className="p-3 text-right tabular-nums border-l border-slate-300 print:border-black">{formatNumber(data.totals.result)} Kč</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <div className="w-[380px] rounded-md border border-slate-300 bg-slate-50 p-3 print:border-black">
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-slate-700">Nedoplatek v účtovaném období</span>
            <span className="font-semibold tabular-nums">
              {effectiveGrandTotal < 0 ? formatNumber(periodBalance ?? effectiveGrandTotal) : '0,00'} Kč
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-700">V minulém období</span>
            <span className="font-semibold tabular-nums">{formatNumber(previousPeriodBalance ?? 0)} Kč</span>
          </div>

          <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-slate-300 print:border-black">
            <span className="text-[12px] font-semibold tracking-wide">
              {effectiveGrandTotal >= 0 ? 'PŘEPLATEK CELKEM' : 'NEDOPLATEK CELKEM'}
            </span>
            <span className="text-[18px] font-bold tabular-nums">
              {formatNumber(effectiveGrandTotal).replace(/\s/g, ' ')} Kč
            </span>
          </div>

          {effectiveGrandTotal < 0 && (
            <div className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-[10px] font-semibold">
              Nedoplatek uhraďte na účet číslo: {data.building.accountNumber}, variabilní symbol {data.building.variableSymbol}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-8 mb-4">
        <div>
          <div className="rounded-md border border-slate-300 overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-b border-slate-300 p-2 text-left">Pevné platby</th>
                <th className="border-b border-slate-300 p-2 text-right">Celkem za rok</th>
              </tr>
            </thead>
            <tbody>
              {fixedPayments.map((p, i) => (
                <tr key={i}>
                  <td className="border-b border-slate-200 p-2">{p.name}</td>
                  <td className="border-b border-slate-200 p-2 text-right font-semibold tabular-nums">{formatNumber(p.amount)} Kč</td>
                </tr>
              ))}
              {fixedPayments.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-2 text-center text-slate-400">
                    -
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {data.qrCodeUrl && data.totals.result < 0 && (
            <div className="mt-4">
              <img src={data.qrCodeUrl} className="w-24 h-24 border border-slate-300 rounded" alt="QR Code" />
            </div>
          )}
        </div>

        <div>
          <div className="mb-2">
            <div className="bg-slate-100 font-semibold text-center border border-slate-300 p-2 text-xs rounded-t-md">
              Přehled úhrad za rok {data.period.year}
            </div>
            <div className="grid grid-cols-[90px_repeat(12,_1fr)] text-[10px] border-l border-b border-r border-slate-300 rounded-b-md overflow-hidden">
              <div className="border-r border-t border-slate-300 p-1 font-semibold bg-slate-50">Měsíc</div>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-t border-slate-300 p-1 text-center bg-slate-50">
                  {i + 1}/{data.period.year}
                </div>
              ))}

              <div className="border-r border-t border-slate-300 p-1 font-semibold">Uhrazeno</div>
              {payments.map((p, i) => (
                <div key={i} className="border-r border-t border-slate-300 p-1 text-right px-2 tabular-nums">
                  {formatNumber(p.paid, 0)}
                </div>
              ))}

              <div className="border-r border-t border-slate-300 p-1 font-semibold">Předpis</div>
              {payments.map((p, i) => (
                <div key={i} className="border-r border-t border-slate-300 p-1 text-right px-2 tabular-nums">
                  {formatNumber(p.prescribed, 0)}
                </div>
              ))}
            </div>
            <div className="flex border-b border-slate-300 text-xs mt-2">
              <div className="w-[90px] p-1 font-semibold text-slate-700">Celkem</div>
              <div className="flex-1 text-right p-1 font-semibold tabular-nums">
                Nedoplatek za rok celkem: {formatNumber(data.totals.result)} Kč
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.readings.length > 0 && (
        <div className="mt-6 border-t border-slate-300 print:border-black pt-4">
          <h3 className="font-semibold mb-2">Stavy měřidel</h3>
          <div className="rounded-md border border-slate-300 overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="text-left p-2">Služba</th>
                <th className="text-left p-2">Číslo měřidla</th>
                <th className="text-right p-2">Počáteční stav</th>
                <th className="text-right p-2">Konečný stav</th>
                <th className="text-right p-2">Spotřeba</th>
              </tr>
            </thead>
            <tbody>
              {data.readings.map((r, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-2">{r.service}</td>
                  <td className="p-2">{r.meterId}</td>
                  <td className="text-right p-2 tabular-nums">{formatNumber(r.startValue)}</td>
                  <td className="text-right p-2 tabular-nums">{formatNumber(r.endValue)}</td>
                  <td className="text-right p-2 font-semibold tabular-nums">{formatNumber(r.consumption)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-slate-300 print:border-black text-[10px] text-slate-600 space-y-2">
        <p>
          Jednotková cena za m3 vody činila v roce {data.period.year} dle ceníku BVaK 105,53 Kč. Hodnota uvedená ve vyúčtování již zahrnuje
          rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.
        </p>
        <p>
          Případné reklamace uplatněte výhradně písemnou (elektronickou) formou na adrese správce (viz záhlaví) nejpozději do 30 dnů od
          doručení vyúčtování včetně případné změny Vašeho osobního účtu pro vyplacení přeplatku.
        </p>
        <p>Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.</p>
      </div>

      <div className="mt-4 flex justify-between text-[10px] text-slate-500">
        <div>Datum: {format(new Date(), 'd.M.yyyy')}</div>
        <div>info@adminreal.cz | mobil: 607 959 876</div>
        <div className="text-right">www.adminreal.cz | www.onlinesprava.cz</div>
      </div>
    </div>
  )
}
