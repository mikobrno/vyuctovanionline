'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CALCULATION_METHODS = [
  { value: 'OWNERSHIP_SHARE', label: 'Vlastnický podíl', description: 'Podle zlomku vlastnictví (čitatel/jmenovatel)' },
  { value: 'AREA', label: 'Podle výměry', description: 'Podle celkové plochy v m²' },
  { value: 'PERSON_MONTHS', label: 'Podle osobo-měsíců', description: 'Podle počtu osob v jednotce' },
  { value: 'METER_READING', label: 'Podle odečtů měřidel', description: 'Podle spotřeby naměřené měřidly' },
  { value: 'FIXED_PER_UNIT', label: 'Fixní částka na jednotku', description: 'Pevná částka na byt/jednotku (např. Kč/byt)' },
  { value: 'EQUAL_SPLIT', label: 'Rovným dílem', description: 'Stejná částka pro všechny jednotky (1/N)' },
  { value: 'CUSTOM', label: 'Vlastní vzorec', description: 'Pokročilé nastavení' },
]

interface ServiceConfigFormProps {
  buildingId: string
  service: any
}

export default function ServiceConfigForm({ buildingId, service }: ServiceConfigFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: service.name || '',
    code: service.code || '',
    methodology: service.methodology || 'OWNERSHIP_SHARE',
    measurementUnit: service.measurementUnit || '',
    unitPrice: service.unitPrice?.toString() || '',
    fixedAmountPerUnit: service.fixedAmountPerUnit?.toString() || '',
    advancePaymentColumn: service.advancePaymentColumn || '',
    showOnStatement: service.showOnStatement !== false,
    isActive: service.isActive !== false,
    order: service.order?.toString() || '0',
  })

  const selectedMethod = CALCULATION_METHODS.find(m => m.value === formData.methodology)

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="např. TEPLO, TUV, SPRAVA"
              />
            </div>
          </div>
        </div>

        {/* Způsob výpočtu */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Způsob rozúčtování</h2>
          
          <div className="space-y-3">
            {CALCULATION_METHODS.map((method) => (
              <label
                key={method.value}
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.methodology === method.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="methodology"
                  value={method.value}
                  checked={formData.methodology === method.value}
                  onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3 flex-1">
                  <div className="font-medium text-gray-900">{method.label}</div>
                  <div className="text-sm text-gray-900 mt-1">{method.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Specifické nastavení podle způsobu */}
        {selectedMethod && (
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Nastavení pro: {selectedMethod.label}
            </h2>

            {/* Pro měřidla */}
            {formData.methodology === 'METER_READING' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Jednotka měření
                  </label>
                  <select
                    value={formData.measurementUnit}
                    onChange={(e) => setFormData({ ...formData, measurementUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Vyberte jednotku...</option>
                    <option value="m³">m³ (kubické metry)</option>
                    <option value="kWh">kWh (kilowatthodiny)</option>
                    <option value="GJ">GJ (gigajouly)</option>
                    <option value="ks">ks (kusy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Jednotková cena (Kč za jednotku)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="např. 35.50"
                  />
                  <p className="mt-1 text-sm text-gray-900">
                    Automaticky vypočteno: Náklad služby / Celková spotřeba domu
                  </p>
                </div>
              </div>
            )}

            {/* Pro fixní částku na jednotku */}
            {formData.methodology === 'FIXED_PER_UNIT' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Fixní částka na jednotku (Kč/byt)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fixedAmountPerUnit}
                  onChange={(e) => setFormData({ ...formData, fixedAmountPerUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="např. 500.00"
                />
                <p className="mt-1 text-sm text-gray-900">
                  Tato částka bude účtována každé jednotce stejně (např. 500 Kč/byt)
                </p>
              </div>
            )}

            {/* Pro výměru */}
            {formData.methodology === 'AREA' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Výpočet:</strong> (Náklad služby / Celková výměra domu) × Výměra jednotky
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Systém automaticky použije výměru každé jednotky v m²
                </p>
              </div>
            )}

            {/* Pro vlastnický podíl */}
            {formData.methodology === 'OWNERSHIP_SHARE' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Výpočet:</strong> Náklad služby × (Čitatel podílu / Jmenovatel podílu)
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Systém automaticky použije vlastnický podíl každé jednotky (např. 100/10000)
                </p>
              </div>
            )}

            {/* Pro osobo-měsíce */}
            {formData.methodology === 'PERSON_MONTHS' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Výpočet:</strong> (Náklad služby / Celkem osobo-měsíců domu) × Osobo-měsíce jednotky
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Systém sečte počet osob v jednotce za každý měsíc roku
                </p>
              </div>
            )}

            {/* Pro rovný díl */}
            {formData.methodology === 'EQUAL_SPLIT' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Výpočet:</strong> Náklad služby / Počet jednotek
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Všechny jednotky platí stejnou částku
                </p>
              </div>
            )}
          </div>
        )}

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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              />
              <span className="text-sm text-gray-900">Zobrazit na výpisu pro vlastníky</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
