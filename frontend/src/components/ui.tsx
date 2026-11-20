import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  // Solid gold fill, white text
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-line-strong disabled:text-white",
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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-body font-semibold transition-colors duration-200 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
      {arrow && <ArrowRight />}
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
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card border ${
        highlight ? "border-transparent bg-accent-cream" : "border-line bg-surface"
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
      <Chevron className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </a>
  );
}

export type RiskLevel = "low" | "moderate" | "high" | "unknown";

const riskStyles: Record<RiskLevel, { label: string; cls: string; dot: string }> = {
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
  const s = riskStyles[level];
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
  return <code className="font-mono text-[0.92em]">{children}</code>;
}

/** Centred page container with 24px gutters (16px on phones). */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</div>;
}
