'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CalculationEngineTest from './CalculationEngineTest'
import BillingGenerator from './BillingGenerator'
import BillingResultsViewer from './BillingResultsViewer'
import BuildingOverview from './BuildingOverview'
import ServiceConfigTable from './ServiceConfigTable'
 

interface BuildingDetailTabsProps {
  building: any
  uniqueOwners: any[]
  payments: any[]
  tab: string
}

function ImportInvoicesWidget({ buildingId, buildingName }: { buildingId: string; buildingName: string }) {
  const [file, setFile] = useState('vyuctovani2024 (20).xlsx')
  const [sheet, setSheet] = useState('faktury')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runImport = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)
      const url = `/api/buildings/${buildingId}/import/invoices?file=${encodeURIComponent(file)}&sheet=${encodeURIComponent(sheet)}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Import selhal')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Chyba importu')
    } finally {
      setLoading(false)
    }
  }

  const runLoadFormulas = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)
      const url = `/api/buildings/${buildingId}/import/formulas?file=${encodeURIComponent(file)}&sheet=${encodeURIComponent(sheet)}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Načtení vzorců selhalo')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Chyba načítání vzorců')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <div>
          <label className="block text-sm font-medium text-gray-900">Soubor v public</label>
          <input
            className="mt-1 w-80 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-primary focus:border-primary"
            value={file}
            onChange={(e) => setFile(e.target.value)}
            placeholder="vyuctovani2024 (19).xlsx"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900">List</label>
          <input
            className="mt-1 w-48 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-primary focus:border-primary"
            value={sheet}
            onChange={(e) => setSheet(e.target.value)}
            placeholder="faktury"
          />
        </div>
        <button
          onClick={runImport}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-60 transition-colors"
        >
          {loading ? 'Importuji…' : 'Načíst faktury z public'}
        </button>
        <button
          onClick={runLoadFormulas}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Načítám…' : 'Načíst vzorce z Excelu'}
        </button>
        <button
          onClick={async () => {
            try {
              setLoading(true)
              setError(null)
              setResult(null)
              const url = `/api/import/public/complete?file=${encodeURIComponent(file)}&buildingName=${encodeURIComponent(buildingName)}`
              const res = await fetch(url, { method: 'POST' })
              const data = await res.json()
              if (!res.ok) throw new Error(data?.error || 'Plný import selhal')
              setResult(data)
            } catch (e: any) {
              setError(e.message || 'Chyba plného importu')
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Probíhá…' : 'Plný import z public'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 text-sm text-gray-900">
          {result.updated !== undefined ? (
             <div>
               <div className="font-medium text-green-700 mb-1">✅ Vzorce úspěšně načteny</div>
               <div>Aktualizováno služeb: <span className="font-medium">{result.updated}</span></div>
               {result.details && (
                 <div className="mt-2 text-xs text-gray-600 max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                   {result.details.map((d: any, i: number) => (
                     <div key={i} className="flex justify-between py-0.5 border-b border-gray-100 last:border-0">
                       <span>{d.name}</span>
                       <span className="font-mono text-gray-800">{d.method}</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          ) : (
             <>
              <div>List: <span className="font-medium">{result.sheet}</span></div>
              <div>Období: <span className="font-medium">{result.period}</span></div>
              <div>Služby: vytvořeno {result.services?.created ?? 0}, existující {result.services?.existing ?? 0} (celkem {result.services?.total ?? 0})</div>
              <div>Náklady: vytvořeno {result.costs?.created ?? 0} (celkem {result.costs?.total ?? 0})</div>
             </>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 list-disc ml-6 text-yellow-800">
              {result.warnings.map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function BuildingDetailTabs({ building, uniqueOwners, payments, tab }: BuildingDetailTabsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [showUnitFilter, setShowUnitFilter] = useState(false)

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
  const buildingServices = building?.services || []

  const [servicesState, setServicesState] = useState<any[]>(buildingServices)
  useEffect(() => { setServicesState(buildingServices) }, [buildingServices])

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
                  tab === 'person_months' ? 'jednotky...' :
                  'odečty...'
                }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
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
                    ? 'border-primary bg-teal-50 text-primary-hover'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filtr jednotek
                  {selectedUnits.size > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-primary rounded-full">
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
                    className="text-xs text-primary hover:text-primary-hover font-medium"
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
                {buildingUnits.map((unit: any) => (
                  <label
                    key={unit.id}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUnits.has(unit.id)}
                      onChange={() => toggleUnit(unit.id)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900 font-medium">
                      {unit.unitNumber}
                    </span>
                  </label>
                ))}
              </div>
              {selectedUnits.size > 0 && (
                <p className="mt-3 text-xs text-gray-900">
                  Vybráno {selectedUnits.size} z {buildingUnits.length} jednotek
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
                tab === 'person_months' ? filteredUnits.length :
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

      {/* PŘEHLED A NASTAVENÍ */}
      {tab === 'overview' && (
        <BuildingOverview building={building} />
      )}

      {/* JEDNOTKY */}
      {tab === 'units' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Jednotky v domě</h2>
            <Link
              href={`/units/new?buildingId=${building.id}`}
              className="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-hover transition-colors text-sm"
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
                          className="text-primary hover:text-primary-hover mr-4"
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
                const ownerUnits = buildingUnits.filter((unit: any) => 
                  unit.ownerships.some((o: any) => o.ownerId === owner.id)
                )
                return (
                  <div key={owner.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-10 w-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <p className="text-primary font-medium mt-2">
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

            {/* Import faktur z public */}
            <div className="mb-6 border border-teal-200 bg-teal-50 rounded-lg p-4">
              <ImportInvoicesWidget buildingId={building.id} buildingName={building.name} />
            </div>
            
            {/* Nová tabulka nastavení služeb */}
            <ServiceConfigTable 
              buildingId={building.id}
              services={servicesState}
              units={buildingUnits}
              costs={buildingCosts}
            />
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Náklad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">ID</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reading.precalculatedCost ? `${reading.precalculatedCost.toLocaleString('cs-CZ')} Kč` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reading.note || '-'}
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

      {/* POČET OSOB (OSOBO-MĚSÍCE) */}
      {tab === 'person_months' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Počet osob v jednotkách</h2>
            <div className="text-sm text-gray-900">
              Importováno ze záložky Evidence (sloupce N, O, P)
            </div>
          </div>
          
          <div className="mb-6 bg-teal-50 border border-teal-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">📊 Jak funguje výpočet osobo-měsíců?</h3>
            <ul className="text-sm text-gray-900 space-y-1">
              <li>• <strong>Počet osob</strong> (sloupec N) - kolik osob bydlí v jednotce</li>
              <li>• <strong>Evidence od</strong> (sloupec O) - od kdy jsou osoby evidovány</li>
              <li>• <strong>Evidence do</strong> (sloupec P) - do kdy jsou osoby evidovány</li>
              <li>• Systém automaticky vypočítá osobo-měsíce pro každý měsíc v období</li>
              <li>• Použití: Rozúčtování služeb podle počtu osob (např. voda, odvoz odpadu)</li>
            </ul>
          </div>

          {filteredUnits.length === 0 ? (
            <p className="text-gray-900 text-center py-8">
              {searchTerm ? 'Žádné jednotky nenalezeny' : 'Zatím nejsou žádné jednotky'}
            </p>
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
                  <div key={unit.id} className="border border-gray-200 rounded-lg p-6 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Jednotka {unit.unitNumber}
                        </h3>
                        {unit.ownerships[0] && (
                          <p className="text-sm text-gray-900">
                            {unit.ownerships[0].owner.firstName} {unit.ownerships[0].owner.lastName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-900">Aktuální počet osob</div>
                        <div className="text-2xl font-bold text-primary">
                          {unit.residents || 0}
                        </div>
                      </div>
                    </div>

                    {personMonths.length === 0 ? (
                      <div className="text-center py-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-900 text-sm">
                          Zatím nejsou importována data o počtu osob pro tuto jednotku
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {years.map(year => {
                          const yearMonths = groupedByYear[year].sort((a: any, b: any) => a.month - b.month)
                          const totalPersonMonths = yearMonths.reduce((sum: number, pm: any) => sum + pm.personCount, 0)
                          
                          return (
                            <div key={year} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900">Rok {year}</h4>
                                <div className="text-sm text-gray-900">
                                  Celkem: <span className="font-bold text-primary">{totalPersonMonths}</span> osobo-měsíců
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-12 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                                  const monthData = yearMonths.find((pm: any) => pm.month === month)
                                  const personCount = monthData?.personCount || 0
                                  const hasData = !!monthData
                                  
                                  return (
                                    <div 
                                      key={month}
                                      className={`text-center p-2 rounded ${
                                        hasData 
                                          ? 'bg-teal-100 border border-teal-300' 
                                          : 'bg-gray-50 border border-gray-200'
                                      }`}
                                    >
                                      <div className="text-xs text-gray-900 mb-1">
                                        {month}.
                                      </div>
                                      <div className={`text-lg font-bold ${
                                        hasData ? 'text-primary' : 'text-gray-400'
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
                className="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-hover transition-colors text-sm"
              >
                📊 Import vyúčtování
              </Link>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 text-center">
            <svg className="h-16 w-16 text-primary mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            
            <div className="mt-6 border-t border-teal-200 pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Nebo importovat z Excelu</h4>
              <p className="text-gray-900 mb-4 text-sm">
                Nahrajte Excel soubor s kompletním vyúčtováním (faktury, odečty, platby)
              </p>
              <Link
                href={`/billing/import?buildingId=${building.id}`}
                className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors"
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
          </div>
          
          <AdvancesMatrix buildingId={building.id} />
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
                  const shareNum = unit.shareNumerator ?? 0
                  const shareDen = unit.shareDenominator === 0 ? 1 : (unit.shareDenominator ?? 1)
                  const ownershipPercent = ((shareNum / shareDen) * 100).toFixed(3)
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
                        <div className="font-medium text-gray-900">{(unit.totalArea ?? 0).toFixed(2)} m²</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{(unit.floorArea ?? 0).toFixed(2)} m²</div>
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
                    {filteredUnits.reduce((sum: number, u: any) => {
                      const sn = u.shareNumerator ?? 0
                      const sd = u.shareDenominator === 0 ? 1 : (u.shareDenominator ?? 1)
                      return sum + (sn / sd)
                    }, 0).toFixed(3)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + (u.totalArea ?? 0), 0).toFixed(2)} m²
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {filteredUnits.reduce((sum: number, u: any) => sum + (u.floorArea ?? 0), 0).toFixed(2)} m²
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

      {/* Test výpočetního enginu */}
      {tab === 'calc_test' && (
        <CalculationEngineTest
          buildingId={building.id}
          services={buildingServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            dataSourceType: s.dataSourceType,
            dataSourceName: s.dataSourceName,
            unitAttributeName: s.unitAttributeName,
          }))}
        />
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

  async function load() {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při načítání')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [buildingId, year])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <label className="text-sm font-medium text-gray-700">Rok:</label>
        <input 
          type="number" 
          value={year} 
          onChange={(e) => setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))} 
          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-primary focus:border-primary" 
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  JEDNOTKA
                </th>
                {services.map((s) => (
                  <th key={s.id} className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">
                    {s.name}
                  </th>
                ))}
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky right-0 z-10">
                  CELKEM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {units.map((u) => {
                const unitRowTotals = services.reduce((sum, s) => sum + (data[u.id]?.[s.id]?.total || 0), 0)
                
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-10 border-r border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-base">{u.unitNumber}</span>
                        {u.variableSymbol && <span className="text-xs text-gray-400">VS: {u.variableSymbol}</span>}
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
                              className="w-24 px-2 py-1.5 border border-gray-200 rounded text-center text-sm text-gray-900 focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                              defaultValue={monthlyVal}
                              onBlur={async (e) => {
                                const val = parseFloat(e.target.value)
                                if (isNaN(val)) return
                                try { await updateAllMonths(u.id, s.id, val) } catch (err) { alert(err instanceof Error ? err.message : 'Uložení selhalo') }
                              }}
                            />
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-gray-400">
                                {total > 0 ? `${total.toLocaleString('cs-CZ')} Kč` : '-'}
                              </span>
                              {paidSrv > 0 && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  uhrazeno {paidSrv.toLocaleString('cs-CZ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 sticky right-0 bg-white hover:bg-gray-50 z-10 border-l border-gray-100">
                      {unitRowTotals.toLocaleString('cs-CZ')} Kč
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-md border border-blue-100 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Změna částky v poli automaticky přepočítá předpis pro všech 12 měsíců.</span>
      </div>
    </div>
  )
}

