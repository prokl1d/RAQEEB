// Shared motion primitives for RAQEEB.
// Rules (ui-ux-pro-max): 300-450ms entrances, ease-out, small offsets (8-16px), stagger <= ~8 items,
// no decorative infinite loops, no overshoot on information-heavy UI, and everything respects
// prefers-reduced-motion (MotionConfig reducedMotion="user" in main.tsx + checks below).
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export const stagger = (each = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren: delay } },
});

/** Fades a block up the first time it scrolls into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{ hidden: fadeUp.hidden, show: { ...(fadeUp.show as object), transition: { duration: 0.45, ease: EASE_OUT, delay } } }}
    >
      {children}
    </motion.div>
  );
}

/** A container whose direct motion children (variants="fadeUp") appear one after another. */
export function RevealGroup({
  children,
  className = "",
  each = 0.07,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  each?: number;
  as?: "div" | "ol" | "ul";
}) {
  const Tag = as === "ol" ? motion.ol : as === "ul" ? motion.ul : motion.div;
  return (
    <Tag className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(each)}>
      {children}
    </Tag>
  );
}

/** Counts from 0 to `value` once visible. Shows the final number immediately with reduced motion. */
export function CountUp({ value, duration = 0.9, className = "" }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setShown(value);
    const controls = animate(0, value, { duration, ease: EASE_OUT, onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);
  return (
    <span ref={ref} className={className} aria-label={String(value)}>
      {shown}
    </span>
  );
}

const GAUGE_COLOR: Record<string, string> = {
  safe: "var(--color-risk-safe)",
  low: "var(--color-risk-low)",
  inactive: "var(--color-risk-inactive)",
  moderate: "var(--color-risk-moderate)",
  high: "var(--color-risk-high)",
  unknown: "var(--color-risk-unknown)",
};

/** Half-circle gauge for the risk score. Decorative: the number and label carry the meaning. */
export function RiskGauge({ score, level, noScore }: { score: number; level: string; noScore: boolean }) {
  const { t } = useI18n();
  const r = 70;
  const arc = `M ${90 - r} 90 A ${r} ${r} 0 0 1 ${90 + r} 90`;
  return (
    <div className="relative h-[104px] w-[180px]" dir="ltr">
      <svg viewBox="0 0 180 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d={arc} fill="none" stroke="var(--color-line)" strokeWidth="12" strokeLinecap="round" />
        {!noScore && (
          <motion.path
            d={arc}
            fill="none"
            stroke={GAUGE_COLOR[level]}
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: Math.max(score, 2) / 100 }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.15 }}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display text-[44px] font-extrabold leading-none tracking-[-1.5px] text-ink">
          {noScore ? "–" : <CountUp value={score} />}
        </span>
        <span className="mt-1 text-badge uppercase tracking-[0.08em] text-ink-3">{noScore ? t.gauge.none : t.gauge.label}</span>
      </div>
    </div>
  );
}
