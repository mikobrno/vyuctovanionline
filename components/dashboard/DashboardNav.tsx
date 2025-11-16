'use client'

import { signOut } from 'next-auth/react'
import { Session } from 'next-auth'

interface DashboardNavProps {
  session: Session
}

export default function DashboardNav({ session }: DashboardNavProps) {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/dashboard" className="flex items-center">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="ml-2 text-xl font-bold text-gray-900">
                Vyúčtování Online
              </span>
            </a>

            <div className="hidden md:flex ml-10 space-x-4">
              <a
                href="/dashboard"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </a>
              <a
                href="/buildings"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Domy
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-gray-600">
                {session.user.role === 'ADMIN' && 'Administrátor'}
                {session.user.role === 'MANAGER' && 'Správce SVJ'}
                {session.user.role === 'OWNER' && 'Vlastník'}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Odhlásit
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
