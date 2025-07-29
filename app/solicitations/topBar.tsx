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
import { Button } from "@/components/ui/button";
import { FilterOptions } from "./filterOptions";
import { Input } from "@/components/ui/input";
import { Dispatch, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { solicitation as solModel } from "../models";

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
    }: TopBarProps,
    ref
  ) => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [cnStatus, setCnStatus] = useState("new");

    async function refresh() {
      const counts = {
        new: await solModel.count({ cnStatus: "new" }),
        submitted: await solModel.count({ cnStatus: "submitted" }),
        rfps: await solModel.count({ cnStatus: "rfp" }),
        erp: await solModel.count({ cnStatus: "erp" }),
        awarded: await solModel.count({ cnStatus: "awarded" }),
        monitor: await solModel.count({ cnStatus: "monitor" }),
        notWon: await solModel.count({ cnStatus: "notWon" }),
        notPursuing: await solModel.count({ cnStatus: "notPursuing" }),
        total: await solModel.count(),
      };
      setCounts(counts);
    }

    useEffect(() => {
      refresh();
    }, []);

    useImperativeHandle(ref, () => ({
      refresh,
    }));

    return (
      <div className={cn(styles.topBar, className)}>
        <Tabs
          value={cnStatus}
          onValueChange={(value) => {
            setQ("");
            setCnStatus(value);
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
          <TabsList>
            <TabsTrigger className={styles.topBar_tab__new} value="new">
              New ({counts.new || 0})
            </TabsTrigger>
            <TabsTrigger
              className={styles.topBar_tab__submitted}
              value="submitted"
            >
              Submitted ({counts.submitted || 0})
            </TabsTrigger>
            <TabsTrigger className={styles.topBar_tab__erp} value="erp">
              ERP ({counts.erp || 0})
            </TabsTrigger>
            <TabsTrigger className={styles.topBar_tab__awarded} value="awarded">
              Awarded ({counts.awarded || 0})
            </TabsTrigger>
            <TabsTrigger className={styles.topBar_tab__monitor} value="monitor">
              Monitor ({counts.monitor || 0})
            </TabsTrigger>
            <TabsTrigger className={styles.topBar_tab__notWon} value="notWon">
              Not Won ({counts.notWon || 0})
            </TabsTrigger>
            <TabsTrigger
              className={styles.topBar_tab__notPursuing}
              value="notPursuing"
            >
              Not Pursuing ({counts.notPursuing || 0})
            </TabsTrigger>
            <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
          </TabsList>
        </Tabs>
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
            setCnStatus("all");
            setQ(e.target.value);
          }}
        />
      </div>
    );
  }
);

TopBar.displayName = "TopBar";

export { TopBar };
