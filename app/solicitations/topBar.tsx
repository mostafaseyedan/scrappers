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
import { Combobox } from "@/components/cendien/Combobox";
import { FilterOptions } from "./filterOptions";
import { Input } from "@/components/ui/input";
import { Dispatch, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { cnStatuses, cnTypes } from "../config";
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
        <Button onClick={onClickCreateSol}>Create</Button>
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
            <SelectTrigger>
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
        <div className={styles.cnTypeDropdown}>
          <Select
            value={queryParams.filters.cnType || "-"}
            onValueChange={async (value) => {
              setPage(1);
              setFilters((prev) => {
                if (value === "-") {
                  const newValues = { ...prev };
                  delete newValues.cnType;
                  return newValues;
                } else {
                  return { ...prev, cnType: value };
                }
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem
                  key={"default"}
                  value={"-"}
                  className={styles[`sol_typeItem_default`]}
                >
                  -
                </SelectItem>
                {cnTypes.map((type) => (
                  <SelectItem
                    key={type.key}
                    value={type.key}
                    className={styles[`sol_typeItem_${type.key}`]}
                  >
                    {type.label} {`(${counts[type.key] || 0})`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Combobox
          className="width-[200px]"
          initialSuggestions={filterFacets?.site?.map((site) => ({
            value: site.value,
            label: `${site.value} (${site.count})`,
          }))}
          onChange={(value) => {
            setPage(1);
            setSort("created desc");
            setFilters((prev) => {
              const next = { ...prev };
              if (!value) {
                delete next.site;
                return next;
              }
              delete next.cnStatus;
              return { ...next, site: value };
            });
          }}
          value={queryParams.filters.site || ""}
        />

        <div className={styles.topBar_filter}>
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
      </div>
    );
  }
);

TopBar.displayName = "TopBar";

export { TopBar };
