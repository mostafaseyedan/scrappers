"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  Filter,
} from "lucide-react";
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
import { FilterOptions } from "./filterOptions";
import queryString from "query-string";
import { useDebouncedCallback } from "use-debounce";
import { EditSolDialog } from "./editSolDialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import styles from "./page.module.scss";
import { cnStatuses } from "../config";

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
  const [expandedSolIds, setExpandedSolIds] = useState<string[]>([]);
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
        <div className={styles.pageMain_content}>
          <div className={styles.pageMain_solsSection}>
            <div className={styles.pageMain_solsSection_topBar}>
              <Tabs
                defaultValue="all"
                onValueChange={(value) => {
                  setFilter((prev) => {
                    if (value === "all") {
                      const newValues = { ...prev };
                      delete newValues.cnStatus;
                      return newValues;
                    } else {
                      return { ...prev, cnStatus: value };
                    }
                  });
                }}
              >
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  {cnStatuses &&
                    Object.entries(cnStatuses).map(([value, label]) => (
                      <TabsTrigger value={value}>{label}</TabsTrigger>
                    ))}
                </TabsList>
              </Tabs>
              <div className={styles.pageMain_solsSection_topBar_filter}>
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Filter />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Filter results</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    className={styles.pageMain_solsSection_popover}
                  >
                    <FilterOptions
                      setFilter={setFilter}
                      setQ={setQ}
                      setSort={setSort}
                      queryParams={{ q, filter, limit, page, sort }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {expandedSolIds.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExpandedSolIds([])}
                    >
                      <ChevronsDownUp />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse all</TooltipContent>
                </Tooltip>
              )}
              <Input
                className={styles.pageMain_solsSection_topBar_search}
                type="text"
                placeholder="Search"
                onChange={(e) => setQ(e.currentTarget.value)}
              />
            </div>
            <div className={styles.pageMain_solsSection_list}>
              {sols?.length ? (
                sols.map((sol) => (
                  <Solicitation
                    key={`sol-${sol.id}`}
                    sol={sol}
                    refreshSols={refreshSols}
                    onEditSol={() => onEditSol(sol.id)}
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
          solId={editSolId}
          open={showEditSol}
          onSubmitSuccess={() => refreshSols()}
          setShowEditSol={setShowEditSol}
        />
      </div>
    </div>
  );
}
