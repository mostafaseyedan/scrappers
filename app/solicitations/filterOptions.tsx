import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import styles from "./filterOptions.module.scss";

type FilterOptionsProps = {
  queryParams: {
    q: string;
    filter: Record<string, any>;
    limit: number;
    page: number;
    sort: string;
  };
  setFilter: Dispatch<SetStateAction<Record<string, any>>>;
  setQ: Dispatch<SetStateAction<string>>;
  setSort: (sort: string) => void;
  setPage: Dispatch<SetStateAction<number>>;
};

const FilterOptions = ({
  queryParams,
  setFilter,
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
            <SelectGroup>
              <SelectItem value="closingDate desc">
                Closing Date <ArrowDown />
              </SelectItem>
              <SelectItem value="closingDate asc">
                Closing Date <ArrowUp />
              </SelectItem>
              <SelectItem value="created desc">
                Extracted Date <ArrowDown />
              </SelectItem>
              <SelectItem value="created asc">
                Extracted Date <ArrowUp />
              </SelectItem>
              <SelectItem value="publishDate desc">
                Published Date <ArrowDown />
              </SelectItem>
              <SelectItem value="publishDate asc">
                Published Date <ArrowUp />
              </SelectItem>
              <SelectItem value="updated desc">
                Updated <ArrowDown />
              </SelectItem>
              <SelectItem value="updated asc">
                Updated <ArrowUp />
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section>
        <label>Source</label>
        <Input
          value={queryParams.filter.site || ""}
          onChange={(e) => {
            const value = e.target.value;
            setPage(1);
            setFilter((prev) => {
              const next = { ...prev };
              if (!value) {
                delete next.site;
                return next;
              }
              return { ...next, site: value };
            });
          }}
          placeholder="i.e. bidnetdirect, rfpmart, highergov"
        />
      </section>
      <section className={styles.filterOptions_other}>
        <label>Other</label>
        <Checkbox
          checked={queryParams.filter.cnLiked || false}
          onCheckedChange={(checked) => {
            setPage(1);
            setFilter((prev) => {
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
          setFilter({});
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
