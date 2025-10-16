import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/cendien/Combobox";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import styles from "./filterOptions.module.scss";

type FilterOptionsProps = {
  queryParams: {
    q: string;
    filters: Record<string, any>;
    limit: number;
    page: number;
    sort: string;
  };
  filterFacets?: Record<string, Array<{ value: string; count: number }>>;
  setFilters: Dispatch<SetStateAction<Record<string, any>>>;
  setQ: Dispatch<SetStateAction<string>>;
  setSort: (sort: string) => void;
  setPage: Dispatch<SetStateAction<number>>;
};

const FilterOptions = ({
  queryParams,
  filterFacets,
  setFilters,
  setSort,
  setQ,
  setPage,
}: FilterOptionsProps) => {
  return (
    <div className={styles.filterOptions}>
      <section>
        <label>Sort</label>
        <Select
          defaultValue="closingDate desc"
          value={queryParams.sort}
          onValueChange={setSort}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="closingDate asc">
              Closing Date <ArrowUp />
            </SelectItem>
            <SelectItem value="closingDate desc">
              Closing Date <ArrowDown />
            </SelectItem>
            <SelectItem value="created asc">
              Extracted Date <ArrowUp />
            </SelectItem>
            <SelectItem value="created desc">
              Extracted Date <ArrowDown />
            </SelectItem>
            <SelectItem value="publishDate asc">
              Published Date <ArrowUp />
            </SelectItem>
            <SelectItem value="publishDate desc">
              Published Date <ArrowDown />
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
      <section>
        <label>Issuer</label>
        <Combobox
          initialSuggestions={filterFacets?.issuer?.map((issuer) => ({
            value: issuer.value,
            label: `${issuer.value} (${issuer.count})`,
          }))}
          onChange={(value) => {
            setPage(1);
            setSort("created desc");
            setFilters((prev) => {
              const next = { ...prev };
              if (!value) {
                delete next.issuer;
                return next;
              }
              delete next.site;
              delete next.location;
              delete next.cnStatus;
              return { ...next, issuer: value };
            });
          }}
          value={queryParams.filters.issuer || ""}
        />
      </section>
      <section>
        <label>Location</label>
        <Combobox
          initialSuggestions={filterFacets?.location?.map((location) => ({
            value: location.value,
            label: `${location.value} (${location.count})`,
          }))}
          onChange={(value) => {
            setPage(1);
            setSort("created desc");
            setFilters((prev) => {
              const next = { ...prev };
              if (!value) {
                delete next.location;
                return next;
              }
              delete next.cnStatus;
              return { ...next, location: value };
            });
          }}
          value={queryParams.filters.location || ""}
        />
      </section>
      <section>
        <label>Aggregator Site</label>
        <Combobox
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
      </section>
      <section className="hidden">
        <label>Dates</label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a date field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="closing">Closing</SelectItem>
            <SelectItem value="extracted">Extracted</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="3month">3 months ago</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </section>
      <section className={cn(styles.filterOptions_other, "hidden")}>
        <label>Other</label>
        <Checkbox
          checked={queryParams.filters.cnLiked || false}
          onCheckedChange={(checked) => {
            setPage(1);
            setFilters((prev) => {
              const newValues = { ...prev };
              if (checked === false) {
                delete newValues.cnLiked;
                return newValues;
              } else {
                delete newValues.cnStatus;
                return { ...newValues, cnLiked: true };
              }
            });
          }}
        />
        <span>Show saved items</span>
      </section>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setFilters({});
          setQ("");
          setPage(1);
        }}
      >
        Clear filters
      </Button>
    </div>
  );
};

export { FilterOptions };
