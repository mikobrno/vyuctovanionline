import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ExcelImport from '@/components/buildings/ExcelImport'

export default async function ExpensesImportPage() {
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
      <DashboardNav userRole={session.user.role} />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Import nákladů z Excelu</h1>
            <p className="mt-2 text-gray-600">
              Importujte faktury a náklady ze záložky &quot;Faktury&quot; vašeho Excel souboru
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

              <ExcelImport buildingId={defaultBuilding.id} year={currentYear} />
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vyberte budovu</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buildings.map((building) => (
                  <a
                    key={building.id}
                    href={`/billing/expenses/import?buildingId=${building.id}`}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <h3 className="font-semibold text-gray-900">{building.name}</h3>
                    <p className="text-sm text-gray-600">{building.address}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Formát Excel souboru</h2>
            <div className="prose prose-sm text-gray-600">
              <p>Excel soubor musí obsahovat záložku s názvem <strong>&quot;Faktury&quot;</strong> s těmito sloupci:</p>
              <ul>
                <li><strong>Sloupec A:</strong> Název služby (např. &quot;Fond oprav&quot;, &quot;Elektřina&quot;, &quot;Teplo&quot;)</li>
                <li><strong>Sloupec C:</strong> Způsob rozúčtování (např. &quot;vlastnický podíl&quot;, &quot;na byt&quot;, &quot;měřidla&quot;)</li>
                <li><strong>Sloupec D:</strong> Podíl (100 = 100%)</li>
                <li><strong>Sloupec E:</strong> Náklad za rok (částka v Kč)</li>
              </ul>
              <p className="text-sm text-gray-500 mt-4">
                Systém automaticky přeskočí prázdné řádky a řádky s nulovou částkou.
                Pokud služba ještě neexistuje, bude automaticky vytvořena.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
