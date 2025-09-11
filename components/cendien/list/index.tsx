"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import queryString from "query-string";

import styles from "./index.module.scss";

type ListParams = {
  className?: string;
  headerTemplate?: (params: {
    filters?: Record<string, any>;
    setFilters?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    sort?: string;
    setSort?: React.Dispatch<React.SetStateAction<string>>;
    setPage?: React.Dispatch<React.SetStateAction<number>>;
  }) => React.ReactNode;
  itemTemplate?: (item: any) => React.ReactNode;
  onPreResults?: (results: any[]) => Promise<any[]> | any[];
  url: string;
};

const defaultItemTemplate = (item: any) => (
  <article key={`item-${item.id}`}>{JSON.stringify(item)}</article>
);

export type ListHandle = { refresh: () => Promise<void> };

const List = forwardRef<ListHandle, ListParams>(
  (
    {
      url,
      className,
      headerTemplate,
      itemTemplate = defaultItemTemplate,
      onPreResults = async (results) => results,
    },
    ref
  ) => {
    const [items, setItems] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [sort, setSort] = useState("created desc");
    const totalPages = Math.ceil(totalItems / limit);

    async function refresh() {
      const flattenedFilters = {} as Record<string, any>;
      for (const [key, value] of Object.entries(filters)) {
        flattenedFilters[`filters.${key}`] = value;
      }

      const queryObject = { page, limit, sort, ...flattenedFilters };
      const urlQueryString = queryString.stringify(queryObject);
      const results = await fetch(`${url}?${urlQueryString}`);
      const json = await results.json();

      if (json.error) return console.error(json.error);
      if (json.results) {
        let results = json.results;
        if (onPreResults) results = await onPreResults(json.results);
        setItems(results);
        if (json.total) setTotalItems(json.total);
      }
    }

    useImperativeHandle(ref, () => ({ refresh }), [url, onPreResults]);

    useEffect(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, page, sort]);

    return (
      <div className={className}>
        <div className={styles.header}>
          {headerTemplate?.({ filters, setFilters, setPage, sort, setSort })}
        </div>
        <div className={styles.list}>
          {items?.length > 0 ? (
            items.map((item) => itemTemplate(item))
          ) : (
            <div className={styles.emptyState}>No items available.</div>
          )}
        </div>
        <div className={styles.footer}>
          <div className="itemsTotal">{totalItems} items</div>
          <div className={styles.pagination}>
            {page > 1 && (
              <Button
                aria-label="Previous Page"
                size={"sm"}
                variant={"ghost"}
                onClick={(e) => setPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
            )}
            <span>
              <Input
                className={styles.pagination_input}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
                size={2}
              />{" "}
              / {totalPages}
            </span>
            {page < totalPages && (
              <Button
                aria-label="Next Page"
                size={"sm"}
                variant={"ghost"}
                onClick={(e) => {
                  setPage(page + 1);
                }}
              >
                <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export { List };
