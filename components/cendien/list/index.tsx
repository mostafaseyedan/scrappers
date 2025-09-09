"use client";

import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

type ListParams = {
  className?: string;
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
      itemTemplate = defaultItemTemplate,
      onPreResults = async (results) => results,
    },
    ref
  ) => {
    const [items, setItems] = useState<any[]>([]);

    async function refresh() {
      const results = await fetch(url);
      const json = await results.json();
      if (json.error) return console.error(json.error);
      if (json.results) {
        let results = json.results;
        if (onPreResults) results = await onPreResults(json.results);
        setItems(results);
      }
    }

    useImperativeHandle(ref, () => ({ refresh }), [url, onPreResults]);

    useEffect(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className={className}>
        {items?.length > 0 && items.map((item) => itemTemplate(item))}
      </div>
    );
  }
);

export { List };
