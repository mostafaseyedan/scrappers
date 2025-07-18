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
import { FilterBar } from "./filterBar";
import queryString from "query-string";
import { useDebouncedCallback } from "use-debounce";
import { EditSolDialog } from "./editSolDialog";

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
  const [filter, setFilter] = useState({});
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("closingDate desc");
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [editSolId, setEditSolId] = useState<string>("");
  const [showEditSol, setShowEditSol] = useState(false);

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

  function onEditSol(solId: string) {
    setEditSolId(solId);
    setShowEditSol(true);
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
        <FilterBar
          setFilter={setFilter}
          setQ={setQ}
          setSort={setSort}
          queryParams={{ q, filter, limit, page, sort }}
        />
        <div className={styles.pageMain_content}>
          <div className={styles.pageMain_solsSection}>
            <div className={styles.pageMain_solsSection_pagination}>
              {totalFiltered > 0 ? (
                <>
                  Filtered {totalFiltered} out of total {totalRecords}{" "}
                  solicitations.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilter({});
                      setQ("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>Showing all {totalRecords} solicitations. </>
              )}
              Showing
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
            <div className={styles.pageMain_solsSection_list}>
              {sols.map((sol) => (
                <Solicitation
                  key={`sol-${sol.id}`}
                  sol={sol}
                  refreshSols={refreshSols}
                  onEditSol={() => onEditSol(sol.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <EditSolDialog
          solId={editSolId}
          open={showEditSol}
          onSubmitSuccess={() => refreshSols()}
          setShowEditSol={setShowEditSol}
        />
      </div>
    </div>
  );
}
