import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong disabled:bg-navy-500/40 disabled:text-white/80",
  secondary: "border border-line bg-surface text-ink hover:border-ink-3",
  ghost: "text-ink-2 hover:text-ink hover:bg-canvas",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control px-5 py-2.5 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{children}</p>
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${s.cls}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em]">{children}</code>;
}
