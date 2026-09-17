"use client";

import { Select } from "@/components/ui/Select";
import { sortOptions } from "@/lib/listing";
import type { SortKey } from "@/lib/catalogue";
import { useUpdateSearchParams } from "@/lib/hooks/useUpdateSearchParams";

type SortSelectProps = {
  value: SortKey;
};

export function SortSelect({ value }: SortSelectProps) {
  const updateSearchParams = useUpdateSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    updateSearchParams((params) => {
      if (next === "recommended") {
        params.delete("sort");
      } else {
        params.set("sort", next);
      }
    });
  }

  return (
    <Select label="Sort by" value={value} onChange={handleChange}>
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
