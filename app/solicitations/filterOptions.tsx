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
import { cnTypes } from "../config";

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
              <SelectItem value="instantmarkets">Instant Markets</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="publicpurchase">Public Purchase</SelectItem>
              <SelectItem value="vendorregistry">Vendor Registry</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section>
        <label>Type</label>
        <Select
          defaultValue="none"
          value={queryParams.filter.cnType || "none"}
          onValueChange={(value) =>
            setFilter((prev) => {
              if (value === "none") {
                const newValues = { ...prev };
                delete newValues.cnType;
                return newValues;
              } else {
                return { ...prev, cnType: value };
              }
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">None</SelectItem>
              {cnTypes.map((type) => (
                <SelectItem key={type.key} value={type.key}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section className={styles.filterOptions_other}>
        <label>Other</label>
        <Checkbox
          checked={queryParams.filter.cnLiked || false}
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
