import { useId } from "react";
import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, id, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="text-ink-muted mb-1.5 block text-xs font-medium"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "placeholder:text-ink-faint focus:border-ink h-10 w-full border px-3 text-sm transition-colors outline-none",
          error ? "border-danger" : "border-line",
        )}
        {...rest}
      />
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
