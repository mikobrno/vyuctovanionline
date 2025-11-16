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
    <div className="bg-white rounded-lg shadow p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Základní informace */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Základní údaje</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Název služby *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-900"
                placeholder="např. Teplo, Vodné a stočné, Správa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Kód služby *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-900"
                placeholder="např. TEPLO, TUV, SPRAVA"
              />
            </div>
          </div>
        </div>

        {/* DYNAMICKÝ VÝPOČETNÍ ENGINE */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            🔧 Dynamický výpočetní engine
          </h2>
          
          <div className="space-y-4">
            {/* Typ datového zdroje */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Typ výpočtu *
              </label>
              <div className="space-y-2">
                {DATA_SOURCE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.dataSourceType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
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
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* METER_DATA nastavení */}
            {formData.dataSourceType === 'METER_DATA' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-gray-900">⚙️ Nastavení datového zdroje měřidel</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Zdroj dat *
                  </label>
                  <select
                    value={formData.dataSourceName}
                    onChange={(e) => setFormData({ ...formData, dataSourceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Sloupec / Hodnota
                  </label>
                  <select
                    value={formData.dataSourceColumn}
                    onChange={(e) => setFormData({ ...formData, dataSourceColumn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    aria-label="Sloupec hodnoty z měřidel"
                  >
                    <option value="consumption">Spotřeba za období</option>
                    <option value="currentReading">Aktuální stav</option>
                    <option value="previousReading">Předchozí stav</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-600">
                    Jakou hodnotu z měřidla použít pro výpočet
                  </p>
                </div>
              </div>
            )}

            {/* UNIT_ATTRIBUTE nastavení */}
            {formData.dataSourceType === 'UNIT_ATTRIBUTE' && (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-gray-900">⚙️ Nastavení atributu jednotky</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Atribut jednotky *
                  </label>
                  <select
                    value={formData.unitAttributeName}
                    onChange={(e) => setFormData({ ...formData, unitAttributeName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
              <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-gray-900">⚙️ Nastavení fixní částky</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Fixní částka na jednotku (Kč/byt)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fixedAmountPerUnit}
                    onChange={(e) => setFormData({ ...formData, fixedAmountPerUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-900"
                    placeholder="např. 500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zálohy */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Zálohy</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Sloupec záloh v předpisu
            </label>
            <input
              type="text"
              value={formData.advancePaymentColumn}
              onChange={(e) => setFormData({ ...formData, advancePaymentColumn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-900"
              placeholder="např. TEPLO, TUV, SPRAVA"
            />
            <p className="mt-1 text-sm text-gray-900">
              Kód sloupce z předpisu záloh, ze kterého se načítají úhrady za tuto službu
            </p>
          </div>
        </div>

        {/* Další nastavení */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Další nastavení</h2>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.showOnStatement}
                onChange={(e) => setFormData({ ...formData, showOnStatement: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Zobrazit na výpisu"
              />
              <span className="text-sm text-gray-900">Zobrazit na výpisu pro vlastníky</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Služba aktivní"
              />
              <span className="text-sm text-gray-900">Služba je aktivní</span>
            </label>
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Pořadí
            </label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              aria-label="Pořadí služby"
            />
          </div>
        </div>

        {/* Chyba */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Tlačítka */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Ukládám...' : 'Uložit změny'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Zrušit
          </button>
        </div>
      </form>
    </div>
  )
}
