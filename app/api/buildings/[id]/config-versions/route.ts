import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

type ManualOverridesPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unit?: Record<string, any>
} | null

type CalculationConfigRecord = {
  id: string
  name: string
  description?: string | null
  createdAt: Date
  isDefault?: boolean
  config?: unknown
}

type CalculationConfigDelegateWorkaround = {
  findMany: (args: unknown) => Promise<CalculationConfigRecord[]>
  create: (args: unknown) => Promise<CalculationConfigRecord>
  updateMany: (args: unknown) => Promise<unknown>
}

const calculationConfigModel = prisma.calculationConfig as unknown as CalculationConfigDelegateWorkaround

type ServiceSnapshot = {
  serviceId?: string
  code: string
  name: string
  methodology: string
  method?: string
  order: number
  dataSourceType?: string | null
  dataSourceName?: string | null
  dataSourceColumn?: string | null
  unitAttributeName?: string | null
  measurementUnit?: string | null
  unitPrice?: number | null
  fixedAmountPerUnit?: number | null
  divisor?: number | string | null
  manualCost?: number | string | null
  manualShare?: number | string | null
  customFormula?: string | null
  userMergeWithNext?: boolean
  showOnStatement?: boolean
  isActive?: boolean
  advancePaymentColumn?: string | null
  excelColumn?: string | null
  groupShareLabel?: string | null
}

type VersionConfigPayload = {
  services: ServiceSnapshot[]
  manualOverrides: ManualOverridesPayload
}

const snapshotService = (service: Record<string, unknown>): ServiceSnapshot => ({
  serviceId: typeof service.id === 'string' ? service.id : undefined,
  code: String(service.code ?? ''),
  name: String(service.name ?? ''),
  methodology: String(service.methodology ?? service.method ?? 'OWNERSHIP_SHARE'),
  method: typeof service.method === 'string' ? service.method : undefined,
  order: typeof service.order === 'number' ? service.order : Number(service.order ?? 0),
  dataSourceType: (service.dataSourceType as string) ?? null,
  dataSourceName: (service.dataSourceName as string) ?? null,
  dataSourceColumn: (service.dataSourceColumn as string) ?? null,
  unitAttributeName: (service.unitAttributeName as string) ?? null,
  measurementUnit: (service.measurementUnit as string) ?? null,
  unitPrice: typeof service.unitPrice === 'number' ? service.unitPrice : null,
  fixedAmountPerUnit: typeof service.fixedAmountPerUnit === 'number' ? service.fixedAmountPerUnit : null,
  divisor: (service.divisor as number | string | null) ?? null,
  manualCost: (service.manualCost as number | string | null) ?? null,
  manualShare: (service.manualShare as number | string | null) ?? null,
  customFormula: (service.customFormula as string) ?? null,
  userMergeWithNext: Boolean(service.userMergeWithNext),
  showOnStatement: service.showOnStatement === undefined ? true : Boolean(service.showOnStatement),
  isActive: service.isActive === undefined ? true : Boolean(service.isActive),
  advancePaymentColumn: (service.advancePaymentColumn as string) ?? null,
  excelColumn: (service.excelColumn as string) ?? null,
  groupShareLabel: (service.groupShareLabel as string) ?? null,
})

const buildConfigPayload = async (
  buildingId: string,
  bodyServices: unknown
): Promise<ServiceSnapshot[]> => {
  if (Array.isArray(bodyServices) && bodyServices.length > 0) {
    return bodyServices.map(service => snapshotService(service as Record<string, unknown>))
  }

  const dbServices = await prisma.service.findMany({
    where: { buildingId },
    orderBy: { order: 'asc' }
  })
  return dbServices.map(service => snapshotService(service as unknown as Record<string, unknown>))
}

// GET - Seznam verzí konfigurace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id } = await params

    const configs = await calculationConfigModel.findMany({
      where: { buildingId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        isDefault: true,
      }
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Failed to list config versions', error)
    return NextResponse.json({ error: 'Chyba při načítání verzí' }, { status: 500 })
  }
}

// POST - Uložení nové verze
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { name, description, services: rawServices, manualOverrides = null, setAsDefault = false } = body ?? {}

    const servicesSnapshot = await buildConfigPayload(id, rawServices)

    const configPayload: VersionConfigPayload = {
      services: servicesSnapshot,
      manualOverrides,
    }

    const config = await calculationConfigModel.create({
      data: {
        buildingId: id,
        name: name || `Konfigurace ${new Date().toLocaleDateString('cs-CZ')}`,
        description,
        isDefault: Boolean(setAsDefault),
        config: configPayload,
      }
    })

    if (setAsDefault) {
      await calculationConfigModel.updateMany({
        where: {
          buildingId: id,
          NOT: { id: config.id }
        },
        data: { isDefault: false }
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to save config version', error)
    return NextResponse.json({ error: 'Chyba při ukládání verze' }, { status: 500 })
  }
}
