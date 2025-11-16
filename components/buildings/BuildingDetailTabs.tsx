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
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [showUnitFilter, setShowUnitFilter] = useState(false)

  // Toggle výběr jednotky
  const toggleUnit = (unitId: string) => {
    const newSelected = new Set(selectedUnits)
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId)
    } else {
      newSelected.add(unitId)
    }
    setSelectedUnits(newSelected)
  }

  // Vybrat všechny jednotky
  const selectAllUnits = () => {
    setSelectedUnits(new Set(building.units.map((u: any) => u.id)))
  }

  // Zrušit výběr všech jednotek
  const clearAllUnits = () => {
    setSelectedUnits(new Set())
  }

  // Filtrování jednotek
  const filteredUnits = building.units.filter((unit: any) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      unit.unitNumber.toLowerCase().includes(searchLower) ||
      unit.variableSymbol?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.firstName?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.lastName?.toLowerCase().includes(searchLower) ||
      unit.ownerships[0]?.owner?.email?.toLowerCase().includes(searchLower)
    )
    const matchesUnitFilter = selectedUnits.size === 0 || selectedUnits.has(unit.id)
    return matchesSearch && matchesUnitFilter
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
    const matchesSearch = (
      payment.unit.unitNumber.toLowerCase().includes(searchLower) ||
      payment.variableSymbol.toLowerCase().includes(searchLower) ||
      payment.description?.toLowerCase().includes(searchLower)
    )
    const matchesUnitFilter = selectedUnits.size === 0 || selectedUnits.has(payment.unit.id)
    return matchesSearch && matchesUnitFilter
  })

  // Filtrování odečtů podle typu měřidla
  const getFilteredReadings = (meterType: string) => {
    const readings = building.units.flatMap((unit: any) => 
      unit.meters.filter((m: any) => m.type === meterType).flatMap((meter: any) => 
        meter.readings.map((r: any) => ({ ...r, unit, meter }))
      )
    )
    
    const searchLower = searchTerm.toLowerCase()
    return readings.filter((reading: any) => {
      const matchesSearch = (
        reading.unit.unitNumber.toLowerCase().includes(searchLower) ||
        reading.meter.serialNumber.toLowerCase().includes(searchLower) ||
        reading.note?.toLowerCase().includes(searchLower)
      )
      const matchesUnitFilter = selectedUnits.size === 0 || selectedUnits.has(reading.unit.id)
      return matchesSearch && matchesUnitFilter
    })
  }

  return (
    <div>
      {/* Vyhledávací pole a filtry */}
      {tab !== 'billing' && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
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
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  title="Vymazat hledání"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Tlačítko pro filtr jednotek */}
            {tab !== 'owners' && tab !== 'invoices' && (
              <button
                onClick={() => setShowUnitFilter(!showUnitFilter)}
                className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                  showUnitFilter || selectedUnits.size > 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filtr jednotek
                  {selectedUnits.size > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                      {selectedUnits.size}
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>

          {/* Panel s filtrem jednotek */}
          {showUnitFilter && tab !== 'owners' && tab !== 'invoices' && (
            <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Vyberte jednotky</h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllUnits}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Vybrat vše
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={clearAllUnits}
                    className="text-xs text-gray-900 hover:text-gray-800 font-medium"
                  >
                    Zrušit výběr
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto">
                {building.units.map((unit: any) => (
                  <label
                    key={unit.id}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUnits.has(unit.id)}
                      onChange={() => toggleUnit(unit.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900 font-medium">
                      {unit.unitNumber}
                    </span>
                  </label>
                ))}
              </div>
              {selectedUnits.size > 0 && (
                <p className="mt-3 text-xs text-gray-900">
                  Vybráno {selectedUnits.size} z {building.units.length} jednotek
                </p>
              )}
            </div>
          )}

          {/* Počet výsledků */}
          {(searchTerm || selectedUnits.size > 0) && (
            <p className="text-sm text-gray-900">
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
            <p className="text-gray-900 text-center py-8">
              {searchTerm ? 'Žádné jednotky nenalezeny' : 'Zatím nejsou žádné jednotky'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Jednotka
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Vlastník
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Výměra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Podíl
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      VS
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">
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
                            <div className="text-sm text-gray-900">
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
                          className="text-gray-900 hover:text-gray-900"
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
            <p className="text-gray-900 text-center py-8">
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
                    <div className="text-sm text-gray-900 space-y-1">
                      {owner.email && <p>📧 {owner.email}</p>}
                      {owner.phone && <p>📱 {owner.phone}</p>}
                      {owner.address && <p className="text-xs">📍 {owner.address}</p>}
                      <p className="text-blue-600 font-medium mt-2">
                        Vlastní {ownerUnits.length} {ownerUnits.length === 1 ? 'jednotku' : ownerUnits.length < 5 ? 'jednotky' : 'jednotek'}
                      </p>
                      <div className="text-xs text-gray-900">
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
        <div className="space-y-6">
          {/* Služby a nastavení výpočtů */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">⚙️ Nastavení služeb a výpočtů</h2>
            </div>
            
            {building.services && building.services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {building.services.map((service: any) => {
                  const totalCost = building.costs
                    .filter((c: any) => c.serviceId === service.id)
                    .reduce((sum: number, c: any) => sum + c.amount, 0)
                  
                  const methodLabels: Record<string, string> = {
                    'OWNERSHIP_SHARE': '👥 Vlastnický podíl',
                    'AREA': '📐 Podle výměry',
                    'PERSON_MONTHS': '👨‍👩‍👧‍👦 Osobo-měsíce',
                    'METER_READING': '📊 Podle měřidel',
                    'FIXED_PER_UNIT': '💰 Fixní částka/byt',
                    'EQUAL_SPLIT': '🔄 Rovným dílem',
                    'CUSTOM': '🔧 Vlastní vzorec'
                  }
                  
                  return (
                    <div key={service.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          <p className="text-sm text-gray-900 mt-1">
                            {methodLabels[service.methodology] || service.methodology}
                          </p>
                        </div>
                        <Link
                          href={`/buildings/${building.id}/services/${service.id}/edit`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          ⚙️ Nastavit
                        </Link>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {service.measurementUnit && (
                          <div className="flex justify-between">
                            <span className="text-gray-900">Jednotka:</span>
                            <span className="font-medium text-gray-900">{service.measurementUnit}</span>
                          </div>
                        )}
                        {service.fixedAmountPerUnit && (
                          <div className="flex justify-between">
                            <span className="text-gray-900">Částka/jednotku:</span>
                            <span className="font-medium text-gray-900">
                              {service.fixedAmountPerUnit.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                            </span>
                          </div>
                        )}
                        {service.advancePaymentColumn && (
                          <div className="flex justify-between">
                            <span className="text-gray-900">Sloupec záloh:</span>
                            <span className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                              {service.advancePaymentColumn}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-900">Celkový náklad:</span>
                          <span className="font-semibold text-blue-600">
                            {totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </span>
                        </div>
                        {!service.showOnStatement && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-800">
                            ⚠️ Skryto na výpisu
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-900 text-center py-8">
                Zatím nejsou definovány žádné služby
              </p>
            )}
          </div>

          {/* Faktury (náklady) */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">🧾 Faktury (náklady)</h2>
            </div>
            {filteredCosts.length === 0 ? (
              <p className="text-gray-900 text-center py-8">
                {searchTerm ? 'Žádné faktury nenalezeny' : 'Zatím nejsou žádné faktury'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Služba</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Částka</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Datum faktury</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Období</th>
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
              <p className="text-gray-900 text-center py-8">
                {searchTerm ? 'Žádné odečty nenalezeny' : 'Zatím nejsou žádné odečty'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Jednotka</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Měřidlo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Hodnota</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Spotřeba</th>
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
            <p className="text-gray-900 text-center py-8">
              {searchTerm ? 'Žádné platby nenalezeny' : 'Zatím nejsou žádné platby'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Jednotka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Částka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Datum platby</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">VS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Období</th>
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
            <div className="flex gap-3">
              <Link
                href={`/buildings/${building.id}/billing/calculate?year=${new Date().getFullYear()}`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
              >
                🧮 Vypočítat vyúčtování
              </Link>
              <Link
                href={`/billing/import?buildingId=${building.id}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
              >
                📊 Import vyúčtování
              </Link>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <svg className="h-16 w-16 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Vypočítat vyúčtování automaticky</h3>
            <p className="text-gray-900 mb-4">
              Systém automaticky rozpočítá náklady podle nastavených metod pro každou službu
            </p>
            <Link
              href={`/buildings/${building.id}/billing/calculate?year=${new Date().getFullYear()}`}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              🧮 Spustit výpočet vyúčtování
            </Link>
            {building._count.costs > 0 && (
              <div className="mt-4 text-sm text-gray-900">
                <p>✓ Náklady: {building._count.costs} záznamů</p>
              </div>
            )}
            
            <div className="mt-6 border-t border-blue-200 pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Nebo importovat z Excelu</h4>
              <p className="text-gray-900 mb-4 text-sm">
                Nahrajte Excel soubor s kompletním vyúčtováním (faktury, odečty, platby)
              </p>
              <Link
                href={`/billing/import?buildingId=${building.id}`}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                📊 Importovat z Excelu
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PŘEDPIS PO MĚSÍCI */}
      {tab === 'advances' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Měsíční předpis záloh</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm">
              📥 Import z Excelu
            </button>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <svg className="h-16 w-16 text-yellow-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tabulka předpisu záloh po měsících</h3>
            <p className="text-gray-900 mb-4">
              Zobrazuje, kolik měla každá jednotka platit za jednotlivé služby v každém měsíci roku.
            </p>
            <p className="text-sm text-gray-900 mb-4">
              Data se načítají z Excelu (list &quot;Předpis po měsíci&quot;) nebo se mohou zadávat ručně.
            </p>
            <div className="bg-white border border-yellow-300 rounded-lg p-4 text-left max-w-2xl mx-auto">
              <h4 className="font-semibold text-gray-900 mb-2">Příklad struktury:</h4>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-900">Jednotka</th>
                    <th className="px-3 py-2 text-left text-gray-900">Služba</th>
                    <th className="px-3 py-2 text-right text-gray-900">Leden</th>
                    <th className="px-3 py-2 text-right text-gray-900">Únor</th>
                    <th className="px-3 py-2 text-right text-gray-900">...</th>
                    <th className="px-3 py-2 text-right text-gray-900">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-gray-900">318/01</td>
                    <td className="px-3 py-2 text-gray-900">Vodné</td>
                    <td className="px-3 py-2 text-right text-gray-900">150 Kč</td>
                    <td className="px-3 py-2 text-right text-gray-900">150 Kč</td>
                    <td className="px-3 py-2 text-right text-gray-900">...</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">1 800 Kč</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                📥 Import předpisu z Excelu
              </button>
              <p className="text-xs text-gray-900 mt-2">
                Systém načte list &quot;Předpis po měsíci&quot; a automaticky vytvoří tabulku
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PARAMETRY */}
      {tab === 'parameters' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Parametry jednotek pro výpočet</h2>
          </div>
          
          <p className="text-gray-900 mb-4">
            Přehled všech parametrů jednotek používaných při výpočtu vyúčtování (vlastnický podíl, plocha, počet osob).
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">Jednotka</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">Vlastník</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Podíl</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Plocha celkem</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Podlahová pl.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Počet osob</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">Osobo-měsíce</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">Měřidla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUnits.map((unit: any) => {
                  const ownership = unit.ownerships[0]
                  const ownershipPercent = ((unit.shareNumerator / unit.shareDenominator) * 100).toFixed(3)
                  const activeMeters = unit.meters.filter((m: any) => m.isActive)
                  const personMonths = unit.personMonths?.reduce((sum: number, pm: any) => sum + pm.personCount, 0) || 0
                  
                  return (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{unit.unitNumber}</div>
                        <div className="text-xs text-gray-900">VS: {unit.variableSymbol}</div>
                      </td>
                      <td className="px-4 py-3">
                        {ownership ? (
                          <div className="text-sm text-gray-900">
                            {ownership.owner.firstName} {ownership.owner.lastName}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Bez vlastníka</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{ownershipPercent}%</div>
                        <div className="text-xs text-gray-900">{unit.shareNumerator}/{unit.shareDenominator}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{unit.totalArea.toFixed(2)} m²</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{unit.floorArea.toFixed(2)} m²</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{unit.residents || 0}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{personMonths}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {activeMeters.map((meter: any) => {
                            const typeIcons: Record<string, string> = {
                              'COLD_WATER': '❄️',
                              'HOT_WATER': '💧',
                              'HEATING': '🔥',
                              'ELECTRICITY': '⚡',
                              'GAS': '🔥'
                            }
                            return (
                              <span 
                                key={meter.id} 
                                className="inline-block text-lg" 
                                title={`${meter.type}: ${meter.serialNumber}`}
                              >
                                {typeIcons[meter.type] || '📊'}
                              </span>
                            )
                          })}
                          {activeMeters.length === 0 && (
                            <span className="text-gray-400 text-xs">Bez měřidel</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900">CELKEM</td>
                  <td className="px-4 py-3 text-gray-900">{filteredUnits.length} jednotek</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + (u.shareNumerator / u.shareDenominator), 0).toFixed(3)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + u.totalArea, 0).toFixed(2)} m²
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + u.floorArea, 0).toFixed(2)} m²
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + (u.residents || 0), 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => {
                      const pm = u.personMonths?.reduce((s: number, p: any) => s + p.personCount, 0) || 0
                      return sum + pm
                    }, 0)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">💡 Vysvětlení parametrů:</h3>
            <ul className="space-y-2 text-sm text-gray-900">
              <li><strong>Vlastnický podíl:</strong> Používá se pro výpočet nákladů podle podílu (elektřina, pojištění)</li>
              <li><strong>Plocha celkem:</strong> Celková plocha jednotky včetně sklepů a příslušenství</li>
              <li><strong>Podlahová plocha:</strong> Čistá obytná plocha bytu</li>
              <li><strong>Počet osob:</strong> Aktuální počet obyvatel v jednotce</li>
              <li><strong>Osobo-měsíce:</strong> Součet měsíců za rok (pro výpočet výtahu, úklidu podle osob)</li>
              <li><strong>Měřidla:</strong> Aktivní měřidla pro odečty (voda, teplo, elektřina)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
