import { useState, useMemo, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { mondayService, type MondayRfpItem } from '@/services/mondayService'
import apiClient from '@/services/apiClient'

interface RFPListProps {
  selectedRfp: MondayRfpItem | null
  onRfpSelect: (rfp: MondayRfpItem) => void
  onShowAnalytics?: () => void
}

const ALLOWED_GROUPS = {
  new_group_mkmx60x6: 'Shortlist / Direct / Monitor',
  '1683151669_book': 'RFPs',
  duplicate_of_completed_project: 'Post-submission',
  new_group10961: 'Submitted RFPs',
  group_mktaa0at: 'FOIA Received'
} as const

type AllowedGroupId = keyof typeof ALLOWED_GROUPS

const ALLOWED_GROUP_ENTRIES = Object.entries(ALLOWED_GROUPS) as Array<[AllowedGroupId, string]>
const ALLOWED_GROUP_IDS: AllowedGroupId[] = ALLOWED_GROUP_ENTRIES.map(([groupId]) => groupId)
const ALLOWED_GROUP_ID_SET = new Set<string>(ALLOWED_GROUP_IDS)
const ALLOWED_GROUP_TITLES = new Set<string>(ALLOWED_GROUP_ENTRIES.map(([, title]) => title))

// Monday.com brand colors
const MONDAY_COLORS = {
  PRIMARY: '#6161FF',        // Cornflower Blue
  GREEN: '#00c875',          // Success/Done
  ORANGE: '#fdab3d',         // Warning
  RED: '#e2445c',            // Error/Not Won
  BLUE: '#579BFC',           // Info
  PURPLE: '#a25ddc',         // Purple accent
  GRAY: '#C4C4C4'            // Hold/Inactive
} as const

// Helper function to count actual work done (analyses/reviews) for items in a group
const getItemTypeBreakdown = (
  items: MondayRfpItem[],
  analysisCounts: Record<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }>
): string => {
  let rfpAnalysesTotal = 0
  let proposalReviewsTotal = 0
  let foiaAnalysesTotal = 0

  // Sum up actual analyses/reviews for all RFPs in this group
  items.forEach((item) => {
    const counts = analysisCounts[item.id]
    if (counts) {
      rfpAnalysesTotal += counts.rfpAnalyses
      proposalReviewsTotal += counts.proposalReviews
      foiaAnalysesTotal += counts.foiaAnalyses
    }
  })

  // Format: "10 RFP Analyses / 5 Proposal Reviews / 1 FOIA Analysis"
  // Only show non-zero counts
  const parts: string[] = []

  if (rfpAnalysesTotal > 0) {
    parts.push(`${rfpAnalysesTotal} RFP Analys${rfpAnalysesTotal === 1 ? 'is' : 'es'}`)
  }
  if (proposalReviewsTotal > 0) {
    parts.push(`${proposalReviewsTotal} Proposal Review${proposalReviewsTotal === 1 ? '' : 's'}`)
  }
  if (foiaAnalysesTotal > 0) {
    parts.push(`${foiaAnalysesTotal} FOIA Analys${foiaAnalysesTotal === 1 ? 'is' : 'es'}`)
  }

  return parts.length > 0 ? parts.join(' / ') : 'No analyses yet'
}

const RFPList = ({ selectedRfp, onRfpSelect, onShowAnalytics }: RFPListProps) => {
  const [rfps, setRfps] = useState<MondayRfpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(ALLOWED_GROUP_IDS) // All groups collapsed by default (Monday.com pattern)
  )

  // Store analysis counts per RFP
  const [analysisCounts, setAnalysisCounts] = useState<Record<string, {
    rfpAnalyses: number
    proposalReviews: number
    foiaAnalyses: number
  }>>({})

  // Get Monday.com group color based on group
  const getGroupColor = useCallback((groupId?: string | null, groupTitle?: string | null): string => {
    // Submitted RFPs and Post-submission: green
    if (groupId === 'new_group10961' || groupId === 'duplicate_of_completed_project' ||
        groupTitle === 'Submitted RFPs' || groupTitle === 'Post-submission') {
      return MONDAY_COLORS.GREEN
    }

    // FOIA Received: green
    if (groupId === 'group_mktaa0at' || groupTitle === 'FOIA Received') {
      return MONDAY_COLORS.GREEN
    }

    // Shortlist / Direct / Monitor and RFPs: blue (same color like Monday.com)
    if (groupId === 'new_group_mkmx60x6' || groupId === '1683151669_book' ||
        groupTitle === 'Shortlist / Direct / Monitor' || groupTitle === 'RFPs') {
      return MONDAY_COLORS.BLUE
    }

    // Default: blue
    return MONDAY_COLORS.BLUE
  }, [])

  // Toggle single group collapse/expand
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  // Toggle all groups collapse/expand (Ctrl+G shortcut)
  const toggleAllGroups = useCallback(() => {
    if (collapsedGroups.size === 0) {
      // Collapse all
      setCollapsedGroups(new Set(ALLOWED_GROUP_IDS))
    } else {
      // Expand all
      setCollapsedGroups(new Set())
    }
  }, [collapsedGroups])

  // Fetch RFPs from Monday.com on mount
  useEffect(() => {
    loadRFPs()
  }, [])

  // Ctrl+G keyboard shortcut (Monday.com pattern)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        toggleAllGroups()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleAllGroups])

  // No custom status dropdown; using native select aligned with Sort

  const loadRFPs = async () => {
    try {
      setLoading(true)
      const items = await mondayService.getRFPItems()
      setRfps(items)

      // Load analysis counts for all RFPs
      await loadAnalysisCounts(items)
    } catch (error) {
      console.error('Failed to load RFPs:', error)
      toast.error('Failed to load RFPs from Monday.com')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalysisCounts = async (rfpItems: MondayRfpItem[]) => {
    try {
      // Fetch all analyses, proposal reviews, and FOIA analyses using analytics endpoints
      // Note: apiClient already has baseURL='/api', so we don't add /api prefix
      const [rfpAnalysesRes, proposalReviewsRes, foiaAnalysesRes] = await Promise.all([
        apiClient.get('/rfp-analyses', { params: { limit: 1000 } }),
        apiClient.get('/analytics/all-proposal-reviews', { params: { limit: 1000 } }),
        apiClient.get('/analytics/all-foia-analyses', { params: { limit: 1000 } })
      ])

      const rfpAnalyses = rfpAnalysesRes.data?.analyses || []
      const proposalReviews = proposalReviewsRes.data?.reviews || []
      const foiaAnalyses = foiaAnalysesRes.data?.analyses || []

      // Loaded analyses counts for debugging removed

      // Count analyses/reviews per RFP
      const counts: Record<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }> = {}

      rfpItems.forEach((rfp) => {
        // Match by multiple possible ID fields (rfpId, mondayRfpId, mondayId)
        const matchesRfp = (item: any) =>
          item.rfpId === rfp.id ||
          item.rfpId === rfp.mondayId ||
          item.mondayRfpId === rfp.id ||
          item.mondayRfpId === rfp.mondayId ||
          item.mondayId === rfp.id ||
          item.mondayId === rfp.mondayId

        counts[rfp.id] = {
          rfpAnalyses: rfpAnalyses.filter(matchesRfp).length,
          proposalReviews: proposalReviews.filter(matchesRfp).length,
          foiaAnalyses: foiaAnalyses.filter(matchesRfp).length
        }
      })

      setAnalysisCounts(counts)
    } catch (error) {
      console.error('Failed to load analysis counts:', error)
      // Don't show error toast - analysis counts are optional enhancement
    }
  }

  const handleSyncMonday = async () => {
    try {
      setSyncing(true)
      const result = await mondayService.syncRFPs()
      toast.success(`Successfully synced ${result.synced_count} RFPs from Monday.com!`)
      await loadRFPs() // This will also reload analysis counts
    } catch (error) {
      console.error('Monday sync error:', error)
      toast.error('Failed to sync RFPs from Monday.com')
    } finally {
      setSyncing(false)
    }
  }

  // Check if RFP is in allowed group - memoized to prevent recreation
  const isRfpInAllowedGroup = useCallback((rfp: MondayRfpItem) => {
    if (rfp.groupId && ALLOWED_GROUP_ID_SET.has(rfp.groupId)) {
      return true
    }
    if (!rfp.group) {
      return false
    }
    return ALLOWED_GROUP_TITLES.has(rfp.group)
  }, [])

  const allowedRfps = useMemo(() => rfps.filter((rfp) => isRfpInAllowedGroup(rfp)), [rfps, isRfpInAllowedGroup])

  // Get unique status options scoped to allowed groups
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>()
    allowedRfps.forEach((rfp) => {
      if (rfp.projectStatus) {
        statuses.add(rfp.projectStatus)
      }
    })
    statuses.add('Not Won')
    return Array.from(statuses).sort()
  }, [allowedRfps])

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setStatusFilters(value ? [value] : [])
  }, [])

  const hasStatusFilters = statusFilters.length > 0
  const hasSearch = searchQuery.trim().length > 0
  const hasActiveFilters = hasStatusFilters || hasSearch

  // Filter and sort RFPs based on search, status, and sort order
  const filteredRfps = useMemo(() => {
    let filtered = allowedRfps

    // Filter by selected statuses
    if (hasStatusFilters) {
      const statusSet = new Set(statusFilters)
      filtered = filtered.filter((rfp) => rfp.projectStatus && statusSet.has(rfp.projectStatus))
    }

    // Filter by search query
    if (hasSearch) {
      const query = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (rfp) =>
          rfp.title?.toLowerCase().includes(query) ||
          rfp.projectStatus?.toLowerCase().includes(query) ||
          rfp.group?.toLowerCase().includes(query)
      )
    }

    // Sort by date
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0

      return sortBy === 'newest' ? dateB - dateA : dateA - dateB
    })

    return sorted
  }, [allowedRfps, hasSearch, hasStatusFilters, searchQuery, statusFilters, sortBy])

  // Group RFPs by groupId (for collapsible groups)
  const groupedRfps = useMemo(() => {
    const groups = new Map<string, { items: MondayRfpItem[]; groupId: string; groupTitle: string }>()

    filteredRfps.forEach((rfp) => {
      const groupKey = rfp.groupId || 'ungrouped'
      const groupTitle = rfp.group || 'Other'

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          items: [],
          groupId: groupKey,
          groupTitle
        })
      }
      groups.get(groupKey)!.items.push(rfp)
    })

    return groups
  }, [filteredRfps])

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b dark:border-[#4b4e69]">
          <div className="text-sm font-medium text-gray-700 dark:text-[#d5d8df]">Loading RFPs...</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b dark:border-[#4b4e69]">
        {/* Controls in one row: Status, Search, Sort, Analytics, Monday */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilters[0] || ''}
            onChange={handleStatusChange}
            className="w-28 flex-shrink-0 text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles..."
              className="text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-28"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-20 flex-shrink-0 text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="newest">Latest</option>
              <option value="oldest">Earliest</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="ml-auto flex items-center gap-2">
            {onShowAnalytics && (
              <button
                onClick={onShowAnalytics}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Analytics
              </button>
            )}
            <button
              onClick={handleSyncMonday}
              disabled={syncing}
              title={syncing ? 'Syncing...' : 'Sync Monday RFPs'}
              className="h-9 w-9 bg-white dark:bg-[#30324e] rounded hover:bg-gray-100 dark:hover:bg-[#323861] disabled:opacity-50 flex items-center justify-center"
            >
              {syncing ? (
                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              ) : (
                <img src="/images/monday.svg" alt="Monday.com" className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RFP List with Collapsible Groups (Monday.com card-based pattern) */}
      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-[#181b34] py-4">
        {filteredRfps.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            {hasActiveFilters ? (
              <p className="text-sm">No RFPs match the selected filters.</p>
            ) : (
              <>
                <div className="text-2xl mb-2"></div>
                <p>No RFPs yet</p>
                <p className="text-sm">Click the Monday icon to sync</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(groupedRfps.entries()).map(([groupId, { items, groupTitle }]) => {
              const isCollapsed = collapsedGroups.has(groupId)
              const groupColor = getGroupColor(groupId, groupTitle)

              return (
                <div
                  key={groupId}
                  className={`shadow-sm overflow-hidden bg-white ${
                    isCollapsed ? 'dark:bg-[#30324e]' : 'dark:bg-transparent'
                  }`}
                >
                  {/* Group Header (Monday.com layout: border | arrow | title) */}
                  <div
                    onClick={() => toggleGroup(groupId)}
                    className={`flex items-center gap-2 py-3 cursor-pointer transition-colors relative bg-white ${
                      isCollapsed
                        ? 'dark:bg-[#30324e] hover:bg-gray-50 dark:hover:bg-[#3a3d5c]'
                        : 'dark:bg-transparent hover:bg-gray-50 dark:hover:bg-transparent'
                    }`}
                  >
                    {/* Left Border (Monday.com style - only shown when collapsed) */}
                    {isCollapsed && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ backgroundColor: groupColor }}
                      />
                    )}

                    {/* Content (with left padding for border) */}
                    <div className="flex items-center gap-2 pl-4 pr-4 w-full">
                      {/* Expand/Collapse Chevron (Monday.com style) */}
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${
                          isCollapsed ? '' : 'rotate-90'
                        }`}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: groupColor }}
                      >
                        <polyline points="6,4 10,8 6,12" />
                      </svg>

                      {/* Group Title and Breakdown */}
                      <div className="flex-1 min-w-0">
                        {/* Group Title (color matches border, bigger font) */}
                        <h3
                          className="text-base font-semibold"
                          style={{ color: groupColor }}
                        >
                          {groupTitle}
                        </h3>

                        {/* Item Type Breakdown (Monday.com style: "11 items / 50 subitems") */}
                        <div className="text-sm text-gray-500 dark:text-[#9699a6] mt-0.5">
                          {getItemTypeBreakdown(items, analysisCounts)}
                        </div>
                      </div>

                      {/* Item Count Badge (shown when collapsed) */}
                      {isCollapsed && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-[#3e4259] text-gray-700 dark:text-[#d5d8df]">
                          {items.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Group Items (shown when expanded) */}
                  {!isCollapsed && (
                    <div className="border-t border-gray-100 dark:border-[#3e4259]">
                      {items.map((rfp) => (
                        <div
                          key={rfp.id}
                          onClick={() => onRfpSelect(rfp)}
                          className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3a3d5c] transition-all duration-150 border-b border-gray-100 dark:border-[#3e4259] last:border-b-0 ${
                            selectedRfp?.id === rfp.id
                              ? 'bg-blue-50 dark:bg-[#13377433] border-r-4 border-r-[#6161FF]'
                              : 'bg-white dark:bg-[#30324e]'
                          }`}
                          style={{
                            borderLeft: `4px solid ${groupColor}`
                          }}
                        >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-[#d5d8df] truncate" title={rfp.title ?? ''}>
                      {rfp.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                      Created: {rfp.createdAt ? new Date(rfp.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {/* Project Status Badge (Monday.com styling) */}
                  {rfp.projectStatus && (
                    <span
                      className="inline-flex items-center px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: (() => {
                          const statusUpper = rfp.projectStatus?.toUpperCase()
                          if (statusUpper === 'NOT WON') return MONDAY_COLORS.RED
                          if (statusUpper === 'HOLD') return MONDAY_COLORS.GRAY
                          if (statusUpper === 'DONE' || statusUpper === 'COMPLETED') return MONDAY_COLORS.GREEN
                          if (statusUpper === 'WORKING' || statusUpper === 'IN PROGRESS') return MONDAY_COLORS.ORANGE
                          if (rfp.projectStatusColor) {
                            const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                            return `color-mix(in srgb, ${rfp.projectStatusColor} 85%, ${isDark ? 'white' : 'black'})`
                          }
                          return MONDAY_COLORS.PRIMARY
                        })(),
                        color: '#FFFFFF',
                        borderRadius: '20px'
                      }}
                    >
                      {rfp.projectStatus}
                    </span>
                  )}

                  {/* Req. Type Badge (Monday.com pill styling) */}
                  {rfp.rfpType && (
                    <span
                      className="inline-flex items-center px-3 py-1 text-xs font-medium text-white"
                      style={{
                        backgroundColor: rfp.rfpTypeColor || MONDAY_COLORS.PRIMARY,
                        color: '#FFFFFF',
                        borderRadius: '20px'
                      }}
                    >
                      {rfp.rfpType}
                    </span>
                  )}
                </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default RFPList
