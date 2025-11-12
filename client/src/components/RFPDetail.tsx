import { useState, useEffect } from 'react'
import type { MondayRfpItem } from '@/services/mondayService'
import apiClient from '@/services/apiClient'
import FilesTab from './rfp/FilesTab'
import ProposalsTab from './rfp/ProposalsTab'
import AnalysisTab from './rfp/AnalysisTab'
import UpdatesTab from './rfp/UpdatesTab'
import ChatTab from './rfp/ChatTab'
import FOIATab from './rfp/FOIATab'

interface RFPDetailProps {
  rfp: MondayRfpItem
}

type TabType = 'files' | 'updates' | 'foia' | 'analysis' | 'proposals' | 'chat'

const RFPDetail = ({ rfp }: RFPDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('analysis')
  const [winProbabilityScore, setWinProbabilityScore] = useState<number | null>(null)
  const [proposalReviewScore, setProposalReviewScore] = useState<number | null>(null)

  // Reset to analysis tab and scores when RFP changes
  useEffect(() => {
    setActiveTab('analysis')
    setWinProbabilityScore(null)
    setProposalReviewScore(null)

    const fetchLatestScores = async () => {
      try {
        // Fetch latest RFP analysis
        const analysisResponse = await apiClient.get('/rfp-analyses', {
          params: { rfpId: rfp.id }
        })
        const analyses = analysisResponse.data.analyses || []
        if (analyses.length > 0) {
          const latestAnalysis = analyses[0]
          const score = extractWinProbabilityScore(latestAnalysis.winProbability)
          setWinProbabilityScore(score)
        }

        // Fetch latest proposal review
        const reviewResponse = await apiClient.get('/proposal-reviews', {
          params: { rfpId: rfp.id }
        })
        const reviews = reviewResponse.data.reviews || []
        if (reviews.length > 0) {
          const latestReview = reviews[0]
          setProposalReviewScore(latestReview.overallScore || null)
        }
      } catch (error) {
        // Silent fail - badges just won't appear
        console.error('Failed to fetch scores:', error)
      }
    }

    fetchLatestScores()
  }, [rfp.id])


  const extractWinProbabilityScore = (raw: unknown): number | null => {
    if (raw == null) return null

    if (typeof raw === 'number') {
      return raw
    }

    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw)
      return Number.isFinite(parsed) ? parsed : null
    }

    if (typeof raw === 'object') {
      const probabilityScore = (raw as { probabilityScore?: unknown }).probabilityScore
      if (typeof probabilityScore === 'number') {
        return probabilityScore
      }
    }

    return null
  }

  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700'
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700'
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-700'
  }

  return (
    <div className={`bg-white dark:bg-[#30324e] rounded-lg shadow border border-gray-200 dark:border-[#797e93] flex flex-col ${activeTab === 'chat' ? 'h-full' : 'max-h-full'}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df]">{rfp.title}</h2>
            <div className="flex items-center mt-2 space-x-4">
              {/* Req Type Tag */}
              {rfp.rfpType && (
                <span
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                  style={{
                    backgroundColor: rfp.rfpTypeColor || '#9333EA',
                    color: '#FFFFFF'
                  }}
                >
                  {rfp.rfpType}
                </span>
              )}

              {/* Project Status Tag */}
              {rfp.projectStatus && (
                <span
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: rfp.projectStatusColor
                      ? (() => {
                          const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          return `color-mix(in srgb, ${rfp.projectStatusColor} 85%, ${isDark ? 'white' : 'black'})`
                        })()
                      : '#10B981',
                    color: '#FFFFFF'
                  }}
                >
                  {rfp.projectStatus}
                </span>
              )}

              {/* Creation Date */}
              {rfp.createdAt && (
                <span className="text-xs text-gray-500 dark:text-[#9699a6]">
                  Created: {new Date(rfp.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Score Badges */}
          <div className="flex items-center gap-3">
            {winProbabilityScore !== null && (
              <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(winProbabilityScore)}`}>
                <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Win Prob.</div>
                <div className="text-base font-bold">{winProbabilityScore}%</div>
              </div>
            )}

            {proposalReviewScore !== null && (
              <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(proposalReviewScore)}`}>
                <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Proposal</div>
                <div className="text-base font-bold">{proposalReviewScore}%</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69]">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'files'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'updates'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            Updates
          </button>
          <button
            onClick={() => setActiveTab('foia')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'foia'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            FOIA
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'analysis'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'proposals'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            Proposals
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-4 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'border-b-2 border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
            }`}
          >
            <img src="/images/gemini-icon.svg" alt="Chat" className="w-4 h-4" />
            Chat
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className={`${activeTab === 'chat' ? 'p-0 overflow-hidden' : 'p-2 overflow-y-auto'} flex-1 min-h-0`}>
        {activeTab === 'files' && (
          <FilesTab
            sharePointFolderId={rfp.sharePointFolderId || null}
            sharePointUrl={rfp.sharePointUrl || null}
            rfpId={rfp.id}
            onAnalysisSuccess={() => setActiveTab('analysis')}
            onReviewSuccess={() => setActiveTab('proposals')}
            onFoiaSuccess={() => setActiveTab('foia')}
          />
        )}
        {activeTab === 'updates' && <UpdatesTab rfpId={rfp.id} />}
        {activeTab === 'foia' && <FOIATab rfpId={rfp.id} />}
        {activeTab === 'analysis' && (
          <AnalysisTab
            rfpId={rfp.id}
            sharePointUrl={rfp.sharePointUrl || null}
            rfpTitle={rfp.title}
          />
        )}
        {activeTab === 'proposals' && <ProposalsTab rfpId={rfp.id} />}
        {activeTab === 'chat' && (
          <ChatTab
            rfpId={rfp.id}
            rfpTitle={rfp.title}
          />
        )}
      </div>
    </div>
  )
}

export default RFPDetail
