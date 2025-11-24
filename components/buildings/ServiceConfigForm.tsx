'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// DYNAMICKÝ ENGINE - Typy datových zdrojů
const DATA_SOURCE_TYPES = [
  { value: 'METER_DATA', label: '📊 Podle měřidel', description: 'Rozúčtování podle naměřených spotřeb (voda, teplo, elektřina)' },
  { value: 'UNIT_ATTRIBUTE', label: '📐 Podle atributu jednotky', description: 'Podle vlastnického podílu nebo výměry' },
  { value: 'PERSON_MONTHS', label: '👨‍👩‍👧‍👦 Podle osobo-měsíců', description: 'Podle počtu osob bydlících v jednotce' },
  { value: 'UNIT_COUNT', label: '🏠 Rovným dílem', description: 'Stejná částka na každou jednotku (1/N)' },
  { value: 'FIXED_AMOUNT', label: '💰 Fixní částka', description: 'Pevná částka na jednotku (např. Kč/byt)' },
  { value: 'NONE', label: '🚫 Nevyúčtovávat', description: 'Služba se nerozúčtovává (např. Fond oprav)' },
]

// Datové zdroje pro typ METER_DATA
const METER_DATA_SOURCES = [
  { value: 'VODOMER_SV', label: 'Vodoměry SV', unit: 'm³', description: 'Studená voda' },
  { value: 'VODOMER_TUV', label: 'Vodoměry TUV', unit: 'm³', description: 'Teplá užitková voda' },
  { value: 'TEPLO', label: 'Teplo', unit: 'GJ nebo kWh', description: 'Ústřední vytápění' },
  { value: 'ELEKTROMER', label: 'Elektroměry', unit: 'kWh', description: 'Elektřina' },
]

// Atributy jednotky pro typ UNIT_ATTRIBUTE
const UNIT_ATTRIBUTES = [
  { value: 'VLASTNICKY_PODIL', label: 'Vlastnický podíl', description: 'Podle zlomku vlastnictví (čitatel/jmenovatel)' },
  { value: 'CELKOVA_VYMERA', label: 'Celková výměra', description: 'Podle celkové plochy jednotky v m²' },
  { value: 'PODLAHOVA_VYMERA', label: 'Podlahová výměra', description: 'Podle podlahové plochy v m²' },
  { value: 'POCET_OBYVATEL', label: 'Počet obyvatel', description: 'Podle počtu osob registrovaných v jednotce' },
]

interface ServiceConfigFormProps {
  buildingId: string
  service: {
    id: string
    name: string
    code: string
    methodology: string
    dataSourceType?: string | null
    dataSourceName?: string | null
    dataSourceColumn?: string | null
    unitAttributeName?: string | null
    measurementUnit?: string | null
    unitPrice?: number | null
    fixedAmountPerUnit?: number | null
    advancePaymentColumn?: string | null
    showOnStatement: boolean
    isActive: boolean
    order: number
  }
}

export default function ServiceConfigForm({ buildingId, service }: ServiceConfigFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: service.name || '',
    code: service.code || '',
    methodology: service.methodology || 'OWNERSHIP_SHARE',
    
    // NOVÁ POLE PRO DYNAMICKÝ ENGINE
    dataSourceType: service.dataSourceType || '',
    dataSourceName: service.dataSourceName || '',
    dataSourceColumn: service.dataSourceColumn || 'consumption',
    unitAttributeName: service.unitAttributeName || '',
    
    measurementUnit: service.measurementUnit || '',
    unitPrice: service.unitPrice?.toString() || '',
    fixedAmountPerUnit: service.fixedAmountPerUnit?.toString() || '',
    advancePaymentColumn: service.advancePaymentColumn || '',
    showOnStatement: service.showOnStatement !== false,
    isActive: service.isActive !== false,
    order: service.order?.toString() || '0',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/buildings/${buildingId}/services/${service.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          methodology: formData.methodology,
          
          // NOVÁ POLE
          dataSourceType: formData.dataSourceType || null,
          dataSourceName: formData.dataSourceName || null,
          dataSourceColumn: formData.dataSourceColumn || null,
          unitAttributeName: formData.unitAttributeName || null,
          
          measurementUnit: formData.measurementUnit || null,
          unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : null,
          fixedAmountPerUnit: formData.fixedAmountPerUnit ? parseFloat(formData.fixedAmountPerUnit) : null,
          advancePaymentColumn: formData.advancePaymentColumn || null,
          showOnStatement: formData.showOnStatement,
          isActive: formData.isActive,
          order: parseInt(formData.order),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Nepodařilo se uložit změny')
      }

      router.push(`/buildings/${buildingId}?tab=invoices`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 border border-gray-200 dark:border-slate-700">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Základní informace */}
        <div className="border-b border-gray-200 dark:border-slate-700 pb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">📝</span>
            Základní údaje
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                Název služby *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-shadow"
                placeholder="např. Teplo, Vodné a stočné, Správa"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                Kód služby *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-shadow font-mono"
                placeholder="např. TEPLO, TUV, SPRAVA"
              />
            </div>
          </div>
        </div>

        {/* DYNAMICKÝ VÝPOČETNÍ ENGINE */}
        <div className="border-b border-gray-200 dark:border-slate-700 pb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">🔧</span>
            Dynamický výpočetní engine
          </h2>
          
          <div className="space-y-6">
            {/* Typ datového zdroje */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">
                Typ výpočtu *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DATA_SOURCE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      formData.dataSourceType === type.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dataSourceType"
                      value={type.value}
                      checked={formData.dataSourceType === type.value}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dataSourceType: e.target.value,
                        dataSourceName: '',
                        unitAttributeName: ''
                      })}
                      className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-bold text-gray-900 dark:text-white">{type.label}</div>
                      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* METER_DATA nastavení */}
            {formData.dataSourceType === 'METER_DATA' && (
              <div className="space-y-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  ⚙️ Nastavení datového zdroje měřidel
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">
                      Zdroj dat *
                    </label>
                    <select
                      value={formData.dataSourceName}
                      onChange={(e) => setFormData({ ...formData, dataSourceName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      required
                      aria-label="Zdroj dat pro měřidla"
                    >
                      <option value="">Vyberte zdroj dat...</option>
                      {METER_DATA_SOURCES.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label} ({source.unit}) - {source.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">
                      Sloupec / Hodnota
                    </label>
                    <select
                      value={formData.dataSourceColumn}
                      onChange={(e) => setFormData({ ...formData, dataSourceColumn: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      aria-label="Sloupec hodnoty z měřidel"
                    >
                      <option value="consumption">Spotřeba za období</option>
                      <option value="currentReading">Aktuální stav</option>
                      <option value="previousReading">Předchozí stav</option>
                    </select>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      Jakou hodnotu z měřidla použít pro výpočet
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* UNIT_ATTRIBUTE nastavení */}
            {formData.dataSourceType === 'UNIT_ATTRIBUTE' && (
              <div className="space-y-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800">
                <h3 className="font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                  ⚙️ Nastavení atributu jednotky
                </h3>
                
                <div>
                  <label className="block text-sm font-bold text-green-900 dark:text-green-200 mb-2">
                    Atribut jednotky *
                  </label>
                  <select
                    value={formData.unitAttributeName}
                    onChange={(e) => setFormData({ ...formData, unitAttributeName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-green-200 dark:border-green-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white"
                    required
                    aria-label="Atribut jednotky"
                  >
                    <option value="">Vyberte atribut...</option>
                    {UNIT_ATTRIBUTES.map((attr) => (
                      <option key={attr.value} value={attr.value}>
                        {attr.label} - {attr.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* FIXED_AMOUNT nastavení */}
            {formData.dataSourceType === 'FIXED_AMOUNT' && (
              <div className="space-y-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800">
                <h3 className="font-bold text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                  ⚙️ Nastavení fixní částky
                </h3>
                
                <div>
                  <label className="block text-sm font-bold text-yellow-900 dark:text-yellow-200 mb-2">
                    Fixní částka na jednotku (Kč/byt)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fixedAmountPerUnit}
                    onChange={(e) => setFormData({ ...formData, fixedAmountPerUnit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                    placeholder="např. 500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zálohy */}
        <div className="border-b border-gray-200 dark:border-slate-700 pb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">💰</span>
            Zálohy
          </h2>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
              Sloupec záloh v předpisu
            </label>
            <input
              type="text"
              value={formData.advancePaymentColumn}
              onChange={(e) => setFormData({ ...formData, advancePaymentColumn: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-shadow"
              placeholder="např. TEPLO, TUV, SPRAVA"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
              Kód sloupce z předpisu záloh, ze kterého se načítají úhrady za tuto službu
            </p>
          </div>
        </div>

        {/* Další nastavení */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg">⚙️</span>
            Další nastavení
          </h2>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={formData.showOnStatement}
                  onChange={(e) => setFormData({ ...formData, showOnStatement: e.target.checked })}
                  className="peer h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-slate-600 rounded transition-all"
                  aria-label="Zobrazit na výpisu"
                />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Zobrazit na výpisu pro vlastníky</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="peer h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-slate-600 rounded transition-all"
                  aria-label="Služba aktivní"
                />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Služba je aktivní</span>
            </label>
          </div>

          <div className="w-32">
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
              Pořadí
            </label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white transition-shadow"
              aria-label="Pořadí služby"
            />
          </div>
        </div>

        {/* Chyba */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* Tlačítka */}
        <div className="flex gap-4 pt-8 border-t border-gray-200 dark:border-slate-700">
          <button
            type="submit"
            disabled={saving}
            className="bg-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saving ? 'Ukládám...' : 'Uložit změny'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Zrušit
          </button>
        </div>
      </form>
    </div>
  )
}
