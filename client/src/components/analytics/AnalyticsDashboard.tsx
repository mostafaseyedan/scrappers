import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { toast } from 'sonner'
import {
  analyticsService,
  type AnalystActivityPoint,
  type RfpAnalyticsSummary,
  type VolumePoint
} from '@/services/analyticsService'


const SummaryStat = ({
  title,
  value,
  helper,
  trend,
  multiline,
  minHeight
}: {
  title: string
  value: string
  helper?: string
  trend?: number | null
  multiline?: boolean
  minHeight?: number
}) => {
  const trendColor = trend !== undefined && trend !== null ? (trend >= 0 ? 'text-green-600' : 'text-red-600') : ''
  const trendIconPath =
    trend !== undefined && trend !== null && trend < 0 ? 'M4 12h16M12 4l8 8-8 8' : 'M4 12h16M12 4l8 8-8 8'
  const trendRotation = trend !== undefined && trend !== null && trend < 0 ? 'rotate-90' : '-rotate-90'

  return (
    <div className="h-full rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-4 shadow-sm flex flex-col" style={minHeight ? { minHeight } : undefined}>
      <div className="text-sm font-medium text-gray-500 dark:text-[#9699a6]">{title}</div>
      <div className={`mt-2 flex items-start gap-3`}>
        <span className={`text-base font-semibold text-gray-900 dark:text-[#d5d8df] ${multiline ? 'whitespace-pre-line' : 'break-words'}`} title={value}>{value}</span>
        {trend !== undefined && trend !== null && (
          <span className={`inline-flex items-center text-xs ${trendColor}`} title={`${trend >= 0 ? '+' : ''}${trend}% vs prior week`}>
            <svg className={`mr-1 h-3 w-3 transform ${trendRotation}`} viewBox="0 0 24 24" fill="none">
              <path d={trendIconPath} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {`${trend >= 0 ? '+' : ''}${trend}% vs prior week`}
          </span>
        )}
        {helper && (
          <span
            className={`text-base text-gray-600 dark:text-[#d5d8df] ${multiline ? 'whitespace-pre-line' : 'break-words'}`}
            title={helper}
          >
            {helper}
          </span>
        )}
      </div>
    </div>
  )
}

const EmptyState = ({ message, height }: { message: string; height?: number }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-[#797e93] bg-gray-50 dark:bg-[#181b34] text-sm text-gray-500 dark:text-[#9699a6]"
    style={{ minHeight: height ?? 224 }}
  >
    {message}
  </div>
)

const VolumeChartCard = ({ data }: { data: VolumePoint[] }) => {
  const hasActivity = data.some((point) => point.count > 0)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const axisColor = isDark ? '#d5d8df' : '#64748b'
  const gridColor = isDark ? '#4b4e69' : '#E5E7EB'
  const tooltipBg = isDark ? '#292f4c' : '#ffffff'
  const tooltipBorder = isDark ? '#797e93' : '#E5E7EB'
  const tooltipText = isDark ? '#d5d8df' : '#111827'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Daily Analysis Volume</h3>
          <p className="text-sm text-gray-500 dark:text-[#9699a6]">Analyses generated per day (last 30 days)</p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: isDark ? '#69a7ef' : '#93C5FD', strokeWidth: 1 }}
                contentStyle={{ borderRadius: 12, backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                formatter={(value: number) => [`${value} analyses`, 'Volume']}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No analyses were generated in the selected time window." />
        </div>
      )}
    </div>
  )
}

const AnalystsChartCard = ({ data }: { data: AnalystActivityPoint[] }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const axisColor = isDark ? '#d5d8df' : '#64748b'
  const gridColor = isDark ? '#4b4e69' : '#E5E7EB'
  const tooltipBg = isDark ? '#292f4c' : '#ffffff'
  const tooltipBorder = isDark ? '#797e93' : '#E5E7EB'
  const tooltipText = isDark ? '#d5d8df' : '#111827'
  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Analyst Activity</h3>
            <p className="text-sm text-gray-500 dark:text-[#9699a6]">Top contributors by analysis count (last 30 days)</p>
          </div>
        </div>
        <div className="mt-6">
          <EmptyState message="No analyst activity recorded during this period." />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Analyst Activity</h3>
          <p className="text-sm text-gray-500 dark:text-[#9699a6]">Top contributors by analysis count (last 30 days)</p>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
            <XAxis
              dataKey="analyst"
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={60}
              tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 14)}…` : value)}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.08)' }}
              contentStyle={{ borderRadius: 12, backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
              formatter={(value: number) => [`${value} analyses`, 'Completed']}
            />
            <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<RfpAnalyticsSummary | null>(null)

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

  try {
    const summaryData = await analyticsService.getRfpAnalyticsSummary()
    setSummary(summaryData)
  } catch (err) {
    console.error('[AnalyticsDashboard] Failed to load analytics:', err)
    toast.error('Unable to load analytics data right now. Please try again.')
    setError('Unable to load analytics data right now. Please try again.')
  } finally {
    setLoading(false)
  }
}, [])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const computed = useMemo(() => {
    if (!summary) return null

    const totalValue = summary.totalAnalyses > 0 ? summary.totalAnalyses.toString() : '0'
    const averageValue = Number.isFinite(summary.averagePerDay)
      ? summary.averagePerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : '0'
    const busiestValue = summary.busiestDay ? summary.busiestDay.count.toString() : '—'
    const busiestHelper = summary.busiestDay ? summary.busiestDay.label : 'No standout day'

    const top3Lines = summary.mostActiveRfps && summary.mostActiveRfps.length > 0
      ? summary.mostActiveRfps.map((x, idx) => `${idx + 1}. ${x.rfpTitle || x.rfpId}`).join('\n')
      : '—'

    return { totalValue, averageValue, busiestValue, busiestHelper, top3Lines }
  }, [summary])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e]">
        <div className="flex items-center gap-3 text-gray-600 dark:text-[#9699a6]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span>Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">
        <div className="text-lg font-semibold">Analytics unavailable</div>
        <p className="mt-2 text-sm">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Top performers summary */}
        <div className="sm:col-span-2 xl:col-span-2 h-full">
          <SummaryStat title="Top 3 Most Worked on RFPs" value={computed?.top3Lines || '—'} multiline />
        </div>

        {/* Key metrics grouped to match chart width */}
        <div className="sm:col-span-2 xl:col-span-2 h-full">
          <div className="grid h-full gap-4 sm:grid-cols-3">
            <div className="h-full">
              <SummaryStat title="Analyses (30 days)" value={computed?.totalValue || '0'} />
            </div>
            <div className="h-full">
              <SummaryStat title="Average per day" value={computed?.averageValue || '0'} trend={summary?.weekOverWeekChange ?? null} />
            </div>
            <div className="h-full">
              <SummaryStat title="Busiest day" value={computed?.busiestValue || '—'} helper={computed?.busiestHelper || ''} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <VolumeChartCard data={summary.volumeSeries} />
        <AnalystsChartCard data={summary.topAnalysts} />
      </div>
    </div>
  )
}

export default AnalyticsDashboard
