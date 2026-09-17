"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

type AccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function Accordion({
  title,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-line border-b">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-sm font-medium"
      >
        {title}
        {open ? (
          <Minus size={16} strokeWidth={1.5} />
        ) : (
          <Plus size={16} strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="text-ink-muted pb-4 text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
