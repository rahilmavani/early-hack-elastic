"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { formatPrice } from "@/lib/money";
import { priceCeilings } from "@/lib/listing";
import type { ProductFilters } from "@/lib/catalogue";
import { useUpdateSearchParams } from "@/lib/hooks/useUpdateSearchParams";
import { cn } from "@/lib/cn";

type FilterRailProps = {
  filters: ProductFilters;
  options: {
    brands: string[];
    sizes: string[];
    colours: string[];
  };
};

type FilterGroupProps = {
  title: string;
  children: React.ReactNode;
};

function FilterGroup({ title, children }: FilterGroupProps) {
  return (
    <div className="border-line border-b py-5">
      <p className="mb-3 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function FilterRail({ filters, options }: FilterRailProps) {
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const updateSearchParams = useUpdateSearchParams();

  const hasActiveFilters =
    Boolean(filters.brands?.length) ||
    Boolean(filters.sizes?.length) ||
    Boolean(filters.colours?.length) ||
    filters.maxPrice !== undefined;

  function toggleValue(key: string, value: string) {
    updateSearchParams((params) => {
      const current = params.getAll(key);
      params.delete(key);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      next.forEach((item) => params.append(key, item));
    });
  }

  function setMaxPrice(ceiling: number | undefined) {
    updateSearchParams((params) => {
      if (ceiling === undefined) {
        params.delete("maxPrice");
      } else {
        params.set("maxPrice", String(ceiling));
      }
    });
  }

  function clearAll() {
    updateSearchParams((params) => {
      ["brand", "size", "colour", "maxPrice"].forEach((key) =>
        params.delete(key),
      );
    });
  }

  return (
    <aside className="lg:w-56 lg:shrink-0">
      <button
        type="button"
        onClick={() => setOpenOnMobile(!openOnMobile)}
        className="flex items-center gap-2 text-sm font-medium lg:hidden"
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} />
        Filters
      </button>

      <div
        className={cn(
          "mt-4 lg:mt-0",
          openOnMobile ? "block" : "hidden lg:block",
        )}
      >
        <div className="border-line flex items-center justify-between border-b pb-3">
          <p className="text-sm font-medium">Filters</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-ink-muted hover:text-ink text-xs"
            >
              Clear all
            </button>
          )}
        </div>

        <FilterGroup title="Brand">
          {options.brands.map((brand) => (
            <Checkbox
              key={brand}
              label={brand}
              checked={filters.brands?.includes(brand) ?? false}
              onChange={() => toggleValue("brand", brand)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Size">
          {options.sizes.map((size) => (
            <Checkbox
              key={size}
              label={size}
              checked={filters.sizes?.includes(size) ?? false}
              onChange={() => toggleValue("size", size)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Colour">
          {options.colours.map((colour) => (
            <Checkbox
              key={colour}
              label={colour}
              checked={filters.colours?.includes(colour) ?? false}
              onChange={() => toggleValue("colour", colour)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Price">
          {priceCeilings.map((ceiling) => (
            <label
              key={ceiling}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
            >
              <input
                type="radio"
                name="maxPrice"
                className="accent-ink size-4"
                checked={filters.maxPrice === ceiling}
                onChange={() => setMaxPrice(ceiling)}
              />
              <span>Under {formatPrice(ceiling)}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="maxPrice"
              className="accent-ink size-4"
              checked={filters.maxPrice === undefined}
              onChange={() => setMaxPrice(undefined)}
            />
            <span>All prices</span>
          </label>
        </FilterGroup>
      </div>
    </aside>
  );
}
