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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cnStatuses } from "../config";
import { Button } from "@/components/ui/button";
import { FilterOptions } from "./filterOptions";
import { Input } from "@/components/ui/input";
import { Dispatch } from "react";
import { cn } from "@/lib/utils";

import styles from "./topBar.module.scss";

type TopBarProps = {
  className?: string;
  expandedSolIds: string[];
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
};

const TopBar = ({
  className,
  expandedSolIds,
  queryParams,
  setFilter,
  setQ,
  setSort,
  setPage,
  setExpandedSolIds,
}: TopBarProps) => {
  return (
    <div className={cn(styles.topBar, className)}>
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
              <TabsTrigger value={value} key={`tabs-trigger-${value}`}>
                {label}
              </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>
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
        onChange={(e) => setQ(e.currentTarget.value)}
      />
    </div>
  );
};

export { TopBar };
