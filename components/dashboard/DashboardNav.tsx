'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Session } from 'next-auth'
import { ThemeToggle } from '@/components/ThemeToggle'

interface DashboardNavProps {
  session: Session
}

export default function DashboardNav({ session }: DashboardNavProps) {
  return (
    <nav className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center group">
              <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors">
                <svg className="h-6 w-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Vyúčtování<span className="text-teal-600 dark:text-teal-400">Online</span>
              </span>
            </Link>

            <div className="hidden md:flex ml-10 space-x-2">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/buildings"
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                Domy
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {session.user.role === 'ADMIN' && 'Administrátor'}
                {session.user.role === 'MANAGER' && 'Správce SVJ'}
                {session.user.role === 'OWNER' && 'Vlastník'}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Odhlásit
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
