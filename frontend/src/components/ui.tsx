import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useI18n } from "../lib/i18n";

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  // Solid gold fill, white text
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover disabled:bg-line-strong disabled:text-surface",
  // 2px gold outline, gold text
  secondary:
    "border-2 border-accent text-accent hover:bg-accent-cream disabled:border-line-strong disabled:text-ink-3",
  ghost: "text-ink hover:text-accent",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  arrow = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; arrow?: boolean }) {
  return (
    <button
      className={`group inline-flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap justify-center gap-2 rounded-control px-4 text-body font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out enabled:hover:shadow-[0_6px_18px_-8px_rgba(146,114,42,0.55)] enabled:active:scale-[0.98] disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
      {arrow && <ArrowRight className="transition-transform duration-200 ease-out rtl:-scale-x-100 group-enabled:group-hover:translate-x-0.5 rtl:group-enabled:group-hover:-translate-x-0.5" />}
    </button>
  );
}

export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M3.5 10h12m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Bordered card, no drop shadow. `highlight` gives the cream "active" fill. */
export function Card({
  children,
  className = "",
  highlight = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  /** Lift slightly and pick up a gold edge on hover (for browsable cards, not report panels). */
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-card border ${
        highlight ? "border-transparent bg-accent-cream" : "border-line bg-surface"
      } ${
        interactive
          ? "transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_18px_40px_-24px_rgba(27,29,36,0.35)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Small gold-tint label, used above section titles. */
export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control bg-accent-soft px-1.5 py-0.5 text-small font-normal text-accent-strong ${className}`}
    >
      {children}
    </span>
  );
}

export function LinkMore({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="group inline-flex items-center gap-3 text-body text-accent hover:text-accent-strong">
      {children}
      <Chevron className="transition-transform duration-200 rtl:-scale-x-100 group-hover:translate-x-0.5" />
    </a>
  );
}

export type RiskLevel = "safe" | "low" | "inactive" | "moderate" | "high" | "unknown";

const riskStyles: Record<RiskLevel, { label: string; cls: string; dot: string }> = {
  safe: { label: "Likely Safe", cls: "bg-risk-safe-bg text-risk-safe", dot: "bg-risk-safe" },
  inactive: { label: "Inactive Link", cls: "bg-risk-inactive-bg text-risk-inactive", dot: "bg-risk-inactive" },
  low: { label: "Low Risk", cls: "bg-risk-low-bg text-risk-low", dot: "bg-risk-low" },
  moderate: {
    label: "Moderate Risk",
    cls: "bg-risk-moderate-bg text-risk-moderate",
    dot: "bg-risk-moderate",
  },
  high: { label: "High Risk", cls: "bg-risk-high-bg text-risk-high", dot: "bg-risk-high" },
  unknown: {
    label: "Unknown Risk",
    cls: "bg-risk-unknown-bg text-risk-unknown",
    dot: "bg-risk-unknown",
  },
};

/** Risk is always shown as colour + text, never colour alone. */
export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useI18n();
  const s = { ...riskStyles[level], label: t.risk[level] };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small font-medium ${s.cls}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  // Domains and URLs always read left-to-right, also inside Arabic text.
  return <code dir="ltr" className="font-mono text-[0.92em] [unicode-bidi:isolate]">{children}</code>;
}

/** Centred page container with 24px gutters (16px on phones). */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</div>;
}
