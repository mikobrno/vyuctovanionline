import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import TrackCenterClient from '@/components/track/TrackCenterClient'

export default async function TrackCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const resolvedParams = await searchParams
  const buildingIdParam = resolvedParams.buildingId
  const initialBuildingId = typeof buildingIdParam === 'string' ? buildingIdParam : undefined
  const yearParam = resolvedParams.year
  const parsedYear =
    typeof yearParam === 'string' && Number.isInteger(Number(yearParam))
      ? Number(yearParam)
      : undefined

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })

  const initialYear = parsedYear ?? new Date().getFullYear() - 1

  return (
    <AppLayout user={session.user}>
      <TrackCenterClient
        buildings={buildings}
        initialBuildingId={initialBuildingId}
        initialYear={initialYear}
      />
    </AppLayout>
  )
}
