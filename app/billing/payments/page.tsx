import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { prisma } from '@/lib/prisma'

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const payments = await prisma.payment.findMany({
    include: {
      unit: {
        select: {
          unitNumber: true,
          building: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { paymentDate: 'desc' },
    take: 50
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/billing" className="hover:text-teal-600">Vyúčtování</Link>
            <span>/</span>
            <span className="text-gray-900">Platby</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Evidence plateb
          </h1>
          <p className="mt-2 text-gray-500">
            Přehled přijatých plateb záloh
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jednotka</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Částka</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Období</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment: {
                id: string
                amount: number
                paymentDate: Date
                variableSymbol: string
                period: number
                unit: {
                  unitNumber: string
                }
              }) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {payment.unit.unitNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {payment.amount.toLocaleString()} Kč
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(payment.paymentDate).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {payment.variableSymbol}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {payment.period}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Zatím nejsou zaznamenány žádné platby
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
