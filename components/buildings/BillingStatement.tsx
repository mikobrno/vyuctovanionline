'use client'

import { useState } from 'react'

interface BillingStatementProps {
  billingResult: {
    id: string
    totalCost: number
    totalAdvancePrescribed: number
    totalAdvancePaid: number
    repairFund: number
    result: number
    isPaid: boolean
    unit: {
      name: string
      unitNumber: string
      variableSymbol: string | null
      ownerships: Array<{
        owner: {
          firstName: string
          lastName: string
          address: string | null
          email: string | null
          phone: string | null
        }
      }>
    }
    serviceCosts: Array<{
      id: string
      buildingTotalCost: number
      buildingConsumption: number | null
      unitConsumption: number | null
      unitCost: number
      unitAdvance: number
      unitBalance: number
      unitPricePerUnit: number | null
      unitAssignedUnits: number | null
      distributionBase: string | null
      calculationBasis: string | null
      service: {
        name: string
        code: string
        measurementUnit: string | null
      }
    }>
  }
  period: number
  buildingName: string
  buildingAddress: string
  buildingId: string
}

export default function BillingStatement({ billingResult, period, buildingName, buildingAddress, buildingId }: BillingStatementProps) {
  const owner = billingResult.unit.ownerships[0]?.owner
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendingSms, setSendingSms] = useState(false)
  const [smsSuccess, setSmsSuccess] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)

  const handleDownloadPDF = async () => {
    window.open(`/api/buildings/${buildingId}/billing/${billingResult.id}/pdf`, '_blank')
  }

  const handleSendEmail = async () => {
    if (!owner?.email) {
      setSendError('Vlastník nemá vyplněný email')
      return
    }

    try {
      setSending(true)
      setSendError(null)
      
      const response = await fetch(`/api/buildings/${buildingId}/billing/${billingResult.id}/send-email`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Nepodařilo se odeslat email')
      }

      setSendSuccess(true)
      setTimeout(() => setSendSuccess(false), 3000)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Nepodařilo se odeslat email')
    } finally {
      setSending(false)
    }
  }

  const handleSendSms = async () => {
    if (!owner?.phone) {
      setSmsError('Vlastník nemá vyplněné telefonní číslo')
      return
    }

    try {
      setSendingSms(true)
      setSmsError(null)
      
      const response = await fetch(`/api/buildings/${buildingId}/billing/${billingResult.id}/send-sms`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Nepodařilo se odeslat SMS')
      }

      setSmsSuccess(true)
      setTimeout(() => setSmsSuccess(false), 3000)
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : 'Nepodařilo se odeslat SMS')
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <div className="bg-white p-8 max-w-5xl mx-auto shadow-lg">
      {/* Hlavička */}
      <div className="flex justify-between mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{buildingName}</h1>
          <p className="text-sm text-gray-600">{buildingAddress}</p>
        </div>
        <div className="text-right">
          {owner && (
            <>
              <p className="font-semibold text-gray-900">{owner.firstName} {owner.lastName}</p>
              {owner.address && <p className="text-sm text-gray-600">{owner.address}</p>}
              {owner.email && <p className="text-sm text-gray-600">{owner.email}</p>}
            </>
          )}
        </div>
      </div>

      {/* Info panel */}
      <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded">
        <div>
          <span className="text-xs text-gray-500 uppercase">Jednotka</span>
          <p className="font-semibold text-gray-900">{billingResult.unit.name}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Variabilní symbol</span>
          <p className="font-semibold text-gray-900">{billingResult.unit.variableSymbol || '-'}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Období</span>
          <p className="font-semibold text-gray-900">Rok {period}</p>
        </div>
      </div>

      {/* Nadpis vyúčtování */}
      <h2 className="text-xl font-bold text-center mb-6 text-gray-900">
        Vyúčtování služeb: {period}
      </h2>

      {/* Tabulka služeb */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="text-left p-2 font-semibold text-gray-900">Položka</th>
              <th className="text-left p-2 font-semibold text-gray-900">Jednotka</th>
              <th className="text-right p-2 font-semibold text-gray-900">Náklad</th>
              <th className="text-right p-2 font-semibold text-gray-900">Jednotek</th>
              <th className="text-right p-2 font-semibold text-gray-900">Kč/jedn</th>
              <th className="text-right p-2 font-semibold text-gray-900">Jednotek připadá</th>
              <th className="text-right p-2 font-semibold text-gray-900">Náklad</th>
              <th className="text-right p-2 font-semibold text-gray-900">Úhrada</th>
              <th className="text-right p-2 font-semibold text-gray-900">Přeplatek/nedoplatek</th>
            </tr>
          </thead>
          <tbody>
            {billingResult.serviceCosts.map((sc) => (
              <tr key={sc.id} className="border-b hover:bg-gray-50">
                <td className="p-2 text-gray-900">{sc.service.name}</td>
                <td className="p-2 text-gray-600">{sc.distributionBase || sc.service.measurementUnit || '-'}</td>
                <td className="p-2 text-right font-semibold text-gray-900">
                  {sc.buildingTotalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-600">
                  {sc.buildingConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
                </td>
                <td className="p-2 text-right text-gray-600">
                  {sc.unitPricePerUnit?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
                </td>
                <td className="p-2 text-right text-gray-600">
                  {sc.unitConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || 
                   sc.unitAssignedUnits?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
                </td>
                <td className="p-2 text-right font-semibold text-gray-900">
                  {sc.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-600">
                  {sc.unitAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className={`p-2 text-right font-semibold ${
                  sc.unitBalance > 0 ? 'text-green-600' : sc.unitBalance < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {sc.unitBalance.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            
            {/* Fond oprav */}
            {billingResult.repairFund > 0 && (
              <tr className="border-b hover:bg-gray-50">
                <td className="p-2 text-gray-900">Fond oprav</td>
                <td className="p-2 text-gray-600">na byt</td>
                <td className="p-2 text-right font-semibold text-gray-900">
                  {billingResult.repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-600">100,00</td>
                <td className="p-2 text-right text-gray-600">
                  {(billingResult.repairFund / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-600">100</td>
                <td className="p-2 text-right font-semibold text-gray-900">
                  {billingResult.repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-600">0,00</td>
                <td className="p-2 text-right font-semibold text-red-600">
                  {billingResult.repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {/* Celkem */}
            <tr className="bg-gray-100 font-bold">
              <td className="p-2 text-gray-900">Celkem náklady na odbërná místa:</td>
              <td className="p-2"></td>
              <td className="p-2 text-right text-gray-900">
                {billingResult.totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
            </tr>

            {/* Přeplatek celkem */}
            <tr className="bg-blue-50 font-bold">
              <td className="p-2 text-gray-900" colSpan={8}>
                {billingResult.result >= 0 ? 'PŘEPLATEK CELKEM' : 'NEDOPLATEK CELKEM'}
              </td>
              <td className={`p-2 text-right text-lg ${
                billingResult.result >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(billingResult.result).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tabulka měsíčních úhrad */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-900">Přehled úhrad za rok {period}</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              {['1/'+period, '2/'+period, '3/'+period, '4/'+period, '5/'+period, '6/'+period, '7/'+period, '8/'+period, '9/'+period, '10/'+period, '11/'+period, '12/'+period].map(month => (
                <th key={month} className="border p-2 text-center text-gray-900">{month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {Array.from({ length: 12 }, (_, i) => {
                // TODO: Načíst skutečné zálohy z AdvancePaymentRecord
                const monthlyAdvance = billingResult.totalAdvancePrescribed / 12
                return (
                  <td key={i} className="border p-2 text-center text-gray-900">
                    {monthlyAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 0 })} Kč
                  </td>
                )
              })}
            </tr>
            <tr className="bg-gray-50">
              <td colSpan={12} className="border p-2 text-gray-900">
                <strong>K uhradě od roku</strong>
              </td>
            </tr>
            <tr>
              {Array.from({ length: 12 }, (_, i) => {
                const monthlyAdvance = billingResult.totalAdvancePrescribed / 12
                return (
                  <td key={i} className="border p-2 text-center text-gray-900">
                    {monthlyAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 0 })} Kč
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Měřené služby */}
      {billingResult.serviceCosts.some(sc => sc.unitConsumption !== null) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Měřené služby</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-900">Služba</th>
                <th className="border p-2 text-center text-gray-900">Období</th>
                <th className="border p-2 text-center text-gray-900">Měřidlo</th>
                <th className="border p-2 text-right text-gray-900">Poč.stav</th>
                <th className="border p-2 text-right text-gray-900">Kon.stav</th>
                <th className="border p-2 text-right text-gray-900">Spotřeba</th>
              </tr>
            </thead>
            <tbody>
              {billingResult.serviceCosts
                .filter(sc => sc.unitConsumption !== null)
                .map((sc) => (
                  <tr key={sc.id}>
                    <td className="border p-2 text-gray-900">{sc.service.name}</td>
                    <td className="border p-2 text-center text-gray-600">
                      1.1.{period} - 31.12.{period}
                    </td>
                    <td className="border p-2 text-center text-gray-600">
                      {sc.service.measurementUnit || '-'}
                    </td>
                    <td className="border p-2 text-right text-gray-600">
                      {/* TODO: Načíst skutečný počáteční stav */}
                      0,00
                    </td>
                    <td className="border p-2 text-right text-gray-600">
                      {/* TODO: Načíst skutečný koncový stav */}
                      {sc.unitConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2 text-right font-semibold text-gray-900">
                      {sc.unitConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upozornění o platbě */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          {billingResult.result < 0 ? (
            <>
              <strong>Přeplatek Vám bude vyplacen na číslo účtu {billingResult.unit.variableSymbol || 'registrované u správce'}.</strong>
            </>
          ) : (
            <>
              <strong>Případné reklamace uplatněte písemnou formou na adrese správce (viz. záhlaví) nejpozději do 30 dnů od doručení vyúčtování</strong>, 
              jinak se vyúčtování považuje za akceptované a účinné rozhodné v uplaceném období.
            </>
          )}
        </p>
      </div>

      {/* Poznámky */}
      <div className="text-xs text-gray-600 space-y-1 mb-6">
        <p>Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.</p>
        <p>Datum: {new Date().toLocaleDateString('cs-CZ')}</p>
      </div>

      {/* Tlačítka akcí */}
      <div className="flex gap-4 pt-4 border-t print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
        >
          🖨️ Vytisknout
        </button>
        <button
          onClick={handleSendEmail}
          disabled={sending || !owner?.email}
          className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {sending ? '⏳ Odesílám...' : sendSuccess ? '✓ Odesláno' : '📧 Odeslat e-mailem'}
        </button>
        <button
          onClick={handleSendSms}
          disabled={sendingSms || !owner?.phone}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {sendingSms ? '⏳ Odesílám...' : smsSuccess ? '✓ Odesláno' : '📱 Odeslat SMS'}
        </button>
        <button
          onClick={handleDownloadPDF}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold"
        >
          📄 Stáhnout PDF
        </button>
        {sendError && (
          <div className="ml-4 text-red-600 flex items-center">
            ⚠️ {sendError}
          </div>
        )}
        {sendSuccess && (
          <div className="ml-4 text-green-600 flex items-center">
            ✓ Email úspěšně odeslán
          </div>
        )}
        {smsError && (
          <div className="ml-4 text-red-600 flex items-center">
            ⚠️ {smsError}
          </div>
        )}
        {smsSuccess && (
          <div className="ml-4 text-green-600 flex items-center">
            ✓ SMS úspěšně odeslána
          </div>
        )}
      </div>
    </div>
  )
}
