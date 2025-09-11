"use client";

import { format as $d } from "date-fns";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@/app/userContext";
import { Button } from "@/components/ui/button";
import { CreateSourceDialog } from "./createSourceDialog";
import { List as CnList, type ListHandle } from "@/components/cendien/list";
import { SourceActions } from "./sourceActions";
import { ArrowUp, ArrowDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import styles from "./page.module.scss";

export default function Page() {
  const userContext = useContext(UserContext);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const listRef = useRef<ListHandle>(null);

  useEffect(() => {}, []);

  return (
    <div className={styles.page}>
      <CnList
        ref={listRef}
        className={styles.sourcesList}
        url="/api/sources"
        headerTemplate={({ sort, setFilters, setPage, setSort }) => (
          <div className={styles.header}>
            <div className={styles.header_leftCol}>
              <Select
                defaultValue="all"
                onValueChange={(value) => {
                  setPage?.(1);
                  setFilters?.(value === "all" ? {} : { type: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="aggregator">Aggregator</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="county">County</SelectItem>
                  <SelectItem value="federal">Federal</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setOpenCreateDialog(true)}>
                Create Source
              </Button>
            </div>
            <div className={styles.header_rightCol}>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Filter list options"
                      >
                        <Filter />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Filter results</TooltipContent>
                </Tooltip>
                <PopoverContent className={styles.filterOptions}>
                  <section>
                    <label>Sort</label>
                    <Select
                      value={sort}
                      onValueChange={(value) => {
                        setPage?.(1);
                        setSort?.(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name asc">
                          Name <ArrowUp />
                        </SelectItem>
                        <SelectItem value="name desc">
                          Name <ArrowDown />
                        </SelectItem>
                        <SelectItem value="created asc">
                          Created <ArrowUp />
                        </SelectItem>
                        <SelectItem value="created desc">
                          Created <ArrowDown />
                        </SelectItem>
                        <SelectItem value="updated asc">
                          Updated <ArrowUp />
                        </SelectItem>
                        <SelectItem value="updated desc">
                          Updated <ArrowDown />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </section>
                  <Button variant="outline">Clear filters</Button>
                </PopoverContent>
              </Popover>
              <Input className={styles.searchInput} placeholder="Search" />
            </div>
          </div>
        )}
        itemTemplate={(item) => (
          <div className={styles.sourceItem}>
            <SourceActions
              source={item}
              onDeleteSuccess={() => {
                listRef.current?.refresh();
              }}
            />
            <div className={styles.sourceItem_main}>
              <span className={styles.sourceItem_name}>{item.name}</span>
              <a
                className={styles.sourceItem_url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.url}
              </a>
              <span className={styles.sourceItem_created}>
                {$d(item.created, "M/d/yyyy h:mm a")} by {item.authorId}
              </span>
            </div>
            <span className={styles.sourceItem_type}>{item.type}</span>
          </div>
        )}
      />

      <CreateSourceDialog
        open={openCreateDialog}
        onOpenChange={setOpenCreateDialog}
        onSubmitSuccess={() => {
          listRef.current?.refresh();
        }}
      />
    </div>
  );
}
