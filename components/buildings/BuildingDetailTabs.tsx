'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import BillingGenerator from './BillingGenerator'
import BillingResultsViewer from './BillingResultsViewer'
import BuildingOverview from './BuildingOverview'
import BillingSettingsEditor from './BillingSettingsEditor'
import { BuildingTemplates } from './BuildingTemplates'
import ServiceMappingUploader from './ServiceMappingUploader'
 

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

  const buildingServices = building?.services || []
  const [servicesState, setServicesState] = useState<any[]>(buildingServices)
  useEffect(() => { setServicesState(buildingServices) }, [buildingServices])

  // Kontrola, zda building existuje
  if (!building) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Budova nebyla nalezena.</p>
      </div>
    )
  }

  // Bezpečné přístupy k properties - s fallbackem
  const buildingUnits = building?.units || []
  const buildingCosts = building?.costs || []

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
    setSelectedUnits(new Set(buildingUnits.map((u: any) => u.id)))
  }

  // Zrušit výběr všech jednotek
  const clearAllUnits = () => {
    setSelectedUnits(new Set())
  }

  // Filtrování jednotek
  const filteredUnits = buildingUnits.filter((unit: any) => {
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
  const filteredCosts = buildingCosts.filter((cost: any) => {
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
    const readings = buildingUnits.flatMap((unit: any) => 
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
      {tab !== 'billing' && tab !== 'settings' && tab !== 'overview' && tab !== 'results' && tab !== 'templates' && (
        <div className="mb-6 space-y-3 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
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
                  tab === 'person_months' ? 'jednotky...' :
                  'odečty...'
                }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl leading-5 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  title="Vymazat hledání"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-900 dark:hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Tlačítko pro filtr jednotek */}
            {tab !== 'owners' && tab !== 'invoices' && (
              <button
                onClick={() => setShowUnitFilter(!showUnitFilter)}
                className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
                  showUnitFilter || selectedUnits.size > 0
                    ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600'
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
            <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vyberte jednotky</h3>
                <div className="flex gap-3">
                  <button
                    onClick={selectAllUnits}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    Vybrat vše
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={clearAllUnits}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                  >
                    Zrušit výběr
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                {buildingUnits.map((unit: any) => (
                  <label
                    key={unit.id}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                      selectedUnits.has(unit.id)
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUnits.has(unit.id)}
                      onChange={() => toggleUnit(unit.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded dark:bg-slate-700"
                    />
                    <span className={`text-sm font-medium ${
                      selectedUnits.has(unit.id)
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {unit.unitNumber}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PŘEHLED A NASTAVENÍ */}
      {tab === 'overview' && (
        <BuildingOverview building={building} />
      )}

      {/* JEDNOTKY */}
      {tab === 'units' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Jednotky v domě</h2>
            <Link
              href={`/units/new?buildingId=${building.id}`}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Přidat jednotku
            </Link>
          </div>
          {filteredUnits.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                {searchTerm ? 'Žádné jednotky nenalezeny' : 'Zatím nejsou žádné jednotky'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jednotka</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vlastník</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Výměra</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Podíl</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">VS</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredUnits.map((unit: any) => (
                      <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                              {unit.unitNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {unit.ownerships[0] ? (
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {unit.ownerships[0].owner.email}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Bez vlastníka
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {unit.totalArea} m²
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {unit.shareNumerator}/{unit.shareDenominator}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 px-2 py-1 rounded">
                            {unit.variableSymbol}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            <Link
                              href={`/units/${unit.id}`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                            >
                              Detail
                            </Link>
                            <Link
                              href={`/units/${unit.id}/edit`}
                              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            >
                              Upravit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VLASTNÍCI */}
      {tab === 'owners' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Vlastníci v domě</h2>
          </div>
          {filteredOwners.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                {searchTerm ? 'Žádní vlastníci nenalezeni' : 'Zatím nejsou žádní vlastníci'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOwners.map((owner: any) => {
                const ownerUnits = buildingUnits.filter((unit: any) => 
                  unit.ownerships.some((o: any) => o.ownerId === owner.id)
                )
                return (
                  <div key={owner.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {ownerUnits.length} {ownerUnits.length === 1 ? 'jednotka' : ownerUnits.length < 5 ? 'jednotky' : 'jednotek'}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {owner.firstName} {owner.lastName}
                    </h3>
                    
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      {owner.email && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          {owner.email}
                        </div>
                      )}
                      {owner.phone && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {owner.phone}
                        </div>
                      )}
                      {owner.address && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {owner.address}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Jednotky</p>
                      <div className="flex flex-wrap gap-2">
                        {ownerUnits.map((u: any) => (
                          <span key={u.id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                            {u.unitNumber}
                          </span>
                        ))}
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
          {/* Faktury (náklady) */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">🧾 Faktury (náklady)</h2>
            </div>
            {filteredCosts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                  {searchTerm ? 'Žádné faktury nenalezeny' : 'Zatím nejsou žádné faktury'}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Služba</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Částka</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datum faktury</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Období</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {filteredCosts.map((cost: any) => (
                        <tr key={cost.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {cost.service?.name || 'Neznámá služba'}
                            </div>
                            {cost.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cost.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {cost.amount.toLocaleString('cs-CZ')} Kč
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(cost.invoiceDate).toLocaleDateString('cs-CZ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              {cost.period}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ODEČTY MĚŘIDEL */}
      {(tab === 'hot_water' || tab === 'cold_water' || tab === 'heating') && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {tab === 'hot_water' && '💧 Odečty TUV'}
              {tab === 'cold_water' && '❄️ Odečty SV'}
              {tab === 'heating' && '🔥 Odečty topení'}
            </h2>
          </div>
          {(() => {
            const meterType = tab === 'hot_water' ? 'HOT_WATER' : tab === 'cold_water' ? 'COLD_WATER' : 'HEATING'
            const filteredReadings = getFilteredReadings(meterType)

            return filteredReadings.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                  {searchTerm ? 'Žádné odečty nenalezeny' : 'Zatím nejsou žádné odečty'}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jednotka</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Měřidlo</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datum</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodnota</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Spotřeba</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Náklad</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Poznámka</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {filteredReadings.map((reading: any) => (
                        <tr key={reading.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                              {reading.unit.unitNumber}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {reading.meter.serialNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(reading.readingDate).toLocaleDateString('cs-CZ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {reading.value}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {reading.consumption !== undefined && reading.consumption !== null ? Number(reading.consumption).toFixed(3) : 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {reading.precalculatedCost ? `${reading.precalculatedCost.toLocaleString('cs-CZ')} Kč` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 italic">
                            {reading.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* PLATBY */}
      {tab === 'payments' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Platby vlastníků</h2>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                {searchTerm ? 'Žádné platby nenalezeny' : 'Zatím nejsou žádné platby'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jednotka</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Částka</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datum platby</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">VS</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Období</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredPayments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                            {payment.unit.unitNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            +{payment.amount.toLocaleString('cs-CZ')} Kč
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(payment.paymentDate).toLocaleDateString('cs-CZ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {payment.variableSymbol}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            {payment.period}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POČET OSOB (OSOBO-MĚSÍCE) */}
      {tab === 'person_months' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Počet osob v jednotkách</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
              Importováno ze záložky Evidence (sloupce N, O, P)
            </div>
          </div>
          
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6">
            <div className="flex gap-4">
              <div className="shrink-0">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Jak funguje výpočet osobo-měsíců?</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• <strong>Počet osob</strong> (sloupec N) - kolik osob bydlí v jednotce</li>
                  <li>• <strong>Evidence od</strong> (sloupec O) - od kdy jsou osoby evidovány</li>
                  <li>• <strong>Evidence do</strong> (sloupec P) - do kdy jsou osoby evidovány</li>
                  <li>• Systém automaticky vypočítá osobo-měsíce pro každý měsíc v období</li>
                  <li>• Použití: Rozúčtování služeb podle počtu osob (např. voda, odvoz odpadu)</li>
                </ul>
              </div>
            </div>
          </div>

          {filteredUnits.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                {searchTerm ? 'Žádné jednotky nenalezeny' : 'Zatím nejsou žádné jednotky'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredUnits.map((unit: any) => {
                const personMonths = unit.personMonths || []
                
                // Seskupit podle roku
                const groupedByYear = personMonths.reduce((acc: any, pm: any) => {
                  if (!acc[pm.year]) acc[pm.year] = []
                  acc[pm.year].push(pm)
                  return acc
                }, {})
                
                // Získat roky v sestupném pořadí
                const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a)
                
                return (
                  <div key={unit.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg">
                          {unit.unitNumber}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Jednotka {unit.unitNumber}
                          </h3>
                          {unit.ownerships[0] && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Aktuální počet osob</div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {unit.residents || 0}
                        </div>
                      </div>
                    </div>

                    {personMonths.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-600">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          Zatím nejsou importována data o počtu osob pro tuto jednotku
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {years.map(year => {
                          const yearMonths = groupedByYear[year].sort((a: any, b: any) => a.month - b.month)
                          const totalPersonMonths = yearMonths.reduce((sum: number, pm: any) => sum + pm.personCount, 0)
                          
                          return (
                            <div key={year} className="bg-gray-50 dark:bg-slate-700/30 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  Rok {year}
                                </h4>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-600 px-3 py-1 rounded-lg shadow-sm">
                                  Celkem: <span className="font-bold text-blue-600 dark:text-blue-400">{totalPersonMonths}</span> osobo-měsíců
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                                  const monthData = yearMonths.find((pm: any) => pm.month === month)
                                  const personCount = monthData?.personCount || 0
                                  const hasData = !!monthData
                                  
                                  return (
                                    <div 
                                      key={month}
                                      className={`text-center p-3 rounded-lg transition-all ${
                                        hasData 
                                          ? 'bg-white dark:bg-slate-600 shadow-sm border border-blue-100 dark:border-blue-900/30' 
                                          : 'bg-gray-100/50 dark:bg-slate-700/50 border border-transparent'
                                      }`}
                                    >
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-medium">
                                        {new Date(2000, month - 1, 1).toLocaleString('cs-CZ', { month: 'short' })}
                                      </div>
                                      <div className={`text-xl font-bold ${
                                        hasData ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
                                      }`}>
                                        {personCount}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}



      {/* PŘEDPIS PO MĚSÍCI */}
      {tab === 'advances' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Měsíční předpis záloh</h2>
          </div>
          
          <AdvancesMatrix buildingId={building.id} />
        </div>
      )}

      {/* PARAMETRY */}
      {tab === 'parameters' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Parametry jednotek pro výpočet</h2>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              Přehled všech parametrů jednotek používaných při výpočtu vyúčtování (vlastnický podíl, plocha, počet osob).
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jednotka</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vlastník</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Podíl</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plocha celkem</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Podlahová pl.</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Počet osob</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Osobo-měsíce</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Měřidla</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {filteredUnits.map((unit: any) => {
                    const ownership = unit.ownerships[0]
                    const shareNum = unit.shareNumerator ?? 0
                    const shareDen = unit.shareDenominator === 0 ? 1 : (unit.shareDenominator ?? 1)
                    const ownershipPercent = ((shareNum / shareDen) * 100).toFixed(3)
                    const activeMeters = unit.meters.filter((m: any) => m.isActive)
                    const personMonths = unit.personMonths?.reduce((sum: number, pm: any) => sum + pm.personCount, 0) || 0
                    
                    return (
                      <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{unit.unitNumber}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">VS: {unit.variableSymbol}</div>
                        </td>
                        <td className="px-6 py-4">
                          {ownership ? (
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {ownership.owner.firstName} {ownership.owner.lastName}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Bez vlastníka</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-gray-900 dark:text-white">{ownershipPercent}%</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{unit.shareNumerator}/{unit.shareDenominator}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-medium text-gray-900 dark:text-gray-300">{(unit.totalArea ?? 0).toFixed(2)} m²</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-gray-900 dark:text-gray-300">{(unit.floorArea ?? 0).toFixed(2)} m²</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-blue-600 dark:text-blue-400">{unit.residents || 0}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-medium text-gray-900 dark:text-gray-300">{personMonths}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-wrap gap-1.5 justify-center">
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
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 text-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-help" 
                                  title={`${meter.type}: ${meter.serialNumber}`}
                                >
                                  {typeIcons[meter.type] || '📊'}
                                </span>
                              )
                            })}
                            {activeMeters.length === 0 && (
                              <span className="text-gray-400 text-xs italic">Bez měřidel</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-slate-800/80 font-semibold border-t border-gray-200 dark:border-slate-700">
                  <tr>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">CELKEM</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{filteredUnits.length} jednotek</td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {filteredUnits.reduce((sum: number, u: any) => {
                        const sn = u.shareNumerator ?? 0
                        const sd = u.shareDenominator === 0 ? 1 : (u.shareDenominator ?? 1)
                        return sum + (sn / sd)
                      }, 0).toFixed(3)}%
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {filteredUnits.reduce((sum: number, u: any) => sum + (u.totalArea ?? 0), 0).toFixed(2)} m²
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {filteredUnits.reduce((sum: number, u: any) => sum + (u.floorArea ?? 0), 0).toFixed(2)} m²
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {filteredUnits.reduce((sum: number, u: any) => sum + (u.residents || 0), 0)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {filteredUnits.reduce((sum: number, u: any) => {
                        const pm = u.personMonths?.reduce((s: number, p: any) => s + p.personCount, 0) || 0
                        return sum + pm
                      }, 0)}
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Vlastnický podíl
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Používá se pro výpočet nákladů podle podílu (elektřina, pojištění, fond oprav).</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Plochy
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Celková plocha pro teplo, podlahová pro specifické služby. Zahrnuje i sklepy.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Osoby
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Osobo-měsíce zohledňují změny počtu osob v průběhu roku (výtah, odpad).</p>
            </div>
          </div>
        </div>
      )}

      {/* ŠABLONY */}
      {tab === 'templates' && (
        <BuildingTemplates
          buildingId={building.id}
          initialSubject={building.emailTemplateSubject}
          initialBody={building.emailTemplateBody}
          initialSmsBody={building.smsTemplateBody}
        />
      )}

      {/* Nastavení */}
      {tab === 'settings' && (
        <div className="space-y-8">
          {/* Mapování služeb */}
          <ServiceMappingUploader 
            buildingId={building.id}
            buildingName={building.name}
            hasMapping={building.services?.some((s: any) => s.advancePaymentColumn)}
            services={building.services?.map((s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              excelColumn: s.excelColumn,
              advancePaymentColumn: s.advancePaymentColumn,
              isActive: s.isActive
            })) || []}
          />
          
          <div>
            <BillingSettingsEditor 
              buildingId={building.id}
              building={building}
              services={servicesState}
              units={buildingUnits}
              costs={buildingCosts}
            />
          </div>

        </div>
      )}

      {/* Generování vyúčtování */}
      {tab === 'billing' && (
        <BillingGenerator
          buildingId={building.id}
          buildingName={building.name}
          services={buildingServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
          }))}
          costs={buildingCosts.map((c: any) => ({
            period: c.period,
            serviceId: c.serviceId,
            amount: c.amount,
          }))}
        />
      )}

      {/* Výsledky vyúčtování */}
      {tab === 'results' && <BillingResultsViewerWrapper buildingId={building.id} />}
    </div>
  )
}

// Wrapper pro BillingResultsViewer s načítáním dat
function BillingResultsViewerWrapper({ buildingId }: { buildingId: string }) {
  const [billingPeriods, setBillingPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBillingPeriods() {
      try {
        setLoading(true)
        const response = await fetch(`/api/buildings/${buildingId}/billing-periods`)
        if (!response.ok) throw new Error('Failed to load billing periods')
        const data = await response.json()
        setBillingPeriods(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadBillingPeriods()
  }, [buildingId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Načítám vyúčtování...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Chyba: {error}</p>
      </div>
    )
  }

  return <BillingResultsViewer buildingId={buildingId} billingPeriods={billingPeriods} />
}

// Nový modul matice předpisů
function AdvancesMatrix({ buildingId }: { buildingId: string }) {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [data, setData] = useState<Record<string, Record<string, { months: number[]; total: number }>>>({})
  const [paid, setPaid] = useState<Record<string, Record<string, number>>>({})
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<Record<string, { prescribed: number[]; payments: number[]; persons: number[] }>>({})
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/buildings/${buildingId}/advances?year=${year}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || 'Nepodařilo se načíst předpisy')
      setUnits(json.units)
      setServices(json.services)
      setData(json.data)
      setPaid(json.paidByUnitService || {})
      setMonthlyBreakdown(json.monthlyBreakdown || {})
      setSelectedUnitId((current) => {
        if (
          current &&
          Array.isArray(json.units) &&
          json.units.some((unit: { id: string }) => unit.id === current)
        ) {
          return current
        }
        return json.units[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při načítání')
    } finally {
      setLoading(false)
    }
  }, [buildingId, year])

  useEffect(() => { load() }, [load])

  const updateAllMonths = async (unitId: string, serviceId: string, amount: number) => {
    const res = await fetch(`/api/buildings/${buildingId}/advances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, serviceId, year, amount, mode: 'all' })
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.message || 'Uložení selhalo')
    }
    // Refresh
    await load()
  }

  if (loading) return <div className="text-gray-500 p-4">Načítám předpisy…</div>
  if (error) return <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">{error}</div>

  if (units.length === 0 || services.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Zatím nejsou k dispozici předpisy</h3>
        <p className="text-sm text-gray-900">Zadejte je ručně nebo je importujte z Excelu.</p>
      </div>
    )
  }

  const monthLabels = Array.from({ length: 12 }, (_, index) =>
    new Date(2000, index, 1).toLocaleString('cs-CZ', { month: 'short' })
  )

  const selectedStats = selectedUnitId && monthlyBreakdown[selectedUnitId]
    ? monthlyBreakdown[selectedUnitId]
    : {
        prescribed: Array(12).fill(0),
        payments: Array(12).fill(0),
        persons: Array(12).fill(0)
      }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <label htmlFor="advances-year" className="text-sm font-medium text-gray-700 dark:text-gray-300">Rok:</label>
        <input 
          id="advances-year"
          type="number" 
          value={year} 
          onChange={(e) => setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))} 
          className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-blue-500 focus:border-blue-500" 
          aria-label="Rok předpisu"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  JEDNOTKA
                </th>
                {services.map((s) => (
                  <th key={s.id} className="px-4 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                    {s.name}
                  </th>
                ))}
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-slate-800 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  CELKEM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {units.map((u) => {
                const unitRowTotals = services.reduce((sum, s) => sum + (data[u.id]?.[s.id]?.total || 0), 0)
                
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/30 z-10 border-r border-gray-100 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex flex-col">
                        <span className="text-base font-bold">{u.unitNumber}</span>
                        {u.variableSymbol && <span className="text-xs text-gray-400 font-mono">VS: {u.variableSymbol}</span>}
                      </div>
                    </td>
                    {services.map((s) => {
                      const cell = data[u.id]?.[s.id]
                      const total = cell?.total || 0
                      const paidSrv = paid[u.id]?.[s.id] || 0
                      const monthlyVal = cell ? Math.round((total / 12) * 100) / 100 : 0
                      
                      return (
                        <td key={s.id} className="px-4 py-3 align-middle">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              className="w-24 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-center text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              defaultValue={monthlyVal}
                              onBlur={async (e) => {
                                const val = parseFloat(e.target.value)
                                if (isNaN(val)) return
                                try { await updateAllMonths(u.id, s.id, val) } catch (err) { alert(err instanceof Error ? err.message : 'Uložení selhalo') }
                              }}
                              aria-label={`Měsíční předpis ${u.unitNumber} – ${s.name}`}
                            />
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {total > 0 ? `${total.toLocaleString('cs-CZ')} Kč` : '-'}
                              </span>
                              {paidSrv > 0 && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  uhrazeno {paidSrv.toLocaleString('cs-CZ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white sticky right-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/30 z-10 border-l border-gray-100 dark:border-slate-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {unitRowTotals.toLocaleString('cs-CZ')} Kč
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Změna částky v poli automaticky přepočítá předpis pro všech 12 měsíců.</span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Kontrola úhrad, předpisů a osob po měsících</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Součet všech služeb za vybranou jednotku pro snadné porovnání.</p>
          </div>
          <select
            value={selectedUnitId ?? ''}
            onChange={(e) => setSelectedUnitId(e.target.value || null)}
            className="min-w-[180px] px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            aria-label="Vyberte jednotku pro kontrolu předpisu"
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unitNumber}
              </option>
            ))}
          </select>
        </div>

        {selectedUnitId ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Měsíc</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Předpis</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Úhrady</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Rozdíl</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Počet osob</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {monthLabels.map((label, index) => {
                  const prescribed = selectedStats.prescribed[index] || 0
                  const paidValue = selectedStats.payments[index] || 0
                  const persons = selectedStats.persons[index] || 0
                  const diff = paidValue - prescribed
                  const diffColor = diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'

                  return (
                    <tr key={label}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{label}</td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{prescribed.toLocaleString('cs-CZ')} Kč</td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{paidValue.toLocaleString('cs-CZ')} Kč</td>
                      <td className={`px-4 py-2 text-right font-semibold ${diffColor}`}>{diff.toLocaleString('cs-CZ')} Kč</td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{persons}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-slate-800 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">Celkem</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {selectedStats.prescribed.reduce((sum, value) => sum + value, 0).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {selectedStats.payments.reduce((sum, value) => sum + value, 0).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(selectedStats.payments.reduce((a, b) => a + b, 0) - selectedStats.prescribed.reduce((a, b) => a + b, 0)).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {selectedStats.persons.reduce((sum, value) => sum + value, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Vyberte jednotku pro zobrazení detailu.</p>
        )}
      </div>
    </div>
  )
}

