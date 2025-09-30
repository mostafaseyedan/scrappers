"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import styles from "./page.module.scss";

type SearchSolsParams = {
  q?: string;
  limit?: number;
  page?: number;
  sort?: string;
  filter?: Record<string, any>;
};

export default function Page() {
  const [sols, setSols] = useState<any[]>([]);
  const [limit, setLimit] = useState(20);
  const [filter, setFilter] = useState<{
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
  const [activeSolId, setActiveSolId] = useState<string>("");
  const [expandedSolIds, setExpandedSolIds] = useState<string[]>([]);
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);
  const [showCreateSol, setShowCreateSol] = useState(false);
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
    params: Partial<SearchSolsParams> = { filter: {} }
  ) {
    const {
      q: paramQ,
      limit: paramLimit,
      page: paramPage,
      sort: paramSort,
      filter: paramFilter,
    } = params;

    // Use state if param is undefined
    const finalLimit = paramLimit ?? limit;
    const finalPage = paramPage ?? page;
    const finalSort = paramSort ?? sort;
    const finalFilter = paramFilter ?? filter;
    const finalQ = paramQ || q;

    const flattenedFilter = {} as Record<string, any>;
    for (const [key, value] of Object.entries(finalFilter)) {
      flattenedFilter[`filter.${key}`] = value;
    }

    const queryObject = {
      q: finalQ,
      limit: finalLimit,
      page: finalPage,
      sort: finalSort,
      ...flattenedFilter,
    } as Record<string, any>;
    if (q) delete queryObject["filter.cnStatus"];
    queryObject.contains = true;
    const urlQueryString = queryString.stringify(queryObject);

    const resp = await fetch(`/api/solicitations/search?${urlQueryString}`);
    const data = await resp.json();
    const total = data.hits?.total?.value || 0;
    const hits = data.hits?.hits.length ? data.hits.hits : [];
    let dbSols = hits.length
      ? hits.map((hit: Record<string, any>) => ({
          ...hit._source,
          id: hit._id,
          viewedBy: hit._source.viewedBy || [],
        }))
      : [];

    if (dbSols.length > 0) {
      dbSols = await processIncomingSols(dbSols);
    }

    setSols(dbSols);

    if (q || Object.keys(finalFilter).length > 0) {
      setTotalFiltered(total);
    } else {
      setTotalFiltered(0);
      setTotalRecords(total);
    }

    setTotalPages(Math.ceil(total / finalLimit));
  }

  async function getSols() {
    let sols = await solModel
      .get({ limit, page, sort, filters: filter })
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

    if (Object.keys(filter).length > 0) {
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
      if (q || filter.cnLiked || filter.site)
        await debouncedSearchSols({ filter, limit, page, q, sort });
      else await getSols();
    }
    if (topBar) await topBarRef.current?.refresh?.();
  };

  useEffect(() => {
    (async () => {
      document.title = `Solicitations | Cendien Recon`;
      await refreshSols();
    })();

    // window.addEventListener("focus", () => refreshSols());

    return () => {
      // window.removeEventListener("focus", () => refreshSols());
    };
  }, [filter, q]);

  useEffect(() => {
    refreshSols({ list: true, topBar: false });
  }, [page, limit, sort]);

  return (
    <div className={styles.page}>
      <div className={styles.pageMain}>
        <div className={styles.pageMain_content}>
          <div className={styles.pageMain_solsSection}>
            <TopBar
              q={q}
              setFilter={setFilter}
              setQ={setQ}
              setSort={setSort}
              setPage={setPage}
              setTotalRecords={setTotalRecords}
              queryParams={{ q, filter, limit, page, sort }}
              expandedSolIds={expandedSolIds}
              setExpandedSolIds={setExpandedSolIds}
              onClickCreateSol={() => setShowCreateSol(true)}
              ref={topBarRef}
            />
            <div className={styles.pageMain_solsSection_list}>
              {listError ? (
                <p className="p-4 error">{listError}</p>
              ) : sols?.length ? (
                sols.map((sol) => (
                  <Solicitation
                    key={`sol-${sol.id}`}
                    sol={sol}
                    refreshSols={refreshSols}
                    onClickComment={() => {
                      setActiveSolId(sol.id);
                      setShowCreateComment(true);
                    }}
                    onEditSol={() => {
                      setActiveSolId(sol.id);
                      setShowEditSol(true);
                    }}
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
            <div className={styles.pageMain_solsSection_pagination}>
              {q || Object.keys(filter).length > 0 ? (
                <>
                  {totalFiltered} out {totalRecords} items.
                </>
              ) : (
                <>Showing all {totalRecords} items.</>
              )}
              <div className={styles.pageMain_solsSection_pagination_perPage}>
                <Select
                  onValueChange={(value) => {
                    setLimit(Number(value));
                    setPage(1);
                  }}
                  defaultValue="20"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="20" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                per page
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <Input
                className={styles.pageMain_solsSection_pagination_page}
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
          </div>
        </div>

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
    </div>
  );
}
