"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";
import queryString from "query-string";
import { useDebouncedCallback } from "use-debounce";
import styles from "./Combobox.module.scss";

type ComboboxProps = {
  className?: string;
  api: string;
  value?: string; // initial value coming from react-hook-form
  name?: string; // react-hook-form field name
  getBy?: "key" | "id"; // how to fetch the initial value, defaults to 'key'
  onBeforeCreate?: (inputValue: string) => any; // callback before creating a new item
  onChange?: (value: string) => void; // react-hook-form onChange handler
  onBlur?: () => void; // react-hook-form onBlur handler
  // Allow any other field props passed by RHF (e.g. ref)
  [key: string]: any;
};

type Suggestion = {
  value: string;
  label: string;
};

export function Combobox({
  className,
  api,
  getBy = "key",
  onBeforeCreate,
  ...field
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [value, setValue] = useState<string>(field.value || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const searchDebounced = useDebouncedCallback(async (q: string) => {
    setSearchTerm(q);
    await search({ q });
  }, 500);

  async function search({
    q,
    limit = 10,
    page = 1,
    sort,
  }: {
    q: string;
    limit?: number;
    page?: number;
    sort?: string;
  }) {
    if (!q) return;

    const queryObject = {
      q,
      limit: limit || 10,
      page: page || 1,
      sort: sort || "created desc",
    } as Record<string, any>;
    queryObject.contains = true;
    const urlQueryString = queryString.stringify(queryObject);
    const resp = await fetch(`${api}/search?${urlQueryString}`);
    const data = await resp.json();
    let records = data.results || [];

    records = records
      .map((record: Record<string, any>) => ({
        value: record.key,
        label: record.name,
      }))
      .sort((a: Suggestion, b: Suggestion) => a.label.localeCompare(b.label));

    setSuggestions(records);
  }

  async function getById(id: string) {
    const resp: Record<string, any> = await fetch(`${api}/${id}`);
    const data = await resp.json();

    if (data.error) {
      console.error("Combobox failed to get value by id", id, data.error);
      return false;
    }

    return data;
  }

  async function getByKey(key: string) {
    const queryObject = {
      "filters.key": key,
    } as Record<string, any>;
    const urlQueryString = queryString.stringify(queryObject);
    const resp: Record<string, any> = await fetch(`${api}?${urlQueryString}`);
    const data = await resp.json();
    const record = data.results[0];

    if (data.error) {
      console.error("Combobox failed to get value by key", key, data.error);
      return false;
    }

    if (!record) {
      console.error("Combobox no record found for key", key);
      return false;
    }

    return record;
  }

  // Fetch the record for an incoming (or changed) external value if we don't have it yet
  useEffect(() => {
    (async () => {
      const incoming = field.value ?? "";
      if (!incoming) return;

      // Sync local value if changed
      if (incoming !== value) setValue(incoming);

      // If we already have a suggestion for it, skip fetch
      if (suggestions.some((s) => s.value === incoming)) return;

      const record =
        getBy === "key" ? await getByKey(incoming) : await getById(incoming);
      if (record) {
        const suggestion = { value: record.key, label: record.name };
        setSuggestions((prev) => {
          // Avoid duplicates if a race condition occurs
          if (prev.some((s) => s.value === suggestion.value)) return prev;
          return [...prev, suggestion];
        });
      } else {
        setValue("");
        field.onChange?.("");
      }
    })();
  }, [field.value]); // (optional) add api if dynamic

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={styles.triggerButton}
        >
          {value
            ? suggestions.find((item) => item.value === value)?.label
            : "Select item..."}
          <ChevronsUpDownIcon className={styles.triggerButton_updownIcon} />
          {/* Hidden input to integrate with normal form submissions (if any). */}
          <input
            type="hidden"
            name={field.name}
            value={value}
            onChange={(e) => field.onChange?.(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(styles.Combobox, className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search item..."
            onValueChange={(value) => searchDebounced(value)}
          />
          <CommandList>
            <CommandEmpty>
              No item found.
              <br />
              <Button
                onClick={async () => {
                  let postData = {};
                  if (onBeforeCreate) postData = onBeforeCreate(searchTerm);
                  const resp = await fetch(api, {
                    method: "POST",
                    body: JSON.stringify(postData),
                  });
                  const json = await resp.json();
                  setSuggestions([
                    { value: json.key, label: json.name },
                    ...suggestions,
                  ]);
                  setValue(json.key);
                  field.onChange?.(json.key);
                  setOpen(false);
                }}
              >
                Create New
              </Button>
            </CommandEmpty>
            <CommandGroup>
              {suggestions.map((item) => {
                return (
                  <CommandItem
                    key={`combobox-item-${item.value}`}
                    value={item.value}
                    onSelect={(currentValue: string) => {
                      const newValue =
                        currentValue === value ? "" : currentValue;
                      setValue(newValue);
                      // Propagate to react-hook-form if onChange is provided
                      field.onChange?.(newValue);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        styles._checkIcon,
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
