import { ChevronsDownUp, Filter } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { FilterOptions } from "./filterOptions";
import { Input } from "@/components/ui/input";
import { Dispatch, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { cnStatuses } from "../config";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import styles from "./topBar.module.scss";

type TopBarProps = {
  className?: string;
  expandedSolIds: string[];
  filterFacets?: Record<string, Array<{ value: string; count: number }>>;
  onClickCreateSol?: () => void;
  onShowLogs?: () => void;
  onShowSources?: () => void;
  onShowChat?: () => void;
  onCalculateScores?: () => void;
  q: string;
  queryParams: {
    q: string;
    filters: Record<string, any>;
    limit: number;
    page: number;
    sort: string;
  };
  setFilters: Dispatch<React.SetStateAction<Record<string, any>>>;
  setQ: Dispatch<React.SetStateAction<string>>;
  setSort: Dispatch<React.SetStateAction<string>>;
  setPage: Dispatch<React.SetStateAction<number>>;
  setExpandedSolIds: Dispatch<React.SetStateAction<string[]>>;
  setTotalRecords: Dispatch<React.SetStateAction<number>>;
};

const TopBar = forwardRef(
  (
    {
      className,
      expandedSolIds,
      filterFacets,
      onClickCreateSol,
      onShowLogs,
      onShowSources,
      onShowChat,
      onCalculateScores,
      q,
      queryParams,
      setFilters,
      setQ,
      setSort,
      setPage,
      setExpandedSolIds,
      setTotalRecords,
    }: TopBarProps,
    ref
  ) => {
    const [counts, setCounts] = useState<Record<string, number>>({});

    async function getCounts() {
      const resp = await fetch(`/api/solicitations/counts/summary`);
      return (await resp.json()) || {};
    }

    async function refresh() {
      const counts = await getCounts();
      setCounts(counts);
      setTotalRecords(counts?.total);
    }

    useEffect(() => {
      refresh();
    }, []);

    useImperativeHandle(ref, () => ({
      refresh,
    }));

    return (
      <div className={cn(styles.topBar, className)}>
        {/* Row 1: Create, Sources, AI Score, Logs */}
        <div className="flex items-center gap-2 w-full">
          <Button onClick={onClickCreateSol}>Create</Button>
          {onShowSources && (
            <button
              onClick={onShowSources}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
            >
              Sources
            </button>
          )}
          {onCalculateScores && (
            <button
              onClick={onCalculateScores}
              title="AI Score"
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              AI Score
            </button>
          )}
          {onShowLogs && (
            <button
              onClick={onShowLogs}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Logs
            </button>
          )}
        </div>

        {/* Row 2: Search, Status dropdown, Gemini, Filter */}
        <div className="flex items-center gap-2 w-full mt-2">
          <Input
            className={styles.topBar_search}
            type="text"
            placeholder="Search"
            value={q}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => {
                const newValues = { ...prev };
                delete newValues.cnStatus;
                return newValues;
              });
              setQ(e.target.value);
            }}
          />
          <div
            className={styles.cnStatusDropdown}
            data-status={queryParams.filters.cnStatus}
          >
            <Select
              value={
                queryParams.filters.cnStatus === undefined
                  ? "all"
                  : queryParams.filters.cnStatus || "new"
              }
              onValueChange={async (value) => {
                setPage(1);
                setFilters((prev) => {
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
              <SelectTrigger className="h-8 px-3 text-xs">
                <SelectValue placeholder="New" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {Object.entries(cnStatuses).map(([value, label]) => (
                    <SelectItem
                      className={styles[`sol_statusItem_${value}`]}
                      key={value}
                      value={value}
                    >
                      {label} <span>({counts[value] || 0})</span>
                    </SelectItem>
                  ))}
                  <SelectItem
                    className={styles[`sol_statusItem_all`]}
                    value="all"
                  >
                    All <span>({counts.total || 0})</span>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {onShowChat && (
            <button
              onClick={onShowChat}
              title="AI Chat"
              className="h-8 w-8 bg-transparent rounded hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center transition-colors"
            >
              <Image src="/images/gemini-icon.svg" alt="Chat" width={20} height={20} />
            </button>
          )}
          <div>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Filter />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Filter results</TooltipContent>
              </Tooltip>
              <PopoverContent className={styles.popover}>
                <FilterOptions
                  filterFacets={filterFacets}
                  setFilters={setFilters}
                  setQ={setQ}
                  setSort={setSort}
                  setPage={setPage}
                  queryParams={queryParams}
                />
              </PopoverContent>
            </Popover>
          </div>
          {expandedSolIds.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpandedSolIds([])}
                >
                  <ChevronsDownUp />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Collapse all</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }
);

TopBar.displayName = "TopBar";

export { TopBar };
