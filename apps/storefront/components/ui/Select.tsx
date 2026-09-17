import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", className)}>
      {label && <span className="text-ink-muted">{label}</span>}
      <span className="relative">
        <select
          className="border-line bg-canvas focus:border-ink h-9 appearance-none border pr-8 pl-3 text-sm outline-none"
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="text-ink-muted pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
        />
      </span>
    </label>
  );
}
