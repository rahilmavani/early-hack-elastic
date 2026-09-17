"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { categories } from "@/data/categories";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
        className="p-1"
      >
        {open ? (
          <X size={22} strokeWidth={1.5} />
        ) : (
          <Menu size={22} strokeWidth={1.5} />
        )}
      </button>

      {open && (
        <nav className="border-line bg-canvas absolute inset-x-0 top-16 border-b">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/c/${category.slug}`}
              onClick={() => setOpen(false)}
              className="border-line block border-t px-4 py-3 text-sm font-medium"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
