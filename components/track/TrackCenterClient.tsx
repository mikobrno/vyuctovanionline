'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { TRACK_SCHEMA_ERROR, TRACK_SCHEMA_MESSAGE } from '@/lib/track/constants'
import type {
  TrackBuildingSummary,
  TrackCommunicationDetail,
  TrackExportSummary,
  TrackUnitCommunication,
  TrackUnitListResponse,
  TrackYearSummary,
} from '@/types/track'

type BuildingOption = {
  id: string
  name: string
}

type UnitRow = TrackUnitListResponse['items'][number]
type ChannelType = TrackUnitCommunication['channel']
type DeliveryStatusType = TrackUnitCommunication['deliveryStatus']
type PhysicalMethodType = NonNullable<UnitRow['manualDelivery']>['method']
type ManualFormState = {
  communicationId: string | null
  status: '' | DeliveryStatusType
  note: string
}
type DeliveryFormState = {
  method: PhysicalMethodType | ''
  dispatchedAt: string
  deliveredAt: string
  note: string
}

const createEmptyManualForm = (): ManualFormState => ({
  communicationId: null,
  status: '',
  note: '',
})

const createEmptyDeliveryForm = (): DeliveryFormState => ({
  method: '',
  dispatchedAt: '',
  deliveredAt: '',
  note: '',
})

const statusLabels: Record<DeliveryStatusType, string> = {
  PENDING: 'Čeká',
  ENQUEUED: 'Ve frontě',
  SENT: 'Odesláno',
  DELIVERED: 'Doručeno',
  OPENED: 'Otevřeno',
  FAILED: 'Chyba',
  CANCELLED: 'Zrušeno',
}

const channelLabels: Record<ChannelType, string> = {
  EMAIL: 'E-mail',
  SMS: 'SMS',
  LETTER: 'Dopis',
  LETTER_WITH_RECEIPT: 'Dopis + dodejka',
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const raw = await response.text()
    let parsed: { error?: string; message?: string } | null = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    const message =
      typeof parsed?.message === 'string'
        ? parsed.message
        : raw || 'Nepodařilo se zpracovat požadavek.'

    throw new TrackApiError(message, parsed?.error, response.status)
  }
  return response.json() as Promise<T>
}

const statusOptions = [
  { value: 'ALL', label: 'Všechny stavy' },
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
]

const channelOptions = [
  { value: 'ALL', label: 'Všechny kanály' },
  ...Object.entries(channelLabels).map(([value, label]) => ({ value, label })),
]

const manualStatusOptions = [
  { value: '', label: 'Neměnit stav' },
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
]

const deliveryMethodLabels: Record<PhysicalMethodType, string> = {
  LETTER: 'Dopis',
  LETTER_WITH_RECEIPT: 'Dopis s dodejkou',
  HAND_DELIVERY: 'Osobní předání',
  OTHER: 'Jiné',
}

const deliveryMethodOptions = Object.entries(deliveryMethodLabels).map(
  ([value, label]) => ({ value, label })
)

class TrackApiError extends Error {
  code?: string
  status?: number

  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

interface TrackCenterClientProps {
  buildings: BuildingOption[]
  initialBuildingId?: string
  initialYear: number
}

export default function TrackCenterClient({
  buildings,
  initialBuildingId,
  initialYear,
}: TrackCenterClientProps) {
  const [buildingSummaries, setBuildingSummaries] = useState<TrackBuildingSummary[]>([])
  const [yearSummaries, setYearSummaries] = useState<TrackYearSummary[]>([])
  const [unitResponse, setUnitResponse] = useState<TrackUnitListResponse | null>(null)
  const [unitLoading, setUnitLoading] = useState(false)
  const [unitError, setUnitError] = useState<string | null>(null)
  const [unitListRefreshKey, setUnitListRefreshKey] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState<UnitRow | null>(null)
  const [unitCommunications, setUnitCommunications] = useState<TrackUnitCommunication[]>([])
  const [unitCommLoading, setUnitCommLoading] = useState(false)
  const [unitCommError, setUnitCommError] = useState<string | null>(null)
  const [communicationDetail, setCommunicationDetail] =
    useState<TrackCommunicationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailCommunicationId, setDetailCommunicationId] = useState<string | null>(null)
  const [resendLoadingId, setResendLoadingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState<ManualFormState>(createEmptyManualForm())
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>(
    createEmptyDeliveryForm()
  )
  const [deliverySubmitting, setDeliverySubmitting] = useState(false)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [deliverySuccess, setDeliverySuccess] = useState<string | null>(null)
  const [exports, setExports] = useState<TrackExportSummary[]>([])
  const [exportsLoading, setExportsLoading] = useState(false)
  const [exportsError, setExportsError] = useState<string | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    initialBuildingId ?? buildings[0]?.id ?? ''
  )
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeliveryStatusType>('ALL')
  const [activeTab, setActiveTab] = useState<'units' | 'exports' | 'activity'>('units')

  const clearSchemaNotice = useCallback(() => setSchemaError(null), [setSchemaError])

  const captureSchemaError = useCallback(
    (error: unknown) => {
      if (error instanceof TrackApiError && error.code === TRACK_SCHEMA_ERROR) {
        setSchemaError(error.message || TRACK_SCHEMA_MESSAGE)
      }
    },
    [setSchemaError]
  )

  const resolveErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof TrackApiError) {
        captureSchemaError(error)
        return error.message || fallback
      }
      if (error instanceof Error) {
        return error.message || fallback
      }
      return fallback
    },
    [captureSchemaError]
  )

  const selectedBuildingSummary = buildingSummaries.find(
    (summary) => summary.id === selectedBuildingId
  )

  useEffect(() => {
    if (!selectedBuildingSummary) return
    if (
      selectedBuildingSummary.years.length > 0 &&
      !selectedBuildingSummary.years.includes(selectedYear)
    ) {
      setSelectedYear(selectedBuildingSummary.years[0])
    }
  }, [selectedBuildingSummary, selectedYear])

  useEffect(() => {
    let mounted = true
    fetchJson<TrackBuildingSummary[]>('/api/track/buildings')
      .then((data) => {
        if (!mounted) return
        setBuildingSummaries(data)
        clearSchemaNotice()
        if (data.length > 0) {
          setSelectedBuildingId((prev) => prev || data[0].id)
        }
      })
      .catch((error) => {
        if (!mounted) return
        captureSchemaError(error)
        setBuildingSummaries([])
      })

    return () => {
      mounted = false
    }
  }, [captureSchemaError, clearSchemaNotice])

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, 400)

    return () => clearTimeout(handler)
  }, [searchInput])

  useEffect(() => {
    if (!selectedBuildingId) return
    let mounted = true
    setYearSummaries([])
    fetchJson<TrackYearSummary[]>(
      `/api/track/buildings/${selectedBuildingId}/years`
    )
      .then((data) => {
        if (!mounted) return
        setYearSummaries(data)
        clearSchemaNotice()
        if (data.length > 0) {
          const preferredYear = data[0].year
          setSelectedYear((prev) => (prev ? prev : preferredYear))
        }
      })
      .catch((error) => {
        if (!mounted) return
        captureSchemaError(error)
        setYearSummaries([])
      })

    setExportsLoading(true)
    setExportsError(null)
    fetchJson<TrackExportSummary[]>(
      `/api/track/export?buildingId=${selectedBuildingId}`
    )
      .then((data) => {
        if (!mounted) return
        setExports(data)
        clearSchemaNotice()
      })
      .catch((error) => {
        if (!mounted) return
        setExports([])
        setExportsError(
          resolveErrorMessage(error, 'Nepodařilo se načíst exporty')
        )
      })
      .finally(() => {
        if (mounted) setExportsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [selectedBuildingId, captureSchemaError, clearSchemaNotice, resolveErrorMessage])

  useEffect(() => {
    if (!selectedBuildingId || !selectedYear) return
    setUnitLoading(true)
    setUnitError(null)
    const controller = new AbortController()
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '25',
    })
    if (searchQuery) params.set('search', searchQuery)
    if (channelFilter !== 'ALL') params.set('channel', channelFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    fetchJson<TrackUnitListResponse>(
      `/api/track/buildings/${selectedBuildingId}/years/${selectedYear}/units?${params.toString()}`,
      { signal: controller.signal }
    )
      .then((data) => {
        setUnitResponse(data)
        clearSchemaNotice()
      })
      .catch((error) => {
        const isAbort =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError')
        if (isAbort) return
        setUnitError(resolveErrorMessage(error, 'Nepodařilo se načíst jednotky'))
      })
      .finally(() => setUnitLoading(false))

    return () => controller.abort()
  }, [
    selectedBuildingId,
    selectedYear,
    page,
    searchQuery,
    channelFilter,
    statusFilter,
    unitListRefreshKey,
    clearSchemaNotice,
    resolveErrorMessage,
  ])

  useEffect(() => {
    if (!selectedUnit || !selectedYear) return
    setUnitCommLoading(true)
    setUnitCommError(null)
    setUnitCommunications([])
    const controller = new AbortController()
    fetchJson<TrackUnitCommunication[]>(
      `/api/track/units/${selectedUnit.unitId}/communications?year=${selectedYear}`,
      { signal: controller.signal }
    )
      .then((data) => {
        setUnitCommunications(data)
        clearSchemaNotice()
      })
      .catch((error) => {
        const isAbort =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError')
        if (isAbort) return
        setUnitCommError(
          resolveErrorMessage(
            error,
            'Jednotkové komunikace se nepodařilo načíst'
          )
        )
      })
      .finally(() => setUnitCommLoading(false))

    return () => controller.abort()
  }, [selectedUnit, selectedYear, clearSchemaNotice, resolveErrorMessage])

  useEffect(() => {
    setManualForm(createEmptyManualForm())
    setManualSubmitting(false)
    setManualError(null)
    setActionMessage(null)
    setActionError(null)
    setResendLoadingId(null)
    setDeliverySuccess(null)
    setDeliveryError(null)
    setDeliverySubmitting(false)
    setDeliveryForm(
      selectedUnit?.manualDelivery
        ? {
            method: selectedUnit.manualDelivery.method,
            dispatchedAt: toLocalInputValue(selectedUnit.manualDelivery.dispatchedAt),
            deliveredAt: toLocalInputValue(selectedUnit.manualDelivery.deliveredAt),
            note: '',
          }
        : createEmptyDeliveryForm()
    )
  }, [selectedUnit])

  const currentYearSummary = useMemo(
    () => yearSummaries.find((summary) => summary.year === selectedYear),
    [yearSummaries, selectedYear]
  )

  const activityItems = useMemo(() => {
    if (!unitResponse?.items) return []
    return [...unitResponse.items]
      .filter((item) => item.communications.lastUpdatedAt)
      .sort((a, b) =>
        (b.communications.lastUpdatedAt ?? '').localeCompare(
          a.communications.lastUpdatedAt ?? ''
        )
      )
      .slice(0, 6)
  }, [unitResponse])


  function handleBuildingChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedBuildingId(event.target.value)
    setPage(1)
    setSearchInput('')
    setSearchQuery('')
  }

  async function handleExportRequest() {
    if (!selectedBuildingId || !selectedYear) return
    setExportsLoading(true)
    try {
      const created = await fetchJson<TrackExportSummary>(`/api/track/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: selectedBuildingId,
          year: selectedYear,
        }),
      })
      setExports((prev) => [created, ...prev])
      clearSchemaNotice()
      alert('Export byl vložen do fronty')
    } catch (error) {
      alert(resolveErrorMessage(error, 'Export se nepodařilo vytvořit'))
    } finally {
      setExportsLoading(false)
    }
  }

  function handleUnitRowClick(unit: UnitRow) {
    setSelectedUnit(unit)
    setUnitCommunications([])
    setUnitCommError(null)
    setCommunicationDetail(null)
    setDetailError(null)
  }

  function handleDrawerClose() {
    setSelectedUnit(null)
    setUnitCommunications([])
    setUnitCommError(null)
    setCommunicationDetail(null)
    setDetailError(null)
    setDetailCommunicationId(null)
    setResendLoadingId(null)
    setActionMessage(null)
    setActionError(null)
    setManualForm(createEmptyManualForm())
    setManualSubmitting(false)
    setManualError(null)
    setDeliveryForm(createEmptyDeliveryForm())
    setDeliverySubmitting(false)
    setDeliveryError(null)
    setDeliverySuccess(null)
  }

  async function openCommunicationDetail(communicationId: string) {
    setDetailCommunicationId(communicationId)
    setDetailLoading(true)
    setDetailError(null)
    setCommunicationDetail(null)
    try {
      const detail = await fetchJson<TrackCommunicationDetail>(
        `/api/track/communications/${communicationId}`
      )
      setCommunicationDetail(detail)
      clearSchemaNotice()
    } catch (error) {
      setDetailError(
        resolveErrorMessage(error, 'Nepodařilo se načíst detail komunikace')
      )
    } finally {
      setDetailLoading(false)
    }
  }

  function refreshUnitTable() {
    setUnitListRefreshKey((prev) => prev + 1)
  }

  function refreshUnitCommunications() {
    setSelectedUnit((prev) => (prev ? { ...prev } : prev))
  }

  async function handleResend(communicationId: string, channelOverride?: ChannelType) {
    setResendLoadingId(communicationId)
    setActionError(null)
    setActionMessage(null)
    try {
      await fetchJson(`/api/track/communications/${communicationId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelOverride ? { channelOverride } : {}),
      })
      setActionMessage('Komunikace byla znovu vložena do fronty k odeslání.')
      clearSchemaNotice()
      refreshUnitCommunications()
      refreshUnitTable()
    } catch (error) {
      setActionError(
        resolveErrorMessage(error, 'Nepodařilo se znovu odeslat komunikaci')
      )
    } finally {
      setResendLoadingId(null)
    }
  }

  function toggleManualForm(communicationId: string) {
    setManualError(null)
    setActionError(null)
    setActionMessage(null)
    setManualForm((prev) =>
      prev.communicationId === communicationId
        ? createEmptyManualForm()
        : { communicationId, status: '', note: '' }
    )
  }

  async function handleManualFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!manualForm.communicationId) return
    setManualSubmitting(true)
    setManualError(null)
    setActionError(null)
    setActionMessage(null)
    try {
      await fetchJson(`/api/track/communications/${manualForm.communicationId}/manual-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'MANUAL_MARKED',
          note: manualForm.note || undefined,
          deliveryStatus: manualForm.status || undefined,
        }),
      })
      setManualForm(createEmptyManualForm())
      setActionMessage('Manuální událost byla zaznamenána.')
      clearSchemaNotice()
      refreshUnitCommunications()
      refreshUnitTable()
    } catch (error) {
      const message = resolveErrorMessage(error, 'Manuální záznam se nepodařil')
      setManualError(message)
      setActionError(message)
    } finally {
      setManualSubmitting(false)
    }
  }

  async function handleDeliveryRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUnit) return
    if (!deliveryForm.method) {
      setDeliveryError('Vyberte způsob doručení')
      return
    }
    setDeliverySubmitting(true)
    setDeliveryError(null)
    setDeliverySuccess(null)
    try {
      const result = await fetchJson<{
        method: PhysicalMethodType
        dispatchedAt: string | null
        deliveredAt: string | null
      }>(`/api/track/units/${selectedUnit.unitId}/delivery-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          method: deliveryForm.method,
          dispatchedAt: toIsoFromLocalValue(deliveryForm.dispatchedAt),
          deliveredAt: toIsoFromLocalValue(deliveryForm.deliveredAt),
          note: deliveryForm.note || undefined,
        }),
      })

      setDeliverySuccess('Záznam fyzického doručení byl uložen.')
      clearSchemaNotice()
      setSelectedUnit((prev) => {
        if (!prev || prev.unitId !== selectedUnit.unitId) {
          return prev
        }
        return {
          ...prev,
          manualDelivery: {
            method: result.method,
            dispatchedAt: result.dispatchedAt,
            deliveredAt: result.deliveredAt,
          },
        }
      })
      refreshUnitTable()
    } catch (error) {
      setDeliveryError(
        resolveErrorMessage(
          error,
          'Záznam fyzického doručení se nepodařilo uložit'
        )
      )
    } finally {
      setDeliverySubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
            Track Center
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Doručování a komunikace
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Sledujte odeslání e-mailů, SMS a fyzických dopisů za jednotlivé roky.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            value={selectedBuildingId}
            onChange={handleBuildingChange}
            aria-label="Vyberte budovu"
          >
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'units'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
              }`}
              onClick={() => setActiveTab('units')}
            >
              Jednotky
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'activity'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
              }`}
              onClick={() => setActiveTab('activity')}
            >
              Aktivita
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'exports'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
              }`}
              onClick={() => setActiveTab('exports')}
            >
              Exporty
            </button>
          </div>
        </div>
      </div>

        {schemaError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold text-base text-amber-900 dark:text-amber-200">
              Track Center není připraven
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-100">{schemaError}</p>
          </div>
        )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          ROKY
        </p>
        <div className="flex flex-wrap gap-2">
          {(selectedBuildingSummary?.years ?? []).map((year) => (
            <button
              key={year}
              className={`rounded-full border px-4 py-1 text-sm font-medium transition-colors ${
                year === selectedYear
                  ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-200'
                  : 'border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-600 dark:border-slate-700 dark:text-gray-300'
              }`}
              onClick={() => {
                setSelectedYear(year)
                setPage(1)
              }}
            >
              {year}
            </button>
          ))}
          {selectedBuildingSummary?.years?.length === 0 && (
            <span className="text-sm text-gray-500">Žádná data</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['SENT', 'DELIVERED', 'OPENED', 'FAILED'].map((status) => {
          const key = status as DeliveryStatusType
          const count = currentYearSummary?.totals.byStatus[key] ?? 0
          return (
            <div
              key={status}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {statusLabels[key]}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
              <p className="text-xs text-gray-400">
                {selectedYear ? `Rok ${selectedYear}` : 'Bez roku'}
              </p>
            </div>
          )
        })}
      </div>

      {activeTab === 'units' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder="Vyhledat jednotku nebo vlastníka"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
              />
              <select
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                value={channelFilter}
                onChange={(event) =>
                  setChannelFilter(event.target.value as 'ALL' | ChannelType)
                }
                aria-label="Filtr kanálu"
              >
                {channelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as 'ALL' | DeliveryStatusType
                  )
                }
                aria-label="Filtr stavu"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {unitResponse ? `Celkem ${unitResponse.total} jednotek` : 'Načítám...'}
            </div>
          </div>

          {unitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {unitError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-slate-800">
                  <th className="py-2">Jednotka</th>
                  <th>Příjemci</th>
                  <th>E-mail</th>
                  <th>SMS</th>
                  <th>Dopis</th>
                  <th>Poslední stav</th>
                </tr>
              </thead>
              <tbody>
                {unitLoading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      Načítám...
                    </td>
                  </tr>
                )}
                {!unitLoading && unitResponse?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      Žádné jednotky pro tento filtr
                    </td>
                  </tr>
                )}
                {!unitLoading &&
                  unitResponse?.items.map((item) => (
                    <tr
                      key={item.unitId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Otevřít detail jednotky ${item.unitNumber}`}
                      onClick={() => handleUnitRowClick(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleUnitRowClick(item)
                        }
                      }}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50/70 focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-3 font-semibold text-gray-900 dark:text-white">
                        {item.unitNumber}
                        {item.manualDelivery && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Manuální
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-gray-500">
                        {item.ownerNames.map((name, index) => (
                          <div key={`${item.unitId}-${index}`}>{name}</div>
                        ))}
                      </td>
                      <td>
                        {renderChannelStats(item.communications.totals.EMAIL)}
                      </td>
                      <td>{renderChannelStats(item.communications.totals.SMS)}</td>
                      <td>{renderChannelStats(item.communications.totals.LETTER)}</td>
                      <td>
                        <div className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                          <span>{
                            item.communications.lastStatus
                              ? statusLabels[item.communications.lastStatus]
                              : '—'
                          }</span>
                          <span className="text-[10px] text-gray-400">
                            {item.communications.lastUpdatedAt
                              ? new Date(item.communications.lastUpdatedAt).toLocaleString('cs-CZ')
                              : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {unitResponse && unitResponse.total > 25 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-full border border-gray-200 px-4 py-1 disabled:opacity-50 dark:border-slate-700"
              >
                Předchozí
              </button>
              <span>
                Strana {page} / {Math.ceil(unitResponse.total / 25)}
              </span>
              <button
                disabled={page >= Math.ceil(unitResponse.total / 25)}
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-full border border-gray-200 px-4 py-1 disabled:opacity-50 dark:border-slate-700"
              >
                Další
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Poslední aktivity
          </h2>
          {activityItems.length === 0 && (
            <p className="text-sm text-gray-500">Žádná data pro tento filtr.</p>
          )}
          <div className="space-y-4">
            {activityItems.map((item) => (
              <div
                key={`activity-${item.unitId}`}
                className="rounded-2xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Byt {item.unitNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.ownerNames.join(', ')}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                    {item.communications.lastUpdatedAt
                      ? new Date(item.communications.lastUpdatedAt).toLocaleString('cs-CZ')
                      : '—'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Poslední stav: {item.communications.lastStatus ? statusLabels[item.communications.lastStatus] : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'exports' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Exporty
              </h2>
              <p className="text-sm text-gray-500">
                CSV export komunikací za vybraný dům a rok.
              </p>
            </div>
            <button
              onClick={handleExportRequest}
              disabled={exportsLoading}
              className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-60"
            >
              Vytvořit export
            </button>
          </div>
          {exportsError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {exportsError}
            </div>
          )}
          <div className="space-y-3">
            {exports.length === 0 && !exportsLoading && (
              <p className="text-sm text-gray-500">Zatím žádné exporty.</p>
            )}
            {exportsLoading && <p className="text-sm text-gray-500">Načítám exporty...</p>}
            {exports.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-gray-100 p-3 text-sm dark:border-slate-800"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Export {item.year ?? '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString('cs-CZ')}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p
                    className={`font-semibold ${
                      item.status === 'READY'
                        ? 'text-green-600'
                        : item.status === 'FAILED'
                        ? 'text-red-500'
                        : 'text-amber-500'
                    }`}
                  >
                    {item.status}
                  </p>
                  {item.downloadPath && (
                    <a
                      href={item.downloadPath}
                      className="text-teal-600 hover:underline"
                    >
                      Stáhnout
                    </a>
                  )}
                  {item.errorMessage && (
                    <p className="text-red-500">{item.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedUnit && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Zavřít panel jednotky"
            className="flex-1 bg-black/40"
            onClick={handleDrawerClose}
          />
          <aside className="flex h-full w-full max-w-2xl flex-col border-l border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Jednotka
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Byt {selectedUnit.unitNumber}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedUnit.ownerNames.length > 0
                    ? selectedUnit.ownerNames.join(', ')
                    : 'Bez přiřazených vlastníků'}
                </p>
              </div>
              <button
                onClick={handleDrawerClose}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200"
              >
                Zavřít
              </button>
            </div>

            {selectedUnit.manualDelivery && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Manuální doručení</p>
                <p className="text-xs">
                  Metoda: {selectedUnit.manualDelivery.method}
                </p>
                <p className="text-xs">
                  Odesláno: {formatDateTime(selectedUnit.manualDelivery.dispatchedAt)}
                </p>
                <p className="text-xs">
                  Doručeno: {formatDateTime(selectedUnit.manualDelivery.deliveredAt)}
                </p>
              </div>
            )}

            {(actionMessage || actionError) && (
              <div
                className={`mt-4 rounded-2xl border p-3 text-sm ${
                  actionError
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-teal-200 bg-teal-50 text-teal-900'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{actionError ?? actionMessage}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-current underline"
                    onClick={() => {
                      setActionMessage(null)
                      setActionError(null)
                    }}
                  >
                    Zavřít
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex-1 overflow-y-auto">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Komunikace ({unitCommunications.length})
                </h4>
                <span className="text-xs text-gray-400">
                  Rok {selectedYear}
                </span>
              </div>

              {unitCommError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {unitCommError}
                </div>
              )}

              {unitCommLoading && (
                <p className="text-sm text-gray-500">Načítám komunikace...</p>
              )}

              {!unitCommLoading && unitCommunications.length === 0 && !unitCommError && (
                <p className="text-sm text-gray-500">
                  Žádné komunikace pro tuto jednotku v daném roce.
                </p>
              )}

              <div className="space-y-4">
                {unitCommunications.map((communication) => (
                  <div
                    key={communication.id}
                    className="rounded-2xl border border-gray-100 p-4 shadow-sm dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {channelLabels[communication.channel]}
                        </p>
                        <p className="text-xs text-gray-500">
                          {communication.subject ?? communication.previewText ?? 'Bez předmětu'}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${getStatusColorClass(communication.deliveryStatus)}`}>
                        {statusLabels[communication.deliveryStatus]}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
                      <div>
                        <dt className="font-semibold text-gray-700 dark:text-gray-200">
                          Ve frontě
                        </dt>
                        <dd>{formatDateTime(communication.queuedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-700 dark:text-gray-200">
                          Odesláno
                        </dt>
                        <dd>{formatDateTime(communication.sentAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-700 dark:text-gray-200">
                          Doručeno
                        </dt>
                        <dd>{formatDateTime(communication.deliveredAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-700 dark:text-gray-200">
                          Otevřeno
                        </dt>
                        <dd>{formatDateTime(communication.openedAt)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => handleResend(communication.id)}
                        disabled={resendLoadingId === communication.id}
                        className="rounded-full border border-teal-200 px-3 py-1 text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
                      >
                        {resendLoadingId === communication.id
                          ? 'Odesílám...'
                          : 'Znovu odeslat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleManualForm(communication.id)}
                        className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 transition hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200"
                      >
                        {manualForm.communicationId === communication.id
                          ? 'Zavřít manuální formulář'
                          : 'Manuální zápis'}
                      </button>
                    </div>
                    {manualForm.communicationId === communication.id && (
                      <form
                        className="mt-3 space-y-2 rounded-2xl border border-gray-100 p-3 text-xs dark:border-slate-800"
                        onSubmit={handleManualFormSubmit}
                      >
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Stav doručení
                          <select
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
                            value={manualForm.status}
                            onChange={(event) =>
                              setManualForm((prev) => ({
                                ...prev,
                                status: event.target.value as '' | DeliveryStatusType,
                              }))
                            }
                          >
                            {manualStatusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Poznámka
                          <textarea
                            className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-700 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
                            rows={3}
                            placeholder="Např. dopis převzal správce..."
                            value={manualForm.note}
                            onChange={(event) =>
                              setManualForm((prev) => ({
                                ...prev,
                                note: event.target.value,
                              }))
                            }
                          />
                        </label>
                        {manualError && (
                          <p className="text-[11px] text-red-500">{manualError}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={manualSubmitting}
                            className="rounded-full bg-teal-600 px-3 py-1 text-white disabled:opacity-60"
                          >
                            {manualSubmitting ? 'Ukládám...' : 'Uložit manuální záznam'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualForm(createEmptyManualForm())}
                            className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 dark:border-slate-700 dark:text-gray-300"
                          >
                            Zrušit
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <p>Poslední událost: {formatDateTime(communication.lastEvent)}</p>
                      <button
                        onClick={() => openCommunicationDetail(communication.id)}
                        className="text-sm font-semibold text-teal-600 hover:text-teal-700"
                      >
                        Zobrazit detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-gray-100 pt-6 text-sm dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Evidence fyzického doručení
                  </h4>
                  {selectedYear && (
                    <span className="text-xs text-gray-400">Rok {selectedYear}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Zapište ruční doručení dopisu, doporučeného dopisu nebo osobního předání.
                </p>
                <form onSubmit={handleDeliveryRecordSubmit} className="mt-4 space-y-3">
                  <label className="text-xs text-gray-500">
                    Způsob doručení
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                      value={deliveryForm.method}
                      onChange={(event) =>
                        setDeliveryForm((prev) => ({
                          ...prev,
                          method: event.target.value as DeliveryFormState['method'],
                        }))
                      }
                    >
                      <option value="">Vyberte způsob doručení</option>
                      {deliveryMethodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-500">
                      Odesláno
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                        value={deliveryForm.dispatchedAt}
                        onChange={(event) =>
                          setDeliveryForm((prev) => ({
                            ...prev,
                            dispatchedAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Doručeno
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                        value={deliveryForm.deliveredAt}
                        onChange={(event) =>
                          setDeliveryForm((prev) => ({
                            ...prev,
                            deliveredAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                    rows={3}
                    placeholder="Krátká poznámka nebo číslo zásilky"
                    value={deliveryForm.note}
                    onChange={(event) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        note: event.target.value,
                      }))
                    }
                  />
                  {deliveryError && (
                    <p className="text-xs text-red-500">{deliveryError}</p>
                  )}
                  {deliverySuccess && (
                    <p className="text-xs text-green-600">{deliverySuccess}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={deliverySubmitting || !deliveryForm.method}
                      className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {deliverySubmitting ? 'Ukládám...' : 'Uložit záznam'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryForm(
                          selectedUnit?.manualDelivery
                            ? {
                                method: selectedUnit.manualDelivery.method,
                                dispatchedAt: toLocalInputValue(
                                  selectedUnit.manualDelivery.dispatchedAt
                                ),
                                deliveredAt: toLocalInputValue(
                                  selectedUnit.manualDelivery.deliveredAt
                                ),
                                note: '',
                              }
                            : createEmptyDeliveryForm()
                        )
                        setDeliveryError(null)
                        setDeliverySuccess(null)
                      }}
                      className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300"
                    >
                      Reset formuláře
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </aside>
        </div>
      )}

      {(detailLoading || communicationDetail || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Detail komunikace
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {communicationDetail?.subject ?? communicationDetail?.previewText ?? 'Komunikace' }
                </h3>
                {detailCommunicationId && (
                  <p className="text-xs text-gray-500">ID: {detailCommunicationId}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setCommunicationDetail(null)
                  setDetailCommunicationId(null)
                  setDetailError(null)
                  setDetailLoading(false)
                }}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200"
              >
                Zavřít
              </button>
            </div>
            {detailError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {detailError}
              </div>
            )}
            {detailLoading && (
              <p className="text-sm text-gray-500">Načítám detail komunikace...</p>
            )}
            {!detailLoading && communicationDetail && (
              <div className="space-y-5 text-sm text-gray-700 dark:text-gray-100">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Kanál</p>
                    <p className="font-semibold">
                      {channelLabels[communicationDetail.channel]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Stav</p>
                    <p className={`font-semibold ${getStatusColorClass(communicationDetail.deliveryStatus)}`}>
                      {statusLabels[communicationDetail.deliveryStatus]}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Ve frontě</p>
                    <p>{formatDateTime(communicationDetail.queuedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Odesláno</p>
                    <p>{formatDateTime(communicationDetail.sentAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Doručeno</p>
                    <p>{formatDateTime(communicationDetail.deliveredAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Otevřeno</p>
                    <p>{formatDateTime(communicationDetail.openedAt)}</p>
                  </div>
                </div>
                {communicationDetail.previewText && (
                  <div>
                    <p className="text-xs text-gray-500">Náhled</p>
                    <p>{communicationDetail.previewText}</p>
                  </div>
                )}
                {communicationDetail.attachments.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Přílohy</p>
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      {communicationDetail.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a
                            href={attachment.downloadPath}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-600 hover:underline"
                          >
                            {attachment.filename}{' '}
                            {attachment.sizeBytes
                              ? `(${(attachment.sizeBytes / 1024).toFixed(1)} kB)`
                              : ''}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Události</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {communicationDetail.events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-gray-100 p-3 dark:border-slate-800"
                      >
                        <p className="font-semibold">{event.type}</p>
                        <p className="text-gray-500">{formatDateTime(event.createdAt)}</p>
                        {event.payload && (
                          <pre className="mt-2 overflow-x-auto rounded bg-gray-900/90 p-2 text-[10px] text-gray-100">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {(communicationDetail.textBody || communicationDetail.htmlBody) && (
                  <div>
                    <p className="text-xs text-gray-500">Obsah zprávy</p>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-2xl bg-gray-900/80 p-3 text-[11px] text-slate-100">
                      {communicationDetail.textBody ?? communicationDetail.htmlBody}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function renderChannelStats(
  stats: { total: number; delivered: number; failed: number } | undefined
) {
  if (!stats) return <span className="text-xs text-gray-400">—</span>
  return (
    <div className="text-xs text-gray-600 dark:text-gray-300">
      <div>
        Odesláno: <span className="font-semibold">{stats.total}</span>
      </div>
      <div className="text-green-600">Doručeno: {stats.delivered}</div>
      <div className="text-red-500">Chyby: {stats.failed}</div>
    </div>
  )
}

function getStatusColorClass(status: DeliveryStatusType) {
  switch (status) {
    case 'FAILED':
    case 'CANCELLED':
      return 'text-red-600'
    case 'DELIVERED':
    case 'OPENED':
      return 'text-green-600'
    case 'SENT':
      return 'text-blue-600'
    case 'PENDING':
    case 'ENQUEUED':
      return 'text-amber-600'
    default:
      return 'text-gray-600'
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString('cs-CZ')
}

function toLocalInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return ''
  const offsetMinutes = parsed.getTimezoneOffset()
  const local = new Date(parsed.getTime() - offsetMinutes * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIsoFromLocalValue(value: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return undefined
  return parsed.toISOString()
}
