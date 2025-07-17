import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dispatch, SetStateAction } from "react";

import styles from "./filterBar.module.scss";

type FilterBarProps = {
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
};

const FilterBar = ({
  queryParams,
  setFilter,
  setSort,
  setQ,
}: FilterBarProps) => {
  return (
    <div className={styles.filterBar}>
      <section>
        <label>Search</label>
        <Input
          type="text"
          onChange={(e) => setQ(e.currentTarget.value)}
          value={queryParams.q}
        />
      </section>
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
                Created <ArrowDown />
              </SelectItem>
              <SelectItem value="created asc">
                Created <ArrowUp />
              </SelectItem>
              <SelectItem value="publicationDate desc">
                Published Date <ArrowDown />
              </SelectItem>
              <SelectItem value="publicationDate asc">
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
        <label>Our Status</label>
        <Select
          defaultValue="none"
          value={queryParams.filter.cnStatus || "none"}
          onValueChange={(value) =>
            setFilter((prev) => {
              if (value === "none") {
                const newValues = { ...prev };
                delete newValues.cnStatus;
                return newValues;
              } else {
                return { ...prev, cnStatus: value };
              }
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="ignore">Ignore</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section>
        <label>Source</label>
        <Select
          defaultValue="none"
          value={queryParams.filter.site || "none"}
          onValueChange={(value) =>
            setFilter((prev) => {
              if (value === "none") {
                const newValues = { ...prev };
                delete newValues.site;
                return newValues;
              } else {
                return { ...prev, site: value };
              }
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a source" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bidnetdirect">Bidnetdirect</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section className={styles.filterBar_other}>
        <label>Other</label>
        <Checkbox
          onCheckedChange={(checked) =>
            setFilter((prev) => {
              if (checked === false) {
                const newValues = { ...prev };
                delete newValues.cnLiked;
                return newValues;
              }
              return { ...prev, cnLiked: true };
            })
          }
        />
        <span>Show liked items</span>
      </section>
    </div>
  );
};

export { FilterBar };
