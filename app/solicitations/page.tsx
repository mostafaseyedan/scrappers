"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
// Removed unused Select UI imports
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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

const SOURCE_BRANDING: Record<
  string,
  { color: string; logo?: string; textColor?: string }
> = {
  biddirect: {
    color: "#005F9E",
    logo: "/images/logos/biddirect.png",
  },
  bidnetdirect: {
    color: "#005F9E",
    logo: "/images/logos/biddirect.png",
  },
  bidsync: {
    color: "#1E3A8A",
    logo: "/images/logos/bidsync_logo_primary2.png",
  },
  bonfirehub: {
    color: "#FF6B35",
    logo: "/images/logos/bonfire-wide-card-image.png",
  },
  bonfire: {
    color: "#FF6B35",
    logo: "/images/logos/bonfire-wide-card-image.png",
  },
  BonfireHub: {
    color: "#FF6B35",
    logo: "/images/logos/bonfire-wide-card-image.png",
  },
  bonafirehub: {
    color: "#FF6B35",
    logo: "/images/logos/bonfire-wide-card-image.png",
  },
  cammnet: {
    color: "#6D28D9",
    logo: "/images/logos/cammnet.png",
  },
  commbuys: {
    color: "#2563EB",
    logo: "/images/logos/commbuys.gif",
  },
  demandstar: {
    color: "#1F2937",
    logo: "/images/logos/Demandstar-logo-primary-endorsed-2048x428.png",
    textColor: "#FFFFFF",
  },
  findrfp: {
    color: "#D97706",
    logo: "/images/logos/findrfp-logo.gif",
  },
  floridabids: {
    color: "#0EA5E9",
  },
  govdirections: {
    color: "#2563EB",
    logo: "/images/logos/govdirections-logo.png",
  },
  governmentbidders: {
    color: "#DC2626",
    logo: "/images/logos/logo_governmentbidders.png",
    textColor: "#FFFFFF",
  },
  highergov: {
    color: "#0F766E",
    logo: "/images/logos/highergov_logo.jpg",
    textColor: "#FFFFFF",
  },
  instantmarkets: {
    color: "#9333EA",
    logo: "/images/logos/instantmarkets_square_1200x1200.png",
    textColor: "#FFFFFF",
  },
  merx: {
    color: "#BE123C",
    textColor: "#FFFFFF",
  },
  mygovwatch: {
    color: "#14B8A6",
    logo: "/images/logos/mygovwatch.png",
  },
  omniapartners: {
    color: "#111827",
    logo: "/images/logos/omniapartners.jpg",
    textColor: "#FFFFFF",
  },
  publicpurchase: {
    color: "#F59E0B",
    logo: "/images/logos/publicpurchase.png",
  },
  rfpmart: {
    color: "#B91C1C",
    logo: "/images/logos/rfpmart.png",
    textColor: "#FFFFFF",
  },
  techbids: {
    color: "#4C1D95",
    logo: "/images/logos/techbids.svg",
    textColor: "#FFFFFF",
  },
  txsmartbuy: {
    color: "#B91C1C",
    logo: "/images/logos/TxSmartBuy_rgb.avif",
    textColor: "#FFFFFF",
  },
  vendorline: {
    color: "#0EA5E9",
    logo: "/images/logos/vendorline.png",
  },
  vendorlink: {
    color: "#16A34A",
    logo: "/images/logos/vendorlink.png",
  },
  vendorregistry: {
    color: "#EA580C",
    logo: "/images/logos/vendorregistry_en-logo-inverted-rgb-2000px@72ppi.png",
    textColor: "#FFFFFF",
  },
};

const LOGO_VARIANTS: Record<string, "dark" | "muted"> = {
  vendorregistry: "dark",
  governmentbidders: "muted",
};

const FALLBACK_COLORS = [
  "#2563EB",
  "#DB2777",
  "#0EA5E9",
  "#059669",
  "#F97316",
  "#7C3AED",
  "#DC2626",
  "#14B8A6",
  "#F59E0B",
  "#1D4ED8",
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickColor = (key: string) =>
  FALLBACK_COLORS[hashString(key) % FALLBACK_COLORS.length];

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
  const [allSols, setAllSols] = useState<any[]>([]); // Store ALL relevant solicitations
  const [sols, setSols] = useState<any[]>([]); // Filtered solicitations for display
  const [limit] = useState(500); // Sidebar fetches up to 500 records (Firestore filters out nonRelevant)
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
  const [, setTotalFiltered] = useState(0);
  const [, setTotalRecords] = useState(0);
  const [activeSolId] = useState<string>("");
  const [selectedSolId, setSelectedSolId] = useState<string | null>(null);
  const [expandedSolIds, setExpandedSolIds] = useState<string[]>([]);
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);
  const [showCreateSol, setShowCreateSol] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [, setCalculatingScores] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    () => new Set()
  );
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;

  // Filter allSols locally based on filters state (instant, no API call)
  const filteredSols = useMemo(() => {
    if (!allSols.length) return [];

    let filtered = allSols;

    // Apply cnStatus filter
    if (filters.cnStatus) {
      filtered = filtered.filter((sol) => sol.cnStatus === filters.cnStatus);
    }

    // Apply other filters
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "cnStatus" && value) {
        filtered = filtered.filter((sol) => sol[key] === value);
      }
    }

    return filtered;
  }, [allSols, filters]);

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
    setIsLoading(true);
    try {
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
    } finally {
      setIsLoading(false);
    }
  }

  const getFilterFacets = async () => {
    const res = await fetch("/api/solicitations/search/options");
    const json = await res.json();
    setFilterFacets(json.facets || {});
  };

  async function getSols() {
    setIsLoading(true);
    try {
      // Fetch ALL relevant solicitations WITHOUT cnStatus filter (for local filtering)
      const solsResponse = await solModel
        .get({ limit: 10000, sort, filters: {} }) // No filters - get all relevant records
        .catch((err: unknown) => {
          console.error(err);
          return { error: err instanceof Error ? err.message : String(err) };
        });
      const total = solsResponse.total || 0;

      if (solsResponse.error || !solsResponse.results) {
        setListError(solsResponse.error || "An unknown server error occurred");
        return;
      }

      if (solsResponse.results.length === 0) {
        setAllSols([]);
        setSols([]);
        setTotalRecords(0);
        setListError("");
        return;
      }

      if (solsResponse.results?.length) {
        const processedSols = await processIncomingSols(solsResponse.results);
        setListError("");
        setAllSols(processedSols); // Store ALL solicitations
        // setSols will be updated by the useEffect watching filteredSols
      }

      setTotalRecords(total);
    } finally {
      setIsLoading(false);
    }
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
        // Build all patch operations first
        const patchPromises = Object.entries(updates).map(async ([solId, updateData]) => {
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
              return true; // Success
            }
            return false; // Nothing to update
          } catch (err) {
            console.error(`Failed to update ${solId}:`, err);
            return false; // Failed
          }
        });

        // Execute all patches in parallel
        const results = await Promise.all(patchPromises);
        updatedCount = results.filter(Boolean).length;
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

  // Load ALL relevant solicitations once on mount
  useEffect(() => {
    (async () => {
      document.title = `Solicitations | Cendien Recon`;
      await refreshSols();
    })();

    // window.addEventListener("focus", () => refreshSols());

    return () => {
      // window.removeEventListener("focus", () => refreshSols());
    };
  }, [q]); // Removed 'filters' - now filters are applied locally via useMemo

  // Update displayed sols when filters change (instant, no API call)
  useEffect(() => {
    setSols(filteredSols);
  }, [filteredSols]);

  useEffect(() => {
    refreshSols({ list: true, topBar: false });
  }, [page, limit, sort]);

  const handleSelectSol = (solId: string) => {
    setSelectedSolId(solId);
    setShowChat(false); // Close chat when selecting a solicitation
    // Don't update URL - it causes unnecessary re-renders and slows down navigation
  };

  const totalDisplayed = sols.length;

  const groupedSols = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        color: string;
        logo?: string;
        items: typeof sols;
      }
    >();

    sols.forEach((sol) => {
      const key = sol.site || sol.sourceKey || "unknown";
      const branding = SOURCE_BRANDING[key] || {};
      const color = branding.color || pickColor(key);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: sol.site || sol.sourceKey || "Unknown Source",
          color,
          logo: branding.logo,
          items: [],
        });
      }
      groups.get(key)!.items.push(sol);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [sols]);

  const toggleSourceGroup = (key: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
              ) : isLoading ? (
                <div className={styles.pageLayout_leftPanel_loading}>
                  Loading solicitations…
                </div>
              ) : groupedSols.length ? (
                groupedSols.map((group) => {
                  const isCollapsed = !expandedSources.has(group.key);
                  return (
                    <div
                      key={group.key}
                      className={styles.pageLayout_leftPanel_group}
                    >
                      <button
                        type="button"
                        className={styles.pageLayout_leftPanel_groupHeader}
                        onClick={() => toggleSourceGroup(group.key)}
                        aria-expanded={!isCollapsed}
                        style={{ borderLeftColor: group.color }}
                      >
                        <div
                          className={styles.pageLayout_leftPanel_groupHeaderIconWrap}
                        >
                          <ChevronRight
                            className={`${styles.pageLayout_leftPanel_groupHeaderIcon} ${
                              !isCollapsed
                                ? styles.pageLayout_leftPanel_groupHeaderIcon__expanded
                                : ""
                            }`}
                          />
                        </div>
                        <div className={styles.pageLayout_leftPanel_groupHeaderTitle}>
                          <span
                            className={styles.pageLayout_leftPanel_groupHeaderText}
                          >
                            {group.label}
                          </span>
                          {group.logo && (
                            <span
                              className={styles.pageLayout_leftPanel_groupHeaderLogo}
                              data-variant={LOGO_VARIANTS[group.key]}
                            >
                              <Image
                                src={group.logo}
                                alt={`${group.label} logo`}
                                width={120}
                                height={40}
                                loading="lazy"
                                unoptimized
                                style={{ height: 18, width: "auto" }}
                              />
                            </span>
                          )}
                        </div>
                        {isCollapsed && (
                          <span
                            className={styles.pageLayout_leftPanel_groupHeaderCount}
                          >
                            {group.items.length}
                          </span>
                        )}
                      </button>
                      {!isCollapsed && (
                        <div className={styles.pageLayout_leftPanel_groupList}>
                          {group.items.map((sol, index) => (
                            <Solicitation
                              key={sol.id || `sol-${index}`}
                              sol={sol}
                              refreshSols={refreshSols}
                              onSelectSol={() => handleSelectSol(sol.id)}
                              isSelected={selectedSolId === sol.id}
                              expandedSolIds={expandedSolIds}
                              setExpandedSolIds={setExpandedSolIds}
                              variant={
                                expandedSolIds.includes(sol.id)
                                  ? "expanded"
                                  : "compact"
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="p-4">No results found</p>
              )}
            </div>
            <div className={styles.pageLayout_leftPanel_pagination}>
              {totalDisplayed > 0 ? (
                <>Showing {totalDisplayed} items.</>
              ) : (
                <>Showing 0 items.</>
              )}
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
