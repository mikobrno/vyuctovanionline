import { prisma } from '@/lib/prisma'

interface StatsCardsProps {
  buildingId?: string
}

export default async function StatsCards({ buildingId }: StatsCardsProps) {
  // Načteme základní statistiky
  const buildingsCount = buildingId ? 1 : await prisma.building.count()
  
  const unitsCount = await prisma.unit.count(
    buildingId ? { where: { buildingId } } : undefined
  )
  
  const ownersCount = await prisma.owner.count(
    buildingId ? {
      where: {
        ownerships: {
          some: {
            unit: {
              buildingId
            }
          }
        }
      }
    } : undefined
  )
  
  const billingPeriodsCount = await prisma.billingPeriod.count(
    buildingId ? { where: { buildingId } } : undefined
  )

  const stats = [
    {
      name: 'BYTOVÉ DOMY',
      value: buildingsCount,
      description: buildingId ? 'Vybraný objekt' : 'Spravované objekty',
      trend: 'Aktivní',
      trendColor: 'text-teal-500',
      progress: 100,
      progressColor: 'bg-teal-500',
      icon: (
        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      iconBg: 'bg-blue-500',
    },
    {
      name: 'JEDNOTKY',
      value: unitsCount,
      description: 'Evidované byty a nebyty',
      trend: 'Celkem',
      trendColor: 'text-teal-500',
      progress: 100,
      progressColor: 'bg-teal-500',
      icon: (
        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      iconBg: 'bg-teal-500',
    },
    {
      name: 'VLASTNÍCI',
      value: ownersCount,
      description: 'Databáze kontaktů',
      trend: 'Aktivní',
      trendColor: 'text-teal-500',
      progress: 100,
      progressColor: 'bg-teal-500',
      icon: (
        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      iconBg: 'bg-yellow-500',
    },
    {
      name: 'VYÚČTOVÁNÍ',
      value: billingPeriodsCount,
      description: 'Uzavřená období',
      trend: 'Archiv',
      trendColor: 'text-gray-500',
      progress: 100,
      progressColor: 'bg-teal-500',
      icon: (
        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      iconBg: 'bg-purple-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{stat.name}</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
            </div>
            <div className={`p-3 rounded-full ${stat.iconBg} shadow-sm`}>
              {stat.icon}
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">{stat.description}</p>
            
            <div className="flex items-center gap-2 text-xs font-medium">
              {stat.trendColor === 'text-teal-500' ? (
                <svg className={`w-3 h-3 ${stat.trendColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ) : (
                <svg className={`w-3 h-3 ${stat.trendColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              )}
              <span className={stat.trendColor}>{stat.trend}</span>
            </div>

            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${stat.progressColor}`} 
                style={{ width: `${stat.progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
