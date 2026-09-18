import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-black disabled:bg-ink-faint",
  secondary:
    "border border-ink text-ink hover:bg-canvas-muted disabled:border-line disabled:text-ink-faint",
  ghost: "text-ink hover:bg-canvas-muted disabled:text-ink-faint",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium tracking-wide transition-colors disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    />
  );
}
