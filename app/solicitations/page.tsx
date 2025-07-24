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
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Solicitation } from "./solicitation";
import queryString from "query-string";
import { useDebouncedCallback } from "use-debounce";
import { EditSolDialog } from "./editSolDialog";
import { CreateCommentDialog } from "./createCommentDialog";
import { TopBar } from "./topBar";

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
  }>({});
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("closingDate desc");
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [activeSolId, setActiveSolId] = useState<string>("");
  const [expandedSolIds, setExpandedSolIds] = useState<string[]>([]);
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);

  const debouncedSearchSols = useDebouncedCallback(
    async (params: Partial<SearchSolsParams>) => {
      await searchSols(params);
    },
    500
  );

  async function searchSols(params: Partial<SearchSolsParams> = {}) {
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
    const finalQ = paramQ ?? q;

    const flattenedFilter = {} as Record<string, any>;
    for (const [key, value] of Object.entries(finalFilter)) {
      flattenedFilter[`filter.${key}`] = value;
    }

    const urlQueryString = queryString.stringify({
      q: finalQ,
      limit: finalLimit,
      page: finalPage,
      sort: finalSort,
      ...flattenedFilter,
    });

    const resp = await fetch(`/api/solicitations/search?${urlQueryString}`);
    const data = await resp.json();
    const total = data.hits?.total?.value || 0;

    if (data.hits?.hits.length > 0) {
      const newSols = data.hits.hits.map((hit: Record<string, any>) => ({
        id: hit._id,
        ...hit._source,
      }));
      setSols(newSols);
    } else {
      setSols([]);
    }

    if (q || Object.keys(finalFilter).length > 0) {
      setTotalFiltered(total);
    } else {
      setTotalFiltered(0);
      setTotalRecords(total);
    }

    setTotalPages(Math.ceil(total / finalLimit));
  }

  async function refreshSols() {
    await searchSols({ filter, limit, page, q, sort });
  }

  useEffect(() => {
    (async () => {
      document.title = `Solicitations | Cendien Recon`;

      await debouncedSearchSols({ filter, limit, page, q, sort });
    })();
  }, [filter, limit, page, q, sort]);

  return (
    <div className={styles.page}>
      <div className={styles.pageMain}>
        <div className={styles.pageMain_content}>
          <div className={styles.pageMain_solsSection}>
            <TopBar
              setFilter={setFilter}
              setQ={setQ}
              setSort={setSort}
              setPage={setPage}
              queryParams={{ q, filter, limit, page, sort }}
              expandedSolIds={expandedSolIds}
              setExpandedSolIds={setExpandedSolIds}
            />
            <div className={styles.pageMain_solsSection_list}>
              {sols?.length ? (
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
              {totalFiltered > 0 ? (
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
      </div>
    </div>
  );
}
