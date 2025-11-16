import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  const unit = await prisma.unit.findUnique({
    where: {
      id,
    },
    include: {
      building: true,
      ownerships: {
        include: {
          owner: true,
        },
        orderBy: {
          validFrom: 'desc',
        },
      },
      meters: {
        include: {
          service: true,
          readings: {
            orderBy: {
              readingDate: 'desc',
            },
            take: 5,
          },
        },
      },
      payments: {
        orderBy: {
          paymentDate: 'desc',
        },
        take: 10,
      },
    },
  })

  if (!unit) {
    notFound()
  }

  const currentOwnership = unit.ownerships.find((o: typeof unit.ownerships[number]) => !o.validTo)

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/units"
              className="text-gray-400 hover:text-gray-900"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                Jednotka {unit.unitNumber}
              </h1>
              <p className="mt-2 text-gray-900">
                {unit.building.name}
              </p>
            </div>
            <Link
              href={`/units/${unit.id}/edit`}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Upravit jednotku
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Levý sloupec - hlavní informace */}
          <div className="lg:col-span-2 space-y-6">
            {/* Základní údaje */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Základní údaje</h2>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Číslo jednotky</label>
                    <p className="mt-1 text-gray-900 text-lg font-semibold">{unit.unitNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">Variabilní symbol</label>
                    <p className="mt-1 text-gray-900 text-lg font-semibold">{unit.variableSymbol}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">Celková výměra</label>
                    <p className="mt-1 text-gray-900">{unit.totalArea} m²</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">Podíl na společných částech</label>
                    <p className="mt-1 text-gray-900">{unit.shareNumerator}/{unit.shareDenominator}</p>
                  </div>
                  {unit.floorArea && (
                    <div>
                      <label className="text-sm font-medium text-gray-900">Podlahová plocha</label>
                      <p className="mt-1 text-gray-900">{unit.floorArea} m²</p>
                    </div>
                  )}
                  {unit.residents && (
                    <div>
                      <label className="text-sm font-medium text-gray-900">Počet obyvatel</label>
                      <p className="mt-1 text-gray-900">{unit.residents}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Aktuální vlastník */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Aktuální vlastník</h2>
              </div>
              <div className="px-6 py-4">
                {currentOwnership ? (
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {currentOwnership.owner.firstName} {currentOwnership.owner.lastName}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-900">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {currentOwnership.owner.email}
                        </div>
                        {currentOwnership.owner.phone && (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {currentOwnership.owner.phone}
                          </div>
                        )}
                        <div className="flex items-center text-gray-900 mt-2">
                          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Od {new Date(currentOwnership.validFrom).toLocaleDateString('cs-CZ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-900">Jednotka nemá přiřazeného vlastníka</p>
                )}
              </div>
            </div>

            {/* Měřidla */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Měřidla</h2>
              </div>
              <div className="px-6 py-4">
                {unit.meters.length === 0 ? (
                  <p className="text-gray-900">Zatím nejsou evidována žádná měřidla</p>
                ) : (
                  <div className="space-y-4">
                    {unit.meters.map((meter: typeof unit.meters[number]) => (
                      <div key={meter.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">{meter.service?.name || 'Služba neuvedena'}</h3>
                            <p className="text-sm text-gray-900">Výrobní číslo: {meter.serialNumber}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            meter.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {meter.isActive ? 'Aktivní' : 'Neaktivní'}
                          </span>
                        </div>
                        {meter.readings.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-900 mb-2">Poslední odečet:</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {meter.readings[0].value} {meter.service?.measurementUnit || ''}
                              <span className="text-sm font-normal text-gray-900 ml-2">
                                ({new Date(meter.readings[0].readingDate).toLocaleDateString('cs-CZ')})
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pravý sloupec - platby */}
          <div className="space-y-6">
            {/* Platby */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Poslední platby</h2>
              </div>
              <div className="px-6 py-4">
                {unit.payments.length === 0 ? (
                  <p className="text-gray-900 text-sm">Zatím nejsou evidovány žádné platby</p>
                ) : (
                  <div className="space-y-3">
                    {unit.payments.map((payment: typeof unit.payments[number]) => (
                      <div key={payment.id} className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(payment.paymentDate).toLocaleDateString('cs-CZ')}
                          </p>
                          <p className="text-xs text-gray-900">VS: {payment.variableSymbol}</p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">
                          {payment.amount.toLocaleString('cs-CZ')} Kč
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Historie vlastnictví */}
            {unit.ownerships.length > 1 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Historie vlastnictví</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {unit.ownerships.map((ownership: typeof unit.ownerships[number]) => (
                      <div key={ownership.id} className="text-sm">
                        <p className="font-medium text-gray-900">
                          {ownership.owner.firstName} {ownership.owner.lastName}
                        </p>
                        <p className="text-gray-900">
                          {new Date(ownership.validFrom).toLocaleDateString('cs-CZ')}
                          {ownership.validTo 
                            ? ` - ${new Date(ownership.validTo).toLocaleDateString('cs-CZ')}`
                            : ' - současnost'
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
