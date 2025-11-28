'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BillingPeriodActionsProps {
  billingPeriodId: string
  year: number
  buildingName: string
  resultsCount: number
}

export default function BillingPeriodActions({
  billingPeriodId,
  year,
  buildingName,
  resultsCount,
}: BillingPeriodActionsProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/billing-periods/${billingPeriodId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Chyba při mazání vyúčtování')
        return
      }

      alert(data.message || 'Vyúčtování bylo smazáno')
      router.refresh()
    } catch (error) {
      console.error('Delete billing period error:', error)
      alert('Nepodařilo se smazat vyúčtování')
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Smazat vyúčtování"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center">
              <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smazat vyúčtování?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Akce je nevratná</p>
              </div>
            </div>

            <p className="mb-6 text-gray-900 dark:text-gray-200">
              Opravdu chcete smazat vyúčtování za rok <strong>{year}</strong> pro dům <strong>{buildingName}</strong>?
              <br />
              <span className="text-sm text-red-600 dark:text-red-400">
                Budou odstraněny i všechny výsledky ({resultsCount}) a navázané náklady služeb.
              </span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                disabled={deleting}
              >
                Zrušit
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Mazání...' : 'Smazat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
