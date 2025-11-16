'use client'

import { useState } from 'react'
import Link from 'next/link'

interface BuildingDetailTabsProps {
  building: any
  uniqueOwners: any[]
  payments: any[]
  tab: string
}

export default function BuildingDetailTabs({ building, uniqueOwners, payments, tab }: BuildingDetailTabsProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrování jednotek
  const filteredUnits = building.units.filter((unit: any) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      unit.unitNumber.toLowerCase().includes(searchLower) ||
      unit.variableSymbol?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.firstName?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.lastName?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.email?.toLowerCase().includes(searchLower)
    )
  })

  // Filtrování vlastníků
  const filteredOwners = uniqueOwners.filter((owner: any) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      owner.firstName.toLowerCase().includes(searchLower) ||
      owner.lastName.toLowerCase().includes(searchLower) ||
      owner.email?.toLowerCase().includes(searchLower) ||
      owner.phone?.toLowerCase().includes(searchLower)
    )
  })

  // Filtrování faktur
  const filteredCosts = building.costs.filter((cost: any) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      cost.service?.name?.toLowerCase().includes(searchLower) ||
      cost.description?.toLowerCase().includes(searchLower) ||
      cost.invoiceNumber?.toLowerCase().includes(searchLower)
    )
  })

  // Filtrování plateb
  const filteredPayments = payments.filter((payment: any) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      payment.unit.unitNumber.toLowerCase().includes(searchLower) ||
      payment.variableSymbol.toLowerCase().includes(searchLower) ||
      payment.description?.toLowerCase().includes(searchLower)
    )
  })

  // Filtrování odečtů podle typu měřidla
  const getFilteredReadings = (meterType: string) => {
    const readings = building.units.flatMap((unit: any) => 
      unit.meters.filter((m: any) => m.type === meterType).flatMap((meter: any) => 
        meter.readings.map((r: any) => ({ ...r, unit, meter }))
      )
    )
    
    const searchLower = searchTerm.toLowerCase()
    return readings.filter((reading: any) => 
      reading.unit.unitNumber.toLowerCase().includes(searchLower) ||
      reading.meter.serialNumber.toLowerCase().includes(searchLower) ||
      reading.note?.toLowerCase().includes(searchLower)
    )
  }

  return (
    <div>
      {/* Vyhledávací pole */}
      {tab !== 'billing' && (
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={`Hledat ${
                tab === 'units' ? 'jednotky...' :
                tab === 'owners' ? 'vlastníky...' :
                tab === 'invoices' ? 'faktury...' :
                tab === 'payments' ? 'platby...' :
                'odečty...'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-gray-500">
              Nalezeno: {
                tab === 'units' ? filteredUnits.length :
                tab === 'owners' ? filteredOwners.length :
                tab === 'invoices' ? filteredCosts.length :
                tab === 'payments' ? filteredPayments.length :
                getFilteredReadings(
                  tab === 'hot_water' ? 'HOT_WATER' : 
                  tab === 'cold_water' ? 'COLD_WATER' : 
                  'HEATING'
                ).length
              } záznamů
            </p>
          )}
        </div>
      )}

      {/* JEDNOTKY */}
      {tab === 'units' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Jednotky v domě</h2>
            <Link
              href={`/units/new?buildingId=${building.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              + Přidat jednotku
            </Link>
          </div>
          {filteredUnits.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Žádné jednotky nenalezeny' : 'Zatím nejsou žádné jednotky'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jednotka
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vlastník
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Výměra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Podíl
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      VS
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUnits.map((unit: any) => (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {unit.unitNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {unit.ownerships[0] ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {unit.ownerships[0].owner.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Bez vlastníka</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {unit.totalArea} m²
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {unit.shareNumerator}/{unit.shareDenominator}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {unit.variableSymbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/units/${unit.id}`}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Detail
                        </Link>
                        <Link
                          href={`/units/${unit.id}/edit`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Upravit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VLASTNÍCI */}
      {tab === 'owners' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Vlastníci v domě</h2>
          </div>
          {filteredOwners.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Žádní vlastníci nenalezeni' : 'Zatím nejsou žádní vlastníci'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOwners.map((owner: any) => {
                const ownerUnits = building.units.filter((unit: any) => 
                  unit.ownerships.some((o: any) => o.ownerId === owner.id)
                )
                return (
                  <div key={owner.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">
                      {owner.firstName} {owner.lastName}
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      {owner.email && <p>📧 {owner.email}</p>}
                      {owner.phone && <p>📱 {owner.phone}</p>}
                      {owner.address && <p className="text-xs">📍 {owner.address}</p>}
                      <p className="text-blue-600 font-medium mt-2">
                        Vlastní {ownerUnits.length} {ownerUnits.length === 1 ? 'jednotku' : ownerUnits.length < 5 ? 'jednotky' : 'jednotek'}
                      </p>
                      <div className="text-xs text-gray-500">
                        {ownerUnits.map((u: any) => u.unitNumber).join(', ')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* FAKTURY */}
      {tab === 'invoices' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Faktury (náklady)</h2>
          </div>
          {filteredCosts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Žádné faktury nenalezeny' : 'Zatím nejsou žádné faktury'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Služba</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Částka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum faktury</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Období</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCosts.map((cost: any) => (
                    <tr key={cost.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cost.service?.name || 'Neznámá služba'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cost.amount.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cost.invoiceDate).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cost.period}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ODEČTY MĚŘIDEL */}
      {(tab === 'hot_water' || tab === 'cold_water' || tab === 'heating') && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {tab === 'hot_water' && '💧 Odečty TUV'}
              {tab === 'cold_water' && '❄️ Odečty SV'}
              {tab === 'heating' && '🔥 Odečty topení'}
            </h2>
          </div>
          {(() => {
            const meterType = tab === 'hot_water' ? 'HOT_WATER' : tab === 'cold_water' ? 'COLD_WATER' : 'HEATING'
            const filteredReadings = getFilteredReadings(meterType)

            return filteredReadings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {searchTerm ? 'Žádné odečty nenalezeny' : 'Zatím nejsou žádné odečty'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jednotka</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Měřidlo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hodnota</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spotřeba</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReadings.map((reading: any) => (
                      <tr key={reading.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {reading.unit.unitNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reading.meter.serialNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(reading.readingDate).toLocaleDateString('cs-CZ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reading.value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                          {reading.consumption || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {/* PLATBY */}
      {tab === 'payments' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Platby vlastníků</h2>
          </div>
          {filteredPayments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Žádné platby nenalezeny' : 'Zatím nejsou žádné platby'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jednotka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Částka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum platby</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Období</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.unit.unitNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {payment.amount.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.paymentDate).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.variableSymbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.period}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VYÚČTOVÁNÍ */}
      {tab === 'billing' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Vyúčtování domu</h2>
            <Link
              href={`/billing/import?buildingId=${building.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              📊 Import vyúčtování
            </Link>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <svg className="h-16 w-16 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Import vyúčtování z Excelu</h3>
            <p className="text-gray-600 mb-4">
              Nahrajte Excel soubor s kompletním vyúčtováním (faktury, odečty, platby)
            </p>
            <Link
              href={`/billing/import?buildingId=${building.id}`}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              📊 Importovat vyúčtování
            </Link>
            {building._count.costs > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                <p>✓ Náklady: {building._count.costs} záznamů</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
