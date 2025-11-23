'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import AppLayout from '@/components/layout/AppLayout';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Simulace uložení
    setTimeout(() => {
      setIsLoading(false);
      setMessage({ type: 'success', text: 'Profil byl úspěšně aktualizován.' });
    }, 1000);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
              Můj profil
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Správa osobních údajů a nastavení účtu
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-full bg-teal-500 flex items-center justify-center text-white text-3xl font-medium ring-4 ring-white dark:ring-slate-700 shadow-lg">
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  {session?.user?.name || 'Uživatel'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {session?.user?.email || 'email@example.com'}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                    Administrátor
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Aktivní
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Jméno a příjmení
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="name"
                        id="name"
                        defaultValue={session?.user?.name || ''}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2 px-3 border"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Emailová adresa
                    </label>
                    <div className="mt-1">
                      <input
                        type="email"
                        name="email"
                        id="email"
                        disabled
                        defaultValue={session?.user?.email || ''}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 shadow-sm sm:text-sm py-2 px-3 border cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email nelze změnit.</p>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Telefon
                    </label>
                    <div className="mt-1">
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        placeholder="+420 123 456 789"
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2 px-3 border"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Role
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="role"
                        id="role"
                        disabled
                        defaultValue="Administrátor"
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 shadow-sm sm:text-sm py-2 px-3 border cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">Změna hesla</h4>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Současné heslo
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="current-password"
                          id="current-password"
                          className="block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2 px-3 border"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3"></div>

                    <div className="sm:col-span-3">
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nové heslo
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="new-password"
                          id="new-password"
                          className="block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2 px-3 border"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Potvrzení hesla
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="confirm-password"
                          id="confirm-password"
                          className="block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2 px-3 border"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {message && (
                  <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {message.type === 'success' ? (
                          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{message.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 mr-3"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Ukládám...' : 'Uložit změny'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
