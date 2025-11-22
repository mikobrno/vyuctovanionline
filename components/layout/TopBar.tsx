'use client';

import { signOut } from 'next-auth/react';

interface TopBarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function TopBar({ user }: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 lg:left-64 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Menu">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
          <span className="font-medium text-gray-900">Kníničky 318 - Neptun</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="hidden md:flex items-center max-w-md flex-1 ml-4">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-colors"
              placeholder="Hledat nebo otevřít (Ctrl/Cmd + K)"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
            ONLINE
          </span>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2"></div>

        <button className="p-2 text-gray-400 hover:text-gray-500 relative" aria-label="Notifications">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'Uživatel'}</p>
            <p className="text-xs text-gray-500">Správce</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium text-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <button 
            onClick={() => signOut()}
            className="ml-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">ODHLÁSIT</span>
          </button>
        </div>
      </div>
    </header>
  );
}
