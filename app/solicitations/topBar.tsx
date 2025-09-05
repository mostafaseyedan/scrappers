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
  onClickCreateSol?: () => void;
  q: string;
  queryParams: {
    q: string;
    filter: Record<string, any>;
    limit: number;
    page: number;
    sort: string;
  };
  setFilter: Dispatch<React.SetStateAction<Record<string, any>>>;
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
      onClickCreateSol,
      q,
      queryParams,
      setFilter,
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
        <div
          className={styles.cnStatusDropdown}
          data-status={queryParams.filter.cnStatus}
        >
          <Select
            value={
              queryParams.filter.cnStatus === undefined
                ? "all"
                : queryParams.filter.cnStatus || "new"
            }
            onValueChange={async (value) => {
              setPage(1);
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
            value={queryParams.filter.cnType || "-"}
            onValueChange={async (value) => {
              setPage(1);
              setFilter((prev) => {
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
        <Button onClick={onClickCreateSol}>Create</Button>
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
                setFilter={setFilter}
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
        <Input
          className={styles.topBar_search}
          type="text"
          placeholder="Search"
          value={q}
          onChange={(e) => {
            setPage(1);
            setFilter((prev) => {
              const newValues = { ...prev };
              delete newValues.cnStatus;
              return newValues;
            });
            setQ(e.target.value);
          }}
        />
      </div>
    );
  }
);

TopBar.displayName = "TopBar";

export { TopBar };
