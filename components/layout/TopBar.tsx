'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { ThemeToggle } from '@/components/ThemeToggle';

interface TopBarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface Building {
  id: string;
  name: string;
}

export default function TopBar({ user }: TopBarProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBuildingId = (params?.id as string) || searchParams.get('buildingId');
  const currentBuilding = buildings.find(b => b.id === currentBuildingId);

  const filteredBuildings = buildings.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    fetch('/api/buildings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBuildings(data);
        }
      })
      .catch(err => console.error('Failed to load buildings', err));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
      setSearchQuery('');
    } else {
      setIsOpen(true);
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 fixed top-0 right-0 left-0 lg:left-64 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center gap-4 flex-1">
        <button className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Menu">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden md:block relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-w-[200px] justify-between"
          >
            <span className={`font-medium truncate max-w-[200px] ${currentBuilding ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {currentBuilding ? currentBuilding.name : 'Vyberte dům...'}
            </span>
            <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 max-h-96 overflow-y-auto">
              <div className="px-2 py-2 sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-slate-600 rounded-md focus:outline-none focus:border-teal-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="Hledat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {filteredBuildings.length > 0 ? (
                filteredBuildings.map(building => (
                  <button
                    key={building.id}
                    onClick={() => {
                      setIsOpen(false);
                      // Pokud jsme na stránce, která podporuje filtrování podle buildingId (dashboard, units, billing)
                      // tak jen aktualizujeme URL parametr.
                      // Pokud jsme na detailu budovy (/buildings/[id]), tak přesměrujeme na nový detail.
                      // Jinak (např. seznam budov) taky aktualizujeme parametr.
                      
                      if (pathname?.startsWith('/buildings/') && pathname !== '/buildings' && pathname !== '/buildings/new') {
                         router.push(`/buildings/${building.id}`);
                      } else {
                         // Pro ostatní stránky (dashboard, units, billing, buildings list) použijeme query parametr
                         const newSearchParams = new URLSearchParams(searchParams?.toString());
                         newSearchParams.set('buildingId', building.id);
                         router.push(`${pathname}?${newSearchParams.toString()}`);
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                      building.id === currentBuildingId ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="truncate">{building.name}</span>
                    {building.id === currentBuildingId && (
                      <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Žádné domy nenalezeny</div>
              )}
              <div className="border-t border-gray-100 dark:border-slate-700 mt-1 pt-1">
                <Link
                  href="/buildings/new"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-primary hover:bg-gray-50 dark:hover:bg-slate-700 font-medium"
                >
                  + Přidat nový dům
                </Link>
              </div>
            </div>
          )}
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
              className="block w-full pl-10 pr-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg leading-5 bg-gray-50 dark:bg-slate-900 placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-colors text-gray-900 dark:text-white"
              placeholder="Hledat nebo otevřít (Ctrl/Cmd + K)"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
            ONLINE
          </span>
        </div>

        <ThemeToggle />

        <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-2"></div>

        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 relative rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" 
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upozornění</h3>
                <span className="text-xs text-teal-600 dark:text-teal-400 cursor-pointer hover:underline">Označit vše jako přečtené</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Žádná nová upozornění
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative pl-2" ref={profileRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg p-1 pr-2 transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'Uživatel'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Správce</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium text-sm ring-2 ring-white dark:ring-slate-800">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 sm:hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'Uživatel'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              
              <div className="py-1">
                <Link 
                  href="/profile" 
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Můj profil
                </Link>
                <Link 
                  href="/settings" 
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Nastavení
                </Link>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 py-1">
                <button 
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Odhlásit se
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
