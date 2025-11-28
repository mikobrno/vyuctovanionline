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

type ServiceSnapshot = {
  serviceId?: string
  code: string
  methodology?: string
  method?: string
  order?: number
  dataSourceType?: string | null
  dataSourceName?: string | null
  dataSourceColumn?: string | null
  unitAttributeName?: string | null
  measurementUnit?: string | null
  unitPrice?: number | string | null
  fixedAmountPerUnit?: number | string | null
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

type CalculationConfigRecord = {
  id: string
  buildingId: string
  name: string
  description?: string | null
  createdAt: Date
  isDefault?: boolean
  config: unknown
}

type CalculationConfigDelegateWorkaround = {
  findUnique: (args: unknown) => Promise<CalculationConfigRecord | null>
  update: (args: unknown) => Promise<CalculationConfigRecord>
  delete: (args: unknown) => Promise<unknown>
  updateMany: (args: unknown) => Promise<unknown>
}

const calculationConfigModel = prisma.calculationConfig as unknown as CalculationConfigDelegateWorkaround

const normalizeConfigPayload = (raw: unknown): VersionConfigPayload => {
  if (Array.isArray(raw)) {
    return { services: raw as ServiceSnapshot[], manualOverrides: null }
  }

  if (raw && typeof raw === 'object') {
    const candidate = raw as { services?: ServiceSnapshot[]; manualOverrides?: ManualOverridesPayload }
    if (Array.isArray(candidate.services)) {
      return {
        services: candidate.services,
        manualOverrides: candidate.manualOverrides ?? null,
      }
    }
  }

  return { services: [], manualOverrides: null }
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveServiceWhere = (buildingId: string, snapshot: ServiceSnapshot) => {
  if (snapshot.serviceId) {
    return { id: snapshot.serviceId, buildingId }
  }
  return { buildingId, code: snapshot.code }
}

// GET - Detail uložené verze
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params

    const version = await calculationConfigModel.findUnique({
      where: { id: versionId },
    })

    if (!version || version.buildingId !== id) {
      return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 })
    }

    const config = normalizeConfigPayload(version.config)

    return NextResponse.json({
      id: version.id,
      name: version.name,
      description: version.description,
      createdAt: version.createdAt,
      isDefault: version.isDefault ?? false,
      config,
    })
  } catch (error) {
    console.error('Failed to load config version detail', error)
    return NextResponse.json({ error: 'Chyba při načítání verze' }, { status: 500 })
  }
}

// POST - Obnovení konfigurace z verze do DB
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params

    const version = await calculationConfigModel.findUnique({
      where: { id: versionId },
    })

    if (!version || version.buildingId !== id) {
      return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 })
    }

    const config = normalizeConfigPayload(version.config)

    for (const snapshot of config.services) {
      await prisma.service.updateMany({
        where: resolveServiceWhere(id, snapshot),
        data: {
          order: typeof snapshot.order === 'number' ? snapshot.order : 0,
          methodology: snapshot.methodology ?? snapshot.method ?? undefined,
          dataSourceType: snapshot.dataSourceType ?? null,
          dataSourceName: snapshot.dataSourceName ?? null,
          dataSourceColumn: snapshot.dataSourceColumn ?? null,
          unitAttributeName: snapshot.unitAttributeName ?? null,
          measurementUnit: snapshot.measurementUnit ?? null,
          unitPrice: toNullableNumber(snapshot.unitPrice),
          fixedAmountPerUnit: toNullableNumber(snapshot.fixedAmountPerUnit),
          divisor: toNullableNumber(snapshot.divisor),
          manualCost: toNullableNumber(snapshot.manualCost),
          manualShare: toNullableNumber(snapshot.manualShare),
          customFormula: snapshot.customFormula ?? null,
          userMergeWithNext: snapshot.userMergeWithNext ?? false,
          showOnStatement: snapshot.showOnStatement ?? true,
          isActive: snapshot.isActive ?? true,
          advancePaymentColumn: snapshot.advancePaymentColumn ?? null,
          excelColumn: snapshot.excelColumn ?? null,
          groupShareLabel: snapshot.groupShareLabel ?? null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to restore config version', error)
    return NextResponse.json({ error: 'Chyba při obnově verze' }, { status: 500 })
  }
}

// PUT - Aktualizace konfigurace existující verze
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params
    const body = await request.json()
    const { services, manualOverrides } = body

    const version = await calculationConfigModel.findUnique({
      where: { id: versionId },
    })

    if (!version || version.buildingId !== id) {
      return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 })
    }

    // Aktualizuj konfiguraci verze
    const updatedVersion = await calculationConfigModel.update({
      where: { id: versionId },
      data: {
        config: {
          services: services || [],
          manualOverrides: manualOverrides || null,
        },
      },
    })

    return NextResponse.json({
      success: true,
      id: updatedVersion.id,
      name: updatedVersion.name,
    })
  } catch (error) {
    console.error('Failed to update config version', error)
    return NextResponse.json({ error: 'Chyba při aktualizaci verze' }, { status: 500 })
  }
}

// PATCH - Nastavení výchozí verze
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params
    const body = await request.json().catch(() => ({}))
    const { isDefault } = body ?? {}

    if (typeof isDefault !== 'boolean') {
      return NextResponse.json({ error: 'Chybí hodnota isDefault' }, { status: 400 })
    }

    const version = await calculationConfigModel.update({
      where: { id: versionId },
      data: { isDefault },
    })

    if (isDefault) {
      await calculationConfigModel.updateMany({
        where: {
          buildingId: id,
          NOT: { id: version.id },
        },
        data: { isDefault: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to set default config version', error)
    return NextResponse.json({ error: 'Chyba při aktualizaci výchozí verze' }, { status: 500 })
  }
}

// DELETE - Smazání verze
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params

    const version = await calculationConfigModel.findUnique({
      where: { id: versionId },
    })

    if (!version || version.buildingId !== id) {
      return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 })
    }

    await calculationConfigModel.delete({
      where: { id: versionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete config version', error)
    return NextResponse.json({ error: 'Chyba při mazání verze' }, { status: 500 })
  }
}
