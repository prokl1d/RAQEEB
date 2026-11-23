// "Protection everywhere": Search Shield, Describe a call and the business listing check.
// Same visual language as the rest of the site: onyx showcases with gold light, 3D gold emblems,
// scroll reveals and short, meaningful motion. Everything respects prefers-reduced-motion.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Badge, Button, Container, Mono } from "./ui";
import { EASE_OUT, Reveal, RevealGroup, RiskGauge, fadeUp } from "./motion";
import Particles from "./bits/Particles";
import ScrollReveal from "./bits/ScrollReveal";
import { CALL_EXAMPLES } from "./InvestigationInput";
import {
  checkLinks,
  checkListing,
  getListingDemo,
  getSearchDemo,
  type DemoListing,
  type LinkCheck,
  type ListingCheckItem,
  type ListingInput,
  type ListingResult,
  type SearchDemo,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { EmblemIcon } from "./Emblem3D";

const Emblem3D = lazy(() => import("./Emblem3D"));

// ───────────────────────── shared pieces ─────────────────────────

/** Dark onyx showcase with gold light, holding a 3D gold emblem. */
function EmblemStage({ icon, className = "", children }: { icon: EmblemIcon; className?: string; children?: ReactNode }) {
  return (
    <div data-theme="dark" className={`grain relative overflow-hidden rounded-[24px] border border-white/10 bg-shell-950 shadow-[0_50px_120px_-50px_rgba(217,183,110,0.45)] ${className}`}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_45%,rgba(217,183,110,0.2),transparent_70%)]" />
      <div aria-hidden className="absolute inset-x-[18%] bottom-[8%] h-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(217,183,110,0.25),transparent)] blur-md" />
      <Suspense fallback={null}>
        <Emblem3D icon={icon} />
      </Suspense>
      {children}
    </div>
  );
}

function Heading({ badge, title, body, dark = false }: { badge: string; title: string; body: string; dark?: boolean }) {
  return (
    <div>
      <Reveal>
        {dark ? (
          <span className="inline-flex rounded-control bg-[#d9b76e]/10 px-1.5 py-0.5 text-small text-[#ecd6a3]">{badge}</span>
        ) : (
          <Badge>{badge}</Badge>
        )}
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className={`mt-4 text-balance font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[44px] ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className={`mt-5 max-w-[600px] text-lead ${dark ? "text-white/65" : "text-ink-2"}`}>{body}</p>
      </Reveal>
    </div>
  );
}

function Typewriter({ text, className = "" }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) return setN(text.length);
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), 28);
    return () => clearInterval(id);
  }, [text, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {!reduce && <span aria-hidden className="ms-0.5 inline-block h-[1.05em] w-px translate-y-[2px] animate-pulse bg-[#d9b76e]" />}
    </span>
  );
}

// ───────────────────────── intro ─────────────────────────

const INTRO_ICONS: Record<string, ReactNode> = {
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M8.5 12l2.5 2.5 4.5-5" />,
  call: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  listing: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0z" />,
};

export function ProtectIntro() {
  const { t } = useI18n();
  const P = t.protect;
  const items = [
    { id: "shield", label: P.shield.badge, title: P.shield.title },
    { id: "call", label: P.call.badge, title: P.call.title },
    { id: "listing", label: P.listing.badge, title: P.listing.title },
  ];
  return (
    <section id="protect" className="scroll-mt-32 pb-10 pt-24 sm:pt-32">
      <Container>
        <div className="max-w-[800px]">
          <Reveal>
            <Badge>{P.badge}</Badge>
          </Reveal>
          <ScrollReveal
            key={P.title}
            containerClassName="mt-4"
            textClassName="font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[48px]"
            baseOpacity={0.12}
            enableBlur
            blurStrength={6}
            baseRotation={0}
          >
            {P.title}
          </ScrollReveal>
          <Reveal delay={0.1}>
            <p className="mt-4 text-lead text-ink-2">{P.lead}</p>
          </Reveal>
        </div>
        <RevealGroup className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <motion.a
              key={it.id}
              href={`#${it.id}`}
              variants={fadeUp}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-card border border-line bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_24px_50px_-30px_rgba(146,114,42,0.55)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-accent-cream text-accent transition-transform duration-500 ease-out group-hover:rotate-[8deg] group-hover:scale-105">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {INTRO_ICONS[it.id]}
                </svg>
              </span>
              <span className="text-small font-semibold uppercase tracking-[0.12em] text-accent">{it.label}</span>
              <span className="font-display text-card font-semibold leading-snug text-ink">{it.title}</span>
            </motion.a>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

// ───────────────────────── Search Shield ─────────────────────────

const VERDICT_STYLE: Record<string, string> = {
  official: "bg-[#0f2e24] text-[#6ee7b7] ring-[#6ee7b7]/25",
  listed: "bg-[#2a2417] text-[#ecd6a3] ring-[#d9b76e]/30",
  impersonation: "bg-[#3a1414] text-[#ff8a80] ring-[#ff8a80]/30",
  caution: "bg-[#3a2414] text-[#fdba74] ring-[#fdba74]/30",
  unknown: "bg-white/[0.06] text-white/70 ring-white/15",
  invalid: "bg-white/[0.06] text-white/50 ring-white/10",
};

function useWhy() {
  const { t } = useI18n();
  const S = t.protect.shield;
  return (c: LinkCheck) => {
    switch (c.verdict) {
      case "official":
        return S.why.official(c.org_name ?? "");
      case "listed":
        return S.why.listed(c.org_name ?? "");
      case "impersonation":
        return S.why.impersonation(c.org_name ?? "", c.official_domain ?? "", S.match[c.match ?? ""] ?? c.match ?? "");
      case "caution":
        return S.why.caution(c.flags.map((f) => S.flags[f] ?? f).join(", "));
      case "unknown":
        return S.why.unknown();
      default:
        return S.why.invalid();
    }
  };
}

function VerdictPill({ c, delay = 0 }: { c: LinkCheck; delay?: number }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, scale: 0.7, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
      className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 ${VERDICT_STYLE[c.verdict]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t.protect.shield.verdict[c.verdict]}
    </motion.span>
  );
}

function ResultRow({ title, url, snippet, sponsored, check, delay }: { title?: string; url: string; snippet?: string; sponsored?: boolean; check: LinkCheck; delay: number }) {
  const { t } = useI18n();
  const why = useWhy();
  const reduce = useReducedMotion();
  const bad = check.verdict === "impersonation" || check.verdict === "caution";
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: delay * 0.35 }}
      className={`relative rounded-[14px] border p-4 transition-colors duration-500 sm:p-5 ${bad ? "border-[#ff8a80]/25 bg-[#ff8a80]/[0.04]" : "border-white/10 bg-white/[0.03]"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div dir="ltr" className="min-w-0 text-left">
          <div className="flex items-center gap-2 text-[13px] text-white/45">
            {sponsored && <span className="rounded border border-white/25 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">{t.protect.shield.ad}</span>}
            <span className="truncate font-mono">{url}</span>
          </div>
          {title && <p className="mt-1 truncate text-[17px] font-semibold text-[#ecd6a3]">{title}</p>}
          {snippet && <p className="mt-1 line-clamp-2 text-small text-white/55">{snippet}</p>}
        </div>
        <VerdictPill c={check} delay={delay} />
      </div>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.15 }}
        className={`mt-3 border-t border-white/10 pt-3 text-small ${bad ? "text-[#ffb4ab]" : "text-white/60"}`}
      >
        {why(check)}
      </motion.p>
    </motion.li>
  );
}

export function SearchShield() {
  const { t, lang } = useI18n();
  const S = t.protect.shield;
  const reduce = useReducedMotion();
  const [demo, setDemo] = useState<SearchDemo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qi, setQi] = useState(0);
  const [own, setOwn] = useState("");
  const [ownBusy, setOwnBusy] = useState(false);
  const [ownRes, setOwnRes] = useState<LinkCheck[] | null>(null);
  const [ownErr, setOwnErr] = useState<string | null>(null);

  useEffect(() => {
    getSearchDemo().then(setDemo).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const q = demo?.queries[qi];
  const bad = q ? q.results.filter((r) => r.check.verdict === "impersonation").length : 0;
  const stepDelay = (i: number) => (reduce ? 0 : 0.5 + i * 0.32);

  async function runOwn() {
    const links = own.split(/\s*\n\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 25);
    if (!links.length) return;
    setOwnBusy(true);
    setOwnErr(null);
    try {
      setOwnRes(await checkLinks(links));
    } catch (e) {
      setOwnErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOwnBusy(false);
    }
  }

  return (
    <section id="shield" data-theme="dark" className="grain relative scroll-mt-28 overflow-hidden bg-shell-950 py-24 text-white sm:py-32">
      <div aria-hidden className="absolute inset-0 opacity-60">
        <Particles particleColors={["#d9b76e", "#f3dfae", "#a8863f"]} particleCount={90} particleSpread={12} speed={0.04} particleBaseSize={60} alphaParticles moveParticlesOnHover={false} glow={0.6} twinkle={0.5} pixelRatio={1} />
      </div>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(45%_55%_at_85%_10%,rgba(217,183,110,0.16),transparent_70%)]" />
      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Heading dark badge={S.badge} title={S.title} body={S.body} />
            <Reveal delay={0.15}>
              <p className="mt-6 inline-flex items-start gap-2 rounded-[12px] border border-[#d9b76e]/25 bg-[#d9b76e]/[0.07] px-3.5 py-2.5 text-small text-[#ecd6a3]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {S.police}
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <EmblemStage icon="shield" className="mx-auto aspect-square w-full max-w-[420px]" />
          </Reveal>
        </div>

        {/* Search console */}
        <Reveal delay={0.1}>
          <div className="mt-14 rounded-[22px] bg-gradient-to-b from-[#d9b76e]/45 via-[#d9b76e]/10 to-transparent p-px shadow-[0_40px_120px_-50px_rgba(216,183,115,0.5)]">
            <div className="rounded-[21px] bg-[#0e0f13]/95 p-5 backdrop-blur-md sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="me-1 text-[12px] font-medium uppercase tracking-[0.14em] text-white/45">{S.queries}</span>
                {demo?.queries.map((qq, i) => (
                  <button
                    key={qq.id}
                    onClick={() => setQi(i)}
                    className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1 text-small transition-[background-color,border-color,color] duration-300 ${
                      i === qi ? "border-[#d9b76e] bg-[#d9b76e] text-[#1a1408]" : "border-white/15 text-white/70 hover:border-[#d9b76e]/60 hover:text-white"
                    }`}
                  >
                    {lang === "ar" ? qq.query_ar : qq.query}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-h-[52px] flex-1 items-center gap-3 rounded-full border border-[#d9b76e]/40 bg-white/[0.04] px-5 shadow-[inset_0_0_30px_rgba(217,183,110,0.06)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d9b76e" strokeWidth="2" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  {q && <Typewriter key={q.id + lang} text={lang === "ar" ? q.query_ar : q.query} className="text-[17px] text-white" />}
                </div>
                {q && (
                  <motion.span
                    key={q.id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: reduce ? 0 : stepDelay(q.results.length) }}
                    className="inline-flex items-center gap-2 self-start rounded-full bg-[#3a1414] px-3.5 py-2 text-small font-semibold text-[#ff8a80] sm:self-auto"
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
                    {S.summary(bad, q.results.length)}
                  </motion.span>
                )}
              </div>

              {err && <p role="alert" className="mt-6 text-small text-[#ff8a80]">{err}</p>}

              {q && (
                <div className="relative mt-6">
                  {!reduce && (
                    <motion.div
                      key={"scan-" + q.id}
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-10 h-16 bg-gradient-to-b from-transparent via-[#d9b76e]/25 to-transparent"
                      initial={{ top: "-10%", opacity: 0 }}
                      animate={{ top: ["-10%", "100%"], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 0.5 + q.results.length * 0.32, ease: "easeInOut", delay: 0.35 }}
                    />
                  )}
                  <ul key={q.id} className="space-y-3" aria-live="polite">
                    {q.results.map((r, i) => (
                      <ResultRow key={r.url} title={r.title} url={r.url} snippet={r.snippet} sponsored={r.sponsored} check={r.check} delay={stepDelay(i)} />
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-5 text-[13px] leading-5 text-white/40">{S.note}</p>

              {/* Own links */}
              <div className="mt-8 border-t border-white/10 pt-8">
                <h3 className="font-display text-card font-semibold text-white">{S.ownTitle}</h3>
                <p className="mt-1 text-small text-white/55">{S.ownHint}</p>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start">
                  <textarea
                    value={own}
                    onChange={(e) => setOwn(e.target.value)}
                    rows={3}
                    dir="ltr"
                    placeholder={"https://example.com\nemiratesnbd-secure.co"}
                    className="w-full flex-1 resize-none rounded-[12px] border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-small text-white outline-none transition-shadow duration-200 placeholder:text-white/30 focus:border-[#d9b76e] focus:shadow-[0_0_0_3px_rgba(217,183,110,0.25)]"
                  />
                  <Button onClick={runOwn} disabled={ownBusy || !own.trim()} arrow={!ownBusy} className="lg:mt-0">
                    {ownBusy ? S.ownBusy : S.ownButton}
                  </Button>
                </div>
                {ownErr && <p role="alert" className="mt-3 text-small text-[#ff8a80]">{ownErr}</p>}
                {ownRes && (
                  <ul className="mt-5 space-y-3" aria-live="polite">
                    {ownRes.map((c, i) => (
                      <ResultRow key={c.input + i} url={c.domain ?? c.input} check={c} delay={reduce ? 0 : 0.1 + i * 0.08} />
                    ))}
                  </ul>
                )}
                <p className="mt-5 flex items-center gap-2 text-small text-white/50">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d9b76e]" />
                  {S.extension}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

// ───────────────────────── Describe a call ─────────────────────────

export function CallCheck({ onTry, onDescribe }: { onTry: (story: string) => void; onDescribe: () => void }) {
  const { t } = useI18n();
  const C = t.protect.call;
  const labels = t.input.callExamples;
  return (
    <section id="call" className="scroll-mt-28 py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="order-last lg:order-first">
            <EmblemStage icon="phone" className="mx-auto aspect-square w-full max-w-[440px]">
              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
                <span className="flex items-end gap-[3px]" aria-hidden>
                  {Array.from({ length: 18 }, (_, i) => (
                    <span
                      key={i}
                      className="wave-bar w-[3px] rounded-full bg-[#d9b76e]/70"
                      style={{ height: `${8 + ((i * 7) % 18)}px`, animationDelay: `${i * 0.07}s` }}
                    />
                  ))}
                </span>
              </div>
            </EmblemStage>
          </Reveal>
          <div>
            <Heading badge={C.badge} title={C.title} body={C.body} />
            <Reveal delay={0.12}>
              <p className="mt-8 text-small font-semibold uppercase tracking-[0.12em] text-accent">{C.listensTitle}</p>
            </Reveal>
            <RevealGroup className="mt-3 flex flex-wrap gap-2" each={0.04}>
              {C.listens.map((x) => (
                <motion.span key={x} variants={fadeUp} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-small font-medium text-ink-2">
                  {x}
                </motion.span>
              ))}
            </RevealGroup>

            <Reveal delay={0.15}>
              <p className="mt-9 text-small font-semibold uppercase tracking-[0.12em] text-accent">{C.tryTitle}</p>
            </Reveal>
            <RevealGroup className="mt-3 grid gap-3 sm:grid-cols-2">
              {CALL_EXAMPLES.map((story, i) => (
                <motion.button
                  key={i}
                  variants={fadeUp}
                  onClick={() => onTry(story)}
                  className="group flex cursor-pointer flex-col gap-3 rounded-card border border-line bg-surface p-5 text-start transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_24px_50px_-30px_rgba(146,114,42,0.55)]"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-small font-semibold text-accent">{labels[i]}</span>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-accent transition-transform duration-200 rtl:-scale-x-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden>
                      <path d="M3.5 10h12m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span dir="auto" className="line-clamp-3 text-small leading-6 text-ink-2">“{story}”</span>
                </motion.button>
              ))}
            </RevealGroup>

            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button onClick={onDescribe} arrow>
                  {C.cta}
                </Button>
              </div>
              <p className="mt-6 flex items-start gap-2 text-small text-ink-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {C.future}
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ───────────────────────── Business listing check ─────────────────────────

const BAND_LEVEL: Record<string, "safe" | "low" | "moderate" | "high" | "unknown"> = {
  likely_safe: "safe",
  low: "low",
  moderate: "moderate",
  high: "high",
  needs_verification: "unknown",
};
const BAND_STYLE: Record<string, string> = {
  likely_safe: "bg-risk-safe-bg text-risk-safe",
  low: "bg-risk-low-bg text-risk-low",
  moderate: "bg-risk-moderate-bg text-risk-moderate",
  high: "bg-risk-high-bg text-risk-high",
  needs_verification: "bg-risk-unknown-bg text-risk-unknown",
};

function StatusIcon({ status }: { status: ListingCheckItem["status"] }) {
  const cls = { ok: "bg-risk-safe-bg text-risk-safe", warn: "bg-accent-soft text-accent-strong", bad: "bg-risk-high-bg text-risk-high", missing: "bg-canvas text-ink-3 ring-1 ring-line" }[status];
  return (
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`} aria-hidden>
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {status === "ok" && <path d="m5 10.5 3.2 3.2L15 7" />}
        {status === "warn" && <path d="M10 5.5v5.5M10 14.5v.1" />}
        {status === "bad" && <path d="m6 6 8 8M14 6l-8 8" />}
        {status === "missing" && <path d="M6 10h8" />}
      </svg>
    </span>
  );
}

function useListingText() {
  const { t } = useI18n();
  const L = t.protect.listing;
  const S = t.protect.shield;
  return (c: ListingCheckItem): string => {
    const p = c.params as Record<string, string | string[] | boolean | undefined>;
    const org = String(p.org ?? "");
    switch (c.key) {
      case "name":
        return c.status === "ok" ? L.name.ok(org) : c.status === "warn" ? L.name.warn(org) : L.name.missing();
      case "website":
        if (c.status === "ok") return L.website.ok(String(p.domain), org);
        if (c.status === "bad")
          return p.match === "unrelated"
            ? L.website.unrelated(String(p.domain), org, String(p.official))
            : L.website.imitation(String(p.domain), org, String(p.official)).replace(/\.$/, "") +
                (S.match[String(p.match)] ? ` · ${S.match[String(p.match)]}.` : ".");
        if (p.input) return S.why.invalid();
        return p.domain ? L.website.unknown(String(p.domain)) : L.website.none();
      case "phone": {
        const official = Array.isArray(p.official) ? p.official.join(" / ") : "";
        if (c.status === "ok") return L.phone.ok(String(p.given), org);
        if (c.status === "bad") return L.phone.bad(String(p.given), org, official);
        if (p.given && p.org) return L.phone.noOfficial(String(p.org));
        if (p.given) return L.name.missing();
        return L.phone.none();
      }
      default:
        return L.address;
    }
  };
}

export function ListingCheck() {
  const { t, lang } = useI18n();
  const L = t.protect.listing;
  const text = useListingText();
  const [samples, setSamples] = useState<DemoListing[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState<ListingInput>({ name: "", phone: "", website: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ListingResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getListingDemo()
      .then((d) => {
        setSamples(d);
        if (d[1]) {
          setActive(d[1].id);
          setForm({ ...d[1].listing, phone: d[1].listing.phone ?? "", website: d[1].listing.website ?? "", address: d[1].listing.address ?? "" });
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  async function run(input = form) {
    if (!input.name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const clean = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, (v ?? "").trim() || undefined])) as unknown as ListingInput;
      setRes(await checkListing(clean));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-3 outline-none transition-shadow duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]";
  const fields: { k: keyof ListingInput; ltr?: boolean }[] = useMemo(() => [{ k: "name" }, { k: "phone", ltr: true }, { k: "website", ltr: true }, { k: "address" }], []);

  return (
    <section id="listing" className="scroll-mt-28 border-y border-line bg-surface py-24 sm:py-32">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <Heading badge={L.badge} title={L.title} body={L.body} />
            <Reveal delay={0.12}>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="me-1 text-small text-ink-3">{L.samples}</span>
                {samples.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setActive(d.id);
                      const f = { ...d.listing, phone: d.listing.phone ?? "", website: d.listing.website ?? "", address: d.listing.address ?? "" };
                      setForm(f);
                      run(f);
                    }}
                    className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1 text-small transition-[background-color,border-color,color] duration-300 ${
                      active === d.id ? "border-accent bg-accent text-on-accent" : "border-line text-ink-2 hover:border-accent hover:text-accent-strong"
                    }`}
                  >
                    {lang === "ar" ? d.label_ar : d.label}
                  </button>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <form
                className="mt-6 grid gap-4 rounded-card border border-line bg-canvas p-5 sm:grid-cols-2 sm:p-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  setActive(null);
                  run();
                }}
              >
                {fields.map(({ k, ltr }) => (
                  <label key={k} className={k === "name" || k === "address" ? "sm:col-span-2" : ""}>
                    <span className="mb-1.5 block text-small font-medium text-ink">{L.fields[k]}</span>
                    <input
                      value={form[k] ?? ""}
                      dir={ltr ? "ltr" : "auto"}
                      maxLength={k === "website" ? 500 : 200}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                      className={`${field} ${ltr ? "font-mono" : ""}`}
                    />
                  </label>
                ))}
                <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-small text-ink-3">{L.note}</p>
                  <Button type="submit" disabled={busy || !form.name.trim()} arrow={!busy}>
                    {busy ? L.checking : L.check}
                  </Button>
                </div>
              </form>
            </Reveal>
            {err && <p role="alert" className="mt-3 text-small text-risk-high">{err}</p>}
          </div>

          <div ref={resultRef} className="lg:sticky lg:top-28">
            {!res ? (
              <Reveal delay={0.1}>
                <EmblemStage icon="pin" className="mx-auto aspect-square w-full max-w-[460px]" />
              </Reveal>
            ) : (
              <motion.div
                key={JSON.stringify(form) + res.score + res.band}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className="overflow-hidden rounded-[20px] border border-line bg-canvas shadow-[0_40px_100px_-60px_rgba(27,29,36,0.55)]"
              >
                <motion.div
                  className={`h-1.5 origin-left rtl:origin-right ${res.band === "high" ? "bg-risk-high" : res.band === "moderate" ? "bg-risk-moderate" : res.band === "needs_verification" ? "bg-risk-unknown" : "bg-risk-safe"}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
                <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-start sm:p-7">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small font-medium ${BAND_STYLE[res.band]}`}>
                        <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
                        {L.band[res.band]}
                      </span>
                      <span className="text-small text-ink-3">{L.coverage(res.coverage)}</span>
                    </div>
                    <p className="mt-3 font-display text-[22px] font-bold leading-[30px] text-ink">{L.headline[res.band]}</p>
                  </div>
                  <div className="flex justify-center">
                    <RiskGauge score={res.score} level={BAND_LEVEL[res.band]} noScore={res.band === "needs_verification"} />
                  </div>
                </div>
                <motion.ul className="divide-y divide-line border-t border-line" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}>
                  {res.checks.map((c) => (
                    <motion.li key={c.key} variants={fadeUp} className="flex gap-3 bg-surface px-6 py-4">
                      <StatusIcon status={c.status} />
                      <div className="min-w-0">
                        <p className="text-small font-semibold text-ink">{L.rows[c.key]}</p>
                        <p className="mt-0.5 break-words text-small text-ink-2">{text(c)}</p>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
                {res.claimed && (res.official_phones.length > 0 || res.official_domains.length > 0) && (
                  <div className="border-t border-line bg-accent-cream px-6 py-5 text-small text-accent-strong">
                    <p className="font-semibold">{L.official} · {res.claimed}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {res.official_phones.length > 0 && <Mono>{res.official_phones.join(" / ")}</Mono>}
                      {res.official_domains.length > 0 && <Mono>{res.official_domains.join(", ")}</Mono>}
                      {res.phone_source && (
                        <a href={res.phone_source} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                          {L.source}
                        </a>
                      )}
                    </p>
                    <p className="mt-2 text-accent-strong/80">{L.advice}</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
