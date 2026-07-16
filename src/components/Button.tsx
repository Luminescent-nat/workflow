import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "default" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-600)] text-white hover:bg-[var(--accent-700)] hover:shadow-md hover:shadow-indigo-500/15 active:bg-[var(--accent-700)]",
  default:
    "border border-[var(--brand-200)] bg-white text-[var(--brand-700)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] active:bg-[var(--brand-100)]",
  danger:
    "border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 active:bg-red-100",
  ghost:
    "text-[var(--brand-500)] hover:bg-[var(--brand-100)] hover:text-[var(--brand-700)] active:bg-[var(--brand-200)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs gap-1 rounded-lg",
  md: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  lg: "px-4 py-2 text-sm gap-1.5 rounded-lg",
};

export default function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-1",
        styles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
