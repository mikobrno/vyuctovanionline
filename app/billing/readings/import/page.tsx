import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ReadingsImport from '@/components/buildings/ReadingsImport'

export default async function ReadingsImportPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Načíst dostupné budovy
  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      address: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  const currentYear = new Date().getFullYear()

  // Pokud existuje jen jedna budova, použít ji
  const defaultBuilding = buildings.length === 1 ? buildings[0] : null

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-900 mb-4">
              <Link href="/billing" className="hover:text-blue-600">Vyúčtování</Link>
              <span>/</span>
              <Link href="/billing/readings" className="hover:text-blue-600">Odečty</Link>
              <span>/</span>
              <span className="text-gray-900">Import z Excelu</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Import odečtů z Excelu</h1>
            <p className="mt-2 text-gray-900">
              Importujte odečty měřidel ze záložek &quot;Vodoměry TUV&quot;, &quot;Vodoměry SV&quot;, &quot;Teplo&quot; a &quot;Elektroměry&quot;
            </p>
          </div>

          {buildings.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">
                ⚠️ Nejprve musíte vytvořit alespoň jednu budovu.
              </p>
            </div>
          ) : defaultBuilding ? (
            <>
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  📍 Import pro budovu: <strong>{defaultBuilding.name}</strong> ({defaultBuilding.address})
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Rok vyúčtování: <strong>{currentYear}</strong>
                </p>
              </div>

              <ReadingsImport buildingId={defaultBuilding.id} year={currentYear} />
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vyberte budovu</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buildings.map((building) => (
                  <a
                    key={building.id}
                    href={`/billing/readings/import?buildingId=${building.id}`}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <h3 className="font-semibold text-gray-900">{building.name}</h3>
                    <p className="text-sm text-gray-900">{building.address}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Formát Excel souboru</h2>
            <div className="prose prose-sm text-gray-900">
              <p>Excel soubor musí obsahovat následující záložky:</p>
              <ul>
                <li><strong>&quot;Vodoměry TUV&quot;</strong> - odečty teplé vody</li>
                <li><strong>&quot;Vodoměry SV&quot;</strong> - odečty studené vody</li>
                <li><strong>&quot;Teplo&quot;</strong> - odečty tepla</li>
                <li><strong>&quot;Elektroměry&quot;</strong> - odečty elektřiny</li>
              </ul>
              <p className="mt-4">Každá záložka musí obsahovat tyto sloupce:</p>
              <ul>
                <li><strong>Sloupec A:</strong> Číslo jednotky (např. &quot;Jednotka č. 318/01&quot;)</li>
                <li><strong>Sloupec B:</strong> Jméno vlastníka</li>
                <li><strong>Sloupec G:</strong> Počáteční stav měřidla</li>
                <li><strong>Sloupec H:</strong> Konečný stav (odečtená hodnota)</li>
                <li><strong>Sloupec I:</strong> Spotřeba za období</li>
              </ul>
              <p className="text-sm text-gray-900 mt-4">
                Systém automaticky přeskočí prázdné řádky a řádky s nulovou spotřebou.
                Pokud měřidlo pro jednotku ještě neexistuje, bude automaticky vytvořeno.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
