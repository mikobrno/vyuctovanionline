import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import CompleteImport from '@/components/buildings/CompleteImport'

export default async function CompleteImportPage({
  searchParams,
}: {
  searchParams: Promise<{ buildingId?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { buildingId } = await searchParams
  const currentYear = new Date().getFullYear() - 1

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Import kompletního vyúčtování</h1>
            <p className="mt-2 text-gray-500">
              Nahrajte Excel soubor s kompletními daty vyúčtování (faktury, odečty, platby) a systém automaticky vytvoří nebo doplní dům a všechny související záznamy.
            </p>
          </div>

          <CompleteImport year={currentYear} buildingId={buildingId} />

          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Co bude importováno</h2>
            <div className="prose prose-sm text-gray-500">
              <p>Excel soubor musí obsahovat následující záložky:</p>
              <ul>
                <li>
                  <strong>&quot;Faktury&quot;</strong> - náklady na služby
                  <ul>
                    <li>Sloupec A: Název služby</li>
                    <li>Sloupec C: Způsob rozúčtování</li>
                    <li>Sloupec E: Náklad za rok (Kč)</li>
                  </ul>
                </li>
                <li>
                  <strong>&quot;Vodoměry TUV&quot;, &quot;Vodoměry SV&quot;, &quot;Teplo&quot;, &quot;Elektroměry&quot;</strong> - odečty měřidel
                  <ul>
                    <li>Sloupec A: Číslo jednotky</li>
                    <li>Sloupec B: Jméno vlastníka</li>
                    <li>Sloupec G-H: Počáteční a konečný stav</li>
                    <li>Sloupec I: Spotřeba</li>
                  </ul>
                </li>
                <li>
                  <strong>&quot;Úhrady&quot;</strong> - měsíční platby jednotek
                  <ul>
                    <li>Sloupec A: Číslo jednotky</li>
                    <li>Sloupce B-M: Platby za jednotlivé měsíce (01-12)</li>
                  </ul>
                </li>
              </ul>
              <p className="text-sm text-gray-500 mt-4">
                Systém automaticky vytvoří dům, jednotky, služby, měřidla a propojí vše dohromady.
                Pokud dům se stejným názvem už existuje, použije se existující a doplní se jen nová data.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
