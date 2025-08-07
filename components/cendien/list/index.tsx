"use client";

import { useEffect, useState } from "react";

type ListParams = {
  className?: string;
  itemTemplate?: (item: any) => React.ReactNode;
  onPreResults?: (results: any[]) => void;
  url: string;
};

const defaultItemTemplate = (item: any) => (
  <article key={`item-${item.id}`}>{JSON.stringify(item)}</article>
);

const List = ({
  url,
  className,
  itemTemplate = defaultItemTemplate,
  onPreResults = async (results) => results,
}: ListParams) => {
  const [items, setItems] = useState([]);

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

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className={className}>
      {items?.length > 0 && items.map((item) => itemTemplate(item))}
    </div>
  );
};

export { List };
