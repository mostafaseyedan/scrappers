import apiClient from './apiClient'

export interface VolumePoint {
  date: string
  label: string
  count: number
}

export interface AnalystActivityPoint {
  analyst: string
  count: number
}

export interface RfpAnalyticsSummary {
  totalAnalyses: number
  averagePerDay: number
  uniqueAnalysts: number
  volumeSeries: VolumePoint[]
  topAnalysts: AnalystActivityPoint[]
  dateRange: {
    startDate: string
    endDate: string
  }
  busiestDay?: VolumePoint
  weekOverWeekChange?: number | null
  mostActiveRfp?: {
    rfpId: string
    rfpTitle?: string
    totalActivity: number
    counts: {
      analyses: number
      proposalReviews: number
      foiaAnalyses: number
      chatMessages: number
      updates: number
    }
  }
  mostActiveRfps?: Array<{
    rfpId: string
    rfpTitle?: string
    totalActivity: number
    counts: {
      analyses: number
      proposalReviews: number
      foiaAnalyses: number
      chatMessages: number
      updates: number
    }
  }>
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric'
})

const START_OF_DAY_FORMATTER = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

const getDateKey = (date: Date) => date.toISOString().split('T')[0]

const parseAnalysisDate = (rawDate: unknown): Date | null => {
  if (!rawDate) return null

  if (typeof rawDate === 'string' || rawDate instanceof String) {
    const parsed = new Date(rawDate as string)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof rawDate === 'number') {
    const parsed = new Date(rawDate)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof rawDate === 'object') {
    const dateLike = rawDate as { seconds?: number; _seconds?: number; toDate?: () => Date }

    if (typeof dateLike.toDate === 'function') {
      const parsed = dateLike.toDate()
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const seconds = dateLike._seconds ?? dateLike.seconds
    if (typeof seconds === 'number') {
      const parsed = new Date(seconds * 1000)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }

  return null
}

const formatAnalystLabel = (value: string | null | undefined): string => {
  if (!value) return 'Unknown'
  const trimmed = value.trim()
  if (!trimmed) return 'Unknown'

  const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
  const cleaned = withoutDomain.replace(/[_\.]+/g, ' ')
  const words = cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

  const label = words.join(' ').trim()
  return label || 'Unknown'
}

export const analyticsService = {

  /**
   * Build an analytics snapshot from all user activities:
   * - RFP Analyses
   * - Proposal Reviews
   * - FOIA Analyses
   * - Chat Interactions
   */
  async getRfpAnalyticsSummary(days: number = 30, limit: number = 500): Promise<RfpAnalyticsSummary> {
    try {
      // Calculate date range for server-side filtering
      const endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
      const filterStartDate = new Date(endDate)
      filterStartDate.setDate(endDate.getDate() - (days - 1))
      filterStartDate.setHours(0, 0, 0, 0)

      // Fetch all activity types in parallel with date filtering
      const [rfpResponse, reviewsResponse, foiaResponse, chatResponse] = await Promise.all([
        apiClient.get('/rfp-analyses', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-proposal-reviews', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-foia-analyses', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-chat-sessions', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        })
      ])

      // Normalize all activities to a common format (capture rfp identifiers if present)
      const rfpAnalyses: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (rfpResponse.data?.analyses || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.submittedBy,
        userEmail: item.userEmail,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const proposalReviews: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (reviewsResponse.data?.reviews || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.reviewedBy,
        userEmail: item.reviewedBy,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const foiaAnalyses: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (foiaResponse.data?.analyses || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.analyzedBy,
        userEmail: item.analyzedBy,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const chatSessions: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (chatResponse.data?.sessions || []).map((item: any) => ({
        createdAt: item.timestamp || item.createdAt,
        submittedBy: item.userId,
        userEmail: item.userId,
        rfpId: item.rfpId ?? item.rfp_id ?? item.analysisRfpId ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      // Combine all activities
      const analyses = [...rfpAnalyses, ...proposalReviews, ...foiaAnalyses]
      const allActivities = [...analyses, ...chatSessions]

      const today = START_OF_DAY_FORMATTER(new Date())
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - (days - 1))

      const dayMap = new Map<string, number>()
      for (let offset = 0; offset < days; offset++) {
        const current = new Date(startDate)
        current.setDate(startDate.getDate() + offset)
        dayMap.set(getDateKey(current), 0)
      }

      const analystMap = new Map<string, number>()

      // Per-RFP activity aggregation
      type RfpActivity = {
        rfpId: string
        rfpTitle?: string
        analyses: number
        proposalReviews: number
        foiaAnalyses: number
        chatMessages: number
        updates: number
      }
      const rfpActivityMap = new Map<string, RfpActivity>()

      // Process analyses (RFP + Proposal Reviews + FOIA) for daily volume
      analyses.forEach((analysis) => {
        const createdAt = parseAnalysisDate(analysis.createdAt)
        if (!createdAt) {
          return
        }

        const normalized = START_OF_DAY_FORMATTER(createdAt)
        if (normalized < startDate || normalized > today) {
          return
        }

        const key = getDateKey(normalized)
        dayMap.set(key, (dayMap.get(key) || 0) + 1)

        // Track per-RFP analysis counts
        const rfpId = (analysis as any).rfpId
        if (rfpId) {
          const current: RfpActivity = rfpActivityMap.get(rfpId) || {
            rfpId,
            rfpTitle: (analysis as any).rfpTitle,
            analyses: 0,
            proposalReviews: 0,
            foiaAnalyses: 0,
            chatMessages: 0,
            updates: 0
          }
          current.analyses += 1
          if (!current.rfpTitle && (analysis as any).rfpTitle) current.rfpTitle = (analysis as any).rfpTitle
          rfpActivityMap.set(rfpId, current)
        }
      })

      // Process all activities (including chat) for analyst activity
      allActivities.forEach((activity) => {
        const createdAt = parseAnalysisDate(activity.createdAt)
        if (!createdAt) {
          return
        }

        const normalized = START_OF_DAY_FORMATTER(createdAt)
        if (normalized < startDate || normalized > today) {
          return
        }

        const analystKey = activity.submittedBy || activity.userEmail || 'Unknown'
        const currentCount = analystMap.get(analystKey) || 0
        analystMap.set(analystKey, currentCount + 1)

        // Track per-RFP counts for proposal reviews, FOIA, chat
        const rfpId = (activity as any).rfpId
        if (rfpId) {
          const current: RfpActivity = rfpActivityMap.get(rfpId) || {
            rfpId,
            rfpTitle: (activity as any).rfpTitle,
            analyses: 0,
            proposalReviews: 0,
            foiaAnalyses: 0,
            chatMessages: 0,
            updates: 0
          }
          if ((proposalReviews as any).includes(activity)) current.proposalReviews += 1
          else if ((foiaAnalyses as any).includes(activity)) current.foiaAnalyses += 1
          else if ((chatSessions as any).includes(activity)) current.chatMessages += 1
          if (!current.rfpTitle && (activity as any).rfpTitle) current.rfpTitle = (activity as any).rfpTitle
          rfpActivityMap.set(rfpId, current)
        }
      })

      const volumeSeries: VolumePoint[] = Array.from(dayMap.entries()).map(([date, count]) => {
        const labelDate = new Date(`${date}T00:00:00`)
        return {
          date,
          label: DATE_FORMATTER.format(labelDate),
          count
        }
      })

      const totalAnalyses = volumeSeries.reduce((sum, point) => sum + point.count, 0)
      let averagePerDay = days > 0 ? Number((totalAnalyses / days).toFixed(1)) : 0

      // Compute average per day based on all-time data if available (fallback to 30-day avg)
      try {
        const [rfpAll, reviewsAll, foiaAll] = await Promise.all([
          apiClient.get('/rfp-analyses'),
          apiClient.get('/analytics/all-proposal-reviews'),
          apiClient.get('/analytics/all-foia-analyses')
        ])

        const normalizeDates = (items: any[], field: string) =>
          items
            .map((x) => parseAnalysisDate(x[field]))
            .filter((d): d is Date => !!d)

        const rfpDates = normalizeDates(rfpAll.data?.analyses || [], 'createdAt')
        const reviewDates = normalizeDates(reviewsAll.data?.reviews || [], 'createdAt')
        const foiaDates = normalizeDates(foiaAll.data?.analyses || [], 'createdAt')
        const allDates = [...rfpDates, ...reviewDates, ...foiaDates]

        if (allDates.length) {
          const earliest = allDates.reduce((min, d) => (d < min ? d : min), allDates[0])
          const todayAll = START_OF_DAY_FORMATTER(new Date())
          const daysBetween = Math.max(1, Math.ceil((todayAll.getTime() - START_OF_DAY_FORMATTER(earliest).getTime()) / (1000 * 60 * 60 * 24)))

          const totalAll =
            (rfpAll.data?.analyses?.length || 0) +
            (reviewsAll.data?.reviews?.length || 0) +
            (foiaAll.data?.analyses?.length || 0)

          averagePerDay = Number((totalAll / daysBetween).toFixed(1))
        }
      } catch {
        // Ignore all-time fallback errors and keep 30-day average
      }

      let busiestDay: VolumePoint | undefined
      if (volumeSeries.length > 0) {
        const maxEntry = volumeSeries.reduce(
          (max, point) => (point.count > max.count ? point : max),
          volumeSeries[0]
        )
        busiestDay = maxEntry.count > 0 ? maxEntry : undefined
      }

      const topAnalysts: AnalystActivityPoint[] = Array.from(analystMap.entries())
        .map(([analyst, count]) => ({
          analyst: formatAnalystLabel(analyst),
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      const recentWeek = volumeSeries.slice(-7).reduce((sum, point) => sum + point.count, 0)
      const previousWeek = volumeSeries.slice(-14, -7).reduce((sum, point) => sum + point.count, 0)
      const weekOverWeekChange =
        previousWeek > 0 ? Number((((recentWeek - previousWeek) / previousWeek) * 100).toFixed(1)) : null

      // Try to map RFP IDs to official Monday item titles
      try {
        const rfpItemsResp = await apiClient.get('/monday/rfp-items')
        const items: Array<{ id: string; title: string }> = rfpItemsResp.data?.items || []
        const titleMap = new Map<string, string>(items.map((it) => [String(it.id), it.title]))
        rfpActivityMap.forEach((value, key) => {
          const mapped = titleMap.get(String(key))
          if (mapped) {
            value.rfpTitle = mapped
          }
        })
      } catch {
        // Ignore mapping errors
      }

      // Fetch Monday updates for top candidate RFPs by non-update activity
      const candidates = Array.from(rfpActivityMap.values())
        .sort((a, b) => (b.analyses + b.proposalReviews + b.foiaAnalyses + b.chatMessages) - (a.analyses + a.proposalReviews + a.foiaAnalyses + a.chatMessages))
        .slice(0, 10)

      await Promise.all(
        candidates.map(async (c) => {
          if (!c.rfpId) return
          try {
            const resp = await apiClient.get(`/monday/items/${c.rfpId}/updates`)
            const updates: Array<{ createdAt?: unknown }> = resp.data?.updates || []
            const countInRange = updates.reduce((acc, u) => {
              const d = parseAnalysisDate(u.createdAt)
              if (!d) return acc
              const normalized = START_OF_DAY_FORMATTER(d)
              if (normalized < startDate || normalized > today) return acc
              return acc + 1
            }, 0)
            const current = rfpActivityMap.get(c.rfpId)
            if (current) current.updates = countInRange
          } catch {
            // ignore failures
          }
        })
      )

      // Determine most active RFP
      let mostActive: RfpAnalyticsSummary['mostActiveRfp'] | undefined
      let mostActiveList: NonNullable<RfpAnalyticsSummary['mostActiveRfps']> | undefined
      if (rfpActivityMap.size > 0) {
        const ranked = Array.from(rfpActivityMap.values())
          .map((x) => ({
            rfpId: x.rfpId,
            rfpTitle: x.rfpTitle,
            totalActivity: x.analyses + x.proposalReviews + x.foiaAnalyses + x.chatMessages + x.updates,
            counts: {
              analyses: x.analyses,
              proposalReviews: x.proposalReviews,
              foiaAnalyses: x.foiaAnalyses,
              chatMessages: x.chatMessages,
              updates: x.updates
            }
          }))
          .sort((a, b) => b.totalActivity - a.totalActivity)
        if (ranked.length && ranked[0].totalActivity > 0) {
          mostActive = ranked[0]
          mostActiveList = ranked.slice(0, 3)
        }
      }

      return {
        totalAnalyses,
        averagePerDay,
        uniqueAnalysts: analystMap.size,
        volumeSeries,
        topAnalysts,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: today.toISOString()
        },
        busiestDay,
        weekOverWeekChange,
        mostActiveRfp: mostActive,
        mostActiveRfps: mostActiveList
      }
    } catch (error) {
      console.error('Failed to build analytics summary:', error)
      throw error
    }
  }
}
