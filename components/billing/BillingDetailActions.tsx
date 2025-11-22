"use client";

import React from 'react';

interface Props {
  buildingId: string;
  resultId: string;
}

export function BillingDetailActions({ buildingId, resultId }: Props) {
  const handleTestEmail = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'kost@onlinesprava.cz' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací email odeslán na kost@onlinesprava.cz!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleTestSms = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/billing/${resultId}/send-test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '777338203' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error)
      alert('Testovací SMS odeslána na 777338203!')
    } catch (e) {
      alert('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleTestEmail}
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Test Email
      </button>
      <button
        onClick={handleTestSms}
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      >
        Test SMS
      </button>
      <a 
        href={`/api/buildings/${buildingId}/billing/${resultId}/pdf`}
        target="_blank"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Stáhnout PDF
      </a>
    </div>
  );
}
