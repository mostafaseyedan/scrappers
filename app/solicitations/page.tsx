"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
// Removed unused Select UI imports
import { Input } from "@/components/ui/input";
import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Solicitation } from "./solicitation";
import queryString from "query-string";
import { useDebouncedCallback } from "use-debounce";
import { EditSolDialog } from "./editSolDialog";
import { CreateCommentDialog } from "./createCommentDialog";
import { CreateSolDialog } from "./createSolDialog";
import { TopBar } from "./topBar";
import { UserContext } from "../userContext";
import { uidsToNames } from "@/lib/utils";
import { solicitation as solModel } from "@/app/models";
import LogsPage from "../logs/page";
import SourcesPage from "../sources/page";
import { SolicitationDetail } from "./SolicitationDetail";
import { AiChat } from "au/components/AiChat";
import { chat as chatModel } from "@/app/models2";

import styles from "./page.module.scss";

type SearchSolsParams = {
  q?: string;
  limit?: number;
  page?: number;
  sort?: string;
  filters?: Record<string, any>;
};

type ActiveSection = "solicitations" | "logs" | "sources" | "chat";

export default function Page() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("solicitations");
  const [sols, setSols] = useState<any[]>([]);
  const [limit] = useState(10000); // Effectively no limit
  const [filterFacets, setFilterFacets] = useState<
    Record<string, Array<{ value: string; count: number }>>
  >({});
  const [filters, setFilters] = useState<{
    cnStatus?: string;
    [key: string]: any;
  }>({ cnStatus: "new" });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [listError, setListError] = useState("");
  const [sort, setSort] = useState("updated desc");
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [activeSolId] = useState<string>("");
  const [selectedSolId, setSelectedSolId] = useState<string | null>(null);
  const [expandedSolIds, setExpandedSolIds] = useState<string[]>([]);
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);
  const [showCreateSol, setShowCreateSol] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [, setCalculatingScores] = useState(false);
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;

  const debouncedSearchSols = useDebouncedCallback(
    async (params: Partial<SearchSolsParams>) => {
      await searchSols(params);
    },
    500
  );

  const topBarRef = useRef<{ refresh?: () => void }>(null);

  async function processIncomingSols(sols: Record<string, any>[]) {
    const userIds: string[] = [];
    sols.forEach((sol: Record<string, any>) => {
      userIds.push(...(sol.viewedBy || []));
    });
    const userNames = getUser ? await uidsToNames(userIds, getUser) : [];
    const userMap = new Map(userIds.map((id, idx) => [id, userNames[idx]]));

    sols.map((sol: Record<string, any>) => {
      sol.viewedByNames = (sol.viewedBy || []).map((uid: string) => {
        return userMap.get(uid) || uid;
      });
      return sol;
    });

    return sols;
  }

  async function searchSols(
    params: Partial<SearchSolsParams> = { filters: {} }
  ) {
    const {
      q: paramQ,
      limit: paramLimit,
      page: paramPage,
      sort: paramSort,
      filters: paramFilters,
    } = params;

    // Use state if param is undefined
    const finalLimit = paramLimit ?? limit;
    const finalPage = paramPage ?? page;
    const finalSort = paramSort ?? sort;
    const finalFilters = paramFilters ?? filters;
    const finalQ = paramQ || q;

    const flattenedFilters = {} as Record<string, any>;
    for (const [key, value] of Object.entries(finalFilters)) {
      flattenedFilters[`filters.${key}`] = value;
    }

    const queryObject = {
      q: finalQ,
      limit: finalLimit,
      page: finalPage,
      sort: finalSort,
      ...flattenedFilters,
    } as Record<string, any>;
    if (q) delete queryObject["filters.cnStatus"];
    const urlQueryString = queryString.stringify(queryObject);
    const resp = await fetch(`/api/solicitations/search?${urlQueryString}`);
    const data = await resp.json();
    const total = data.total || 0;
    let dbSols = data.results || [];

    if (dbSols.length > 0) {
      dbSols = await processIncomingSols(dbSols);
    }

    setSols(dbSols);

    if (q || Object.keys(finalFilters).length > 0) {
      setTotalFiltered(total);
    } else {
      setTotalFiltered(0);
      setTotalRecords(total);
    }

    setTotalPages(Math.ceil(total / finalLimit));
  }

  const getFilterFacets = async () => {
    const res = await fetch("/api/solicitations/search/options");
    const json = await res.json();
    setFilterFacets(json.facets || {});
  };

  async function getSols() {
    let sols = await solModel
      .get({ limit, page, sort, filters })
      .catch((err: unknown) => {
        console.error(err);
        return { error: err instanceof Error ? err.message : String(err) };
      });
    const total = sols.total || 0;

    if (sols.error || !sols.results) {
      setListError(sols.error || "An unknown server error occurred");
      return;
    }

    if (sols.results.length === 0) {
      setSols([]);
      setTotalRecords(0);
      setListError("");
      return;
    }

    if (sols.results?.length) {
      sols = await processIncomingSols(sols.results);
      setListError("");
      setSols(sols);
    }

    if (Object.keys(filters).length > 0) {
      setTotalFiltered(total);
    } else {
      setTotalFiltered(0);
      setTotalRecords(total);
    }

    setTotalPages(Math.ceil(total / limit));
  }

  const refreshSols: (options?: {
    list?: boolean;
    topBar?: boolean;
  }) => Promise<void> = async (options = {}) => {
    const { list = true, topBar = true } = options || {};
    if (list) {
      if (
        q ||
        Object.keys(filters).filter((k) => k !== "cnStatus" || k !== "cnStatus")
          .length > 0
      )
        await debouncedSearchSols({ filters, limit, page, q, sort });
      else await getSols();
    }
    if (topBar) await topBarRef.current?.refresh?.();
  };

  const calculateScores = async () => {
    setCalculatingScores(true);

    try {
      // Filter solicitations that need scoring or cnType update:
      // 1. "new" status without scores, OR
      // 2. Items with scores < 50% that aren't marked as nonRelevant
      const solsToProcess = sols.filter(
        (sol) => {
          const needsScore = sol.cnStatus === "new" && (sol.aiPursueScore === null || sol.aiPursueScore === undefined);
          const needsNonRelevant = sol.aiPursueScore !== null &&
                                   sol.aiPursueScore !== undefined &&
                                   sol.aiPursueScore < 0.5 &&
                                   (!sol.cnType || !sol.cnType.includes("nonRelevant"));
          return needsScore || needsNonRelevant;
        }
      );

      console.log(`[Calculate Scores] Total sols: ${sols.length}`);
      console.log(`[Calculate Scores] Sols to process: ${solsToProcess.length}`);
      console.log(`[Calculate Scores] Sample sols:`, sols.slice(0, 3).map(s => ({
        id: s.id,
        cnStatus: s.cnStatus,
        aiPursueScore: s.aiPursueScore,
        cnType: s.cnType
      })));

      if (solsToProcess.length === 0) {
        toast.info("No solicitations to process");
        setCalculatingScores(false);
        return;
      }

      toast.info(`Processing ${solsToProcess.length} solicitations...`);

      // Prepare data to send (include all fields for AI scoring)
      const solsToScore = solsToProcess.map((sol) => ({
        id: sol.id,
        cnStatus: sol.cnStatus,
        aiPursueScore: sol.aiPursueScore,
        title: sol.title,
        description: sol.description,
        issuer: sol.issuer,
        location: sol.location,
        keywords: sol.keywords,
        categories: sol.categories,
        rfpType: sol.rfpType,
        cnType: sol.cnType,
        closingDate: sol.closingDate,
        questionsDueByDate: sol.questionsDueByDate,
        publishDate: sol.publishDate,
        site: sol.site,
        siteId: sol.siteId,
        documents: sol.documents,
        externalLinks: sol.externalLinks,
        contactName: sol.contactName,
        contactEmail: sol.contactEmail,
        contactPhone: sol.contactPhone,
      }));

      // Call API endpoint
      const response = await fetch("/api/solicitations/calculate-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitations: solsToScore }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate scores");
      }

      const { scores, updates, lowScoreUpdatesCount } = data;

      // Update each solicitation with its score and cnType if needed
      let updatedCount = 0;

      // Handle updates object which includes both new scores and low score updates
      if (updates && typeof updates === 'object') {
        for (const [solId, updateData] of Object.entries(updates)) {
          try {
            const patchData: Record<string, any> = {};
            const update = updateData as { score?: number; cnType?: string };

            // Add score if it's a new calculation
            if (scores && scores[solId] !== undefined) {
              const numericScore = typeof scores[solId] === 'number' ? scores[solId] : Number(scores[solId]);
              patchData.aiPursueScore = numericScore;
            }

            // Add cnType if specified (for scores < 50%)
            if (update.cnType) {
              patchData.cnType = update.cnType;
            }

            // Only patch if we have data to update
            if (Object.keys(patchData).length > 0) {
              await solModel.patch({ id: solId, data: patchData });
              updatedCount++;
            }
          } catch (err) {
            console.error(`Failed to update ${solId}:`, err);
          }
        }
      }

      toast.success(
        `Successfully updated ${updatedCount} solicitations${lowScoreUpdatesCount > 0 ? ` (${lowScoreUpdatesCount} existing low scores marked as nonRelevant)` : ''}`
      );

      // Refresh the list
      await refreshSols();
    } catch (error: any) {
      console.error("Calculate scores error:", error);
      toast.error(error.message || "Failed to calculate scores");
    } finally {
      setCalculatingScores(false);
    }
  };

  useEffect(() => {
    getFilterFacets();
  }, []);

  useEffect(() => {
    (async () => {
      document.title = `Solicitations | Cendien Recon`;
      await refreshSols();
    })();

    // window.addEventListener("focus", () => refreshSols());

    return () => {
      // window.removeEventListener("focus", () => refreshSols());
    };
  }, [filters, q]);

  useEffect(() => {
    refreshSols({ list: true, topBar: false });
  }, [page, limit, sort]);

  const handleSelectSol = (solId: string) => {
    setSelectedSolId(solId);
    setShowChat(false); // Close chat when selecting a solicitation
    // Don't update URL - it causes unnecessary re-renders and slows down navigation
  };

  return (
    <div className={styles.page}>
      {activeSection === "solicitations" && (
      <div className={styles.pageLayout}>
        {/* Left Panel - Solicitations List */}
        <div
          className={styles.pageLayout_leftPanel}
          data-collapsed={isListCollapsed || undefined}
        >
          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setIsListCollapsed(!isListCollapsed)}
            aria-label={isListCollapsed ? "Expand list" : "Collapse list"}
            className={styles.pageLayout_toggleButton}
          >
            <ChevronLeft className={styles.pageLayout_toggleButton_icon} />
          </button>

          <div className={styles.pageLayout_leftPanel_content}>
            <TopBar
              q={q}
              filterFacets={filterFacets}
              setFilters={setFilters}
              setQ={setQ}
              setSort={setSort}
              setPage={setPage}
              setTotalRecords={setTotalRecords}
              queryParams={{ q, filters, limit, page, sort }}
              expandedSolIds={expandedSolIds}
              setExpandedSolIds={setExpandedSolIds}
              onClickCreateSol={() => setShowCreateSol(true)}
              onShowLogs={() => {
                setSelectedSolId(null);
                setShowChat(false); // Close chat
                setActiveSection("solicitations"); // Keep in solicitations view
              }}
              onShowSources={() => {
                setSelectedSolId("sources"); // Use special "sources" value
                setShowChat(false); // Close chat
                setActiveSection("solicitations");
              }}
              onShowChat={() => {
                setShowChat(!showChat);
                if (!showChat) {
                  setSelectedSolId(null); // Clear selection when opening chat
                }
              }}
              onCalculateScores={calculateScores}
              ref={topBarRef}
            />
            <div className={styles.pageLayout_leftPanel_list}>
              {listError ? (
                <p className="p-4 error">{listError}</p>
              ) : sols?.length ? (
                sols.map((sol, index) => (
                  <Solicitation
                    key={sol.id || `sol-${index}`}
                    sol={sol}
                    refreshSols={refreshSols}
                    onSelectSol={() => handleSelectSol(sol.id)}
                    isSelected={selectedSolId === sol.id}
                    expandedSolIds={expandedSolIds}
                    setExpandedSolIds={setExpandedSolIds}
                    variant={
                      expandedSolIds.includes(sol.id) ? "expanded" : "compact"
                    }
                  />
                ))
              ) : (
                <p className="p-4">No results found</p>
              )}
            </div>
            <div className={styles.pageLayout_leftPanel_pagination}>
              {q || Object.keys(filters).length > 0 ? (
                <>
                  {totalFiltered} out {totalRecords} items.
                </>
              ) : (
                <>Showing all {totalRecords} items.</>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <Input
                className={styles.pageLayout_leftPanel_pagination_page}
                type="text"
                onChange={(e) => {
                  const newPage = Number(e.target.value);
                  if (newPage > 0 && newPage <= totalPages) {
                    setPage(newPage);
                  }
                }}
                value={page}
              />
              / {totalPages}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight />
              </Button>
            </div>

            {/* Collapsed state hint */}
            {isListCollapsed && (
              <div className={styles.pageLayout_leftPanel_collapsedHint}>
                <span>RFPs</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Detail, Logs, Sources, or Chat */}
        <div className={styles.pageLayout_rightPanel}>
          {showChat ? (
            <div className={styles.pageLayout_rightPanel_chat}>
              <div className="bg-white rounded-lg shadow h-full">
                <AiChat chatKey="solicitationsChat" model={chatModel} />
              </div>
            </div>
          ) : selectedSolId === "sources" ? (
            <div className={styles.pageLayout_rightPanel_sources}>
              <div className="bg-white rounded-lg shadow p-6">
                <SourcesPage />
              </div>
            </div>
          ) : selectedSolId ? (
            <div className={styles.pageLayout_rightPanel_detail}>
              <SolicitationDetail
                solId={selectedSolId}
                onRefresh={() => {
                  // Only refresh the single solicitation in the list, not everything
                  solModel.getById({ id: selectedSolId }).then((updatedSol: any) => {
                    setSols((prevSols) =>
                      prevSols.map((s) => (s.id === selectedSolId ? updatedSol : s))
                    );
                  }).catch(console.error);
                }}
              />
            </div>
          ) : (
            <div className={styles.pageLayout_rightPanel_logs}>
              <LogsPage />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Dialogs */}
      <EditSolDialog
        solId={activeSolId}
        open={showEditSol}
        onOpenChange={setShowEditSol}
        onSubmitSuccess={() => refreshSols()}
      />

      <CreateCommentDialog
        solId={activeSolId}
        open={showCreateComment}
        onOpenChange={setShowCreateComment}
        onSubmitSuccess={() => refreshSols()}
      />

      <CreateSolDialog
        open={showCreateSol}
        onOpenChange={setShowCreateSol}
        onSubmitSuccess={() => refreshSols()}
      />
    </div>
  );
}
