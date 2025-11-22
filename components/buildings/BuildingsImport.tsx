'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BuildingsImport() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('Opravdu chcete importovat domy z tohoto souboru?')) return

    const formData = new FormData()
    formData.append('file', file)

    setLoading(true)
    try {
      const res = await fetch('/api/buildings/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import selhal')
      }

      const result = await res.json()
      alert(`Import dokončen.\nVytvořeno: ${result.created}\nAktualizováno: ${result.updated}\nChyby: ${result.errors}`)
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
      // Reset input
      e.target.value = ''
    }
  }

  return (
    <label className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer">
      {loading ? (
        <span>Importuji...</span>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importovat domy z Excelu
        </>
      )}
      <input
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleFileChange}
        disabled={loading}
      />
    </label>
  )
}
