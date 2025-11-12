import apiClient from './apiClient'

export interface MondayStatusMetadata {
  label?: string | null
  index?: number | null
  post_id?: string | null
}

export interface MondayRfpItem {
  id: string
  mondayId: string
  title: string
  fileName: string
  createdAt: string | null
  groupId?: string | null
  group?: string | null
  solutionType?: string | null
  rfpType?: string | null
  rfpTypeColor?: string | null
  projectStatus?: string | null
  projectStatusColor?: string | null
  statusMetadata?: MondayStatusMetadata | null
  sharePointUrl?: string | null
  sharePointFolderId?: string | null
  source?: string
  columnValues?: Array<Record<string, unknown>>
}

export const mondayService = {
  async getRFPItems(): Promise<MondayRfpItem[]> {
    try {
      const response = await apiClient.get('/monday/rfp-items')
      return response.data.items || []
    } catch (error) {
      console.error('Failed to fetch RFP items from Monday.com:', error)
      throw error
    }
  },

  async syncRFPs(): Promise<{ success: boolean; synced_count: number; errors: string[] }> {
    try {
      const response = await apiClient.post('/monday/sync-rfps')
      return response.data
    } catch (error) {
      console.error('Failed to sync RFPs from Monday.com:', error)
      throw error
    }
  },
}
