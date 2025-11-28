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
              Nahrajte JSON soubor s kompletními daty vyúčtování - systém automaticky rozpozná dům a rok z dat v souboru.
            </p>
          </div>

          <CompleteImport year={currentYear} buildingId={buildingId} />

          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Co bude importováno</h2>
            <div className="prose prose-sm text-gray-500">
              <p>JSON soubor musí obsahovat následující strukturu:</p>
              <ul>
                <li>
                  <strong>&quot;house_info&quot;</strong> nebo <strong>&quot;vstupni_data&quot;</strong> - informace o domu
                  <ul>
                    <li><code>sidlo</code> nebo <code>adresa</code>: Adresa budovy (použije se pro identifikaci/vytvoření domu)</li>
                    <li><code>rok</code>: Rok vyúčtování</li>
                  </ul>
                </li>
                <li>
                  <strong>&quot;predpisy&quot;</strong> - měsíční předpisy záloh pro jednotlivé jednotky
                  <ul>
                    <li><code>byt</code>: Číslo bytu/jednotky</li>
                    <li><code>teplo_01</code> - <code>teplo_12</code>: Měsíční předpisy za teplo</li>
                    <li><code>tuv_01</code> - <code>tuv_12</code>: Měsíční předpisy za TUV</li>
                    <li><code>sv_01</code> - <code>sv_12</code>: Měsíční předpisy za SV</li>
                    <li>A další služby dle konfigurace...</li>
                  </ul>
                </li>
              </ul>
              <p className="text-sm text-gray-500 mt-4">
                Systém automaticky rozpozná dům z adresy v JSON souboru. Pokud dům s danou adresou neexistuje, vytvoří se nový.
                Předpisy záloh se importují do tabulky AdvanceMonthly.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
