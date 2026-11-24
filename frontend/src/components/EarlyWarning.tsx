// Early Warning: lookalike domains of a UAE organization, found before they are used.
// Dark onyx showcase with a gold radar. Each live lookalike appears as a blip; the list below
// explains every one. Motion is decorative only and stops under prefers-reduced-motion.
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, Container } from "./ui";
import { EASE_OUT, Reveal } from "./motion";
import { getEarlyWarning, type EarlyCandidate, type EarlyWarningResult } from "../lib/api";
import { useI18n } from "../lib/i18n";

const ORGS: { id: string; en: string; ar: string }[] = [
  { id: "emirates-nbd", en: "Emirates NBD", ar: "بنك الإمارات دبي الوطني" },
  { id: "adcb", en: "ADCB", ar: "بنك أبوظبي التجاري" },
  { id: "emirates-post", en: "Emirates Post", ar: "بريد الإمارات" },
  { id: "dewa", en: "DEWA", ar: "هيئة كهرباء ومياه دبي" },
  { id: "ad-police", en: "AD Police", ar: "شرطة أبوظبي" },
  { id: "fab", en: "FAB", ar: "بنك أبوظبي الأول" },
];

const RISK_STYLE: Record<string, { pill: string; dot: string }> = {
  high: { pill: "bg-[#e5484d]/15 text-[#ff8b8e] ring-1 ring-[#e5484d]/30", dot: "#ff6b6f" },
  watch: { pill: "bg-[#d9b76e]/15 text-[#ecd6a3] ring-1 ring-[#d9b76e]/30", dot: "#ecd6a3" },
  parked: { pill: "bg-white/8 text-white/70 ring-1 ring-white/15", dot: "rgba(255,255,255,0.55)" },
  low: { pill: "bg-white/5 text-white/55 ring-1 ring-white/10", dot: "rgba(255,255,255,0.35)" },
  defensive: { pill: "bg-[#3fb27f]/15 text-[#7fe0b0] ring-1 ring-[#3fb27f]/30", dot: "#7fe0b0" },
};

/** Stable pseudo-random angle per domain, so blips don't jump between renders. */
function angleOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 360) * (Math.PI / 180);
}
const RADIUS: Record<string, number> = { high: 0.3, watch: 0.52, parked: 0.72, low: 0.85, defensive: 0.9 };

function Radar({ scanning, items }: { scanning: boolean; items: EarlyCandidate[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(217,183,110,0.14),transparent)]" />
      {[1, 0.75, 0.5, 0.25].map((r) => (
        <div key={r} className="absolute rounded-full border border-[#d9b76e]/20" style={{ inset: `${(1 - r) * 50}%` }} />
      ))}
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#d9b76e]/15" />
      <div className="absolute inset-y-0 start-1/2 w-px bg-[#d9b76e]/15" />
      {!reduce && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, rgba(217,183,110,0.42), rgba(217,183,110,0.08) 18%, transparent 30%)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: scanning ? 1.6 : 6, ease: "linear", repeat: Infinity }}
        />
      )}
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ecd6a3] shadow-[0_0_24px_6px_rgba(236,214,163,0.55)]" />
      {items.slice(0, 40).map((c, i) => {
        const a = angleOf(c.domain);
        const r = RADIUS[c.risk] ?? 0.8;
        const x = 50 + Math.cos(a) * r * 50;
        const y = 50 + Math.sin(a) * r * 50;
        const col = RISK_STYLE[c.risk]?.dot ?? "#fff";
        return (
          <motion.span
            key={c.domain}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, background: col, boxShadow: `0 0 14px 3px ${col}` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 0.75], scale: [0, 1.6, 1] }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease: EASE_OUT }}
          />
        );
      })}
    </div>
  );
}

function Stat({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: EASE_OUT }}
      className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3"
    >
      <p className="font-display text-[28px] font-extrabold leading-none tabular-nums text-white">{value}</p>
      <p className="mt-1.5 text-small text-white/55">{label}</p>
    </motion.div>
  );
}

export function EarlyWarning() {
  const { t, lang } = useI18n();
  const E = t.early;
  const [org, setOrg] = useState(ORGS[0].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<EarlyWarningResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function scan(id = org) {
    setBusy(true);
    setErr(null);
    setCopied(false);
    try {
      setRes(await getEarlyWarning(id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const c = res?.candidates ?? [];
    return {
      live: c.filter((x) => x.resolves).length,
      certs: c.filter((x) => x.sources.includes("certificate")).length,
      high: c.filter((x) => x.risk === "high").length,
    };
  }, [res]);

  function copyTakedown() {
    if (!res) return;
    const rows = res.candidates
      .filter((c) => c.risk === "high" || c.risk === "watch")
      .map((c) => ({ domain: c.domain, risk: c.risk, imitates: res.org_name, how: c.match, live_in_dns: c.resolves,
                     ips: c.ips, certificate_first_seen: c.cert_first_seen, forwards_to: c.redirects_to, reasons: c.reasons }));
    const payload = {
      generated_by: "RAQEEB Early Warning", generated_utc: res.generated_utc, organization: res.org_name,
      official_domains: res.official_domains, fixture: res.fixture, candidates: rows,
      note: "Risk assessment from public DNS and certificate-log data, for review before any takedown request.",
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).then(() => setCopied(true)).catch(() => {});
  }

  return (
    <section id="early" data-theme="dark" className="grain relative scroll-mt-28 overflow-hidden bg-shell-950 py-24 text-white sm:py-32">
      <div aria-hidden className="pointer-events-none absolute -top-40 end-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(217,183,110,0.16),transparent)]" />
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Reveal>
              <span className="inline-flex rounded-control bg-[#d9b76e]/10 px-1.5 py-0.5 text-small text-[#ecd6a3]">{E.badge}</span>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 text-balance font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[44px]">{E.title}</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-[600px] text-lead text-white/65">{E.body}</p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-8">
                <p className="mb-2 text-small text-white/50">{E.pick}</p>
                <div className="flex flex-wrap gap-2">
                  {ORGS.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOrg(o.id);
                        scan(o.id);
                      }}
                      disabled={busy}
                      className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1 text-small transition-[background-color,border-color,color] duration-300 disabled:cursor-wait ${
                        org === o.id ? "border-[#d9b76e] bg-[#d9b76e] text-shell-950" : "border-white/15 text-white/75 hover:border-[#d9b76e] hover:text-[#ecd6a3]"
                      }`}
                    >
                      {lang === "ar" ? o.ar : o.en}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <Button onClick={() => scan()} disabled={busy} arrow={!busy}>
                    {busy ? E.scanning : E.scan}
                  </Button>
                  {res && <span className="text-small text-white/45">{E.time(res.generated_utc)}</span>}
                </div>
                {err && <p role="alert" className="mt-3 text-small text-[#ff8b8e]">{err}</p>}
              </div>
            </Reveal>
            <AnimatePresence>
              {res && (
                <motion.div key={res.org_id + res.generated_utc} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Stat value={res.checked_permutations} label={E.stats.checked} delay={0} />
                  <Stat value={stats.live} label={E.stats.live} delay={0.06} />
                  <Stat value={stats.certs} label={E.stats.certs} delay={0.12} />
                  <Stat value={stats.high} label={E.stats.high} delay={0.18} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Reveal delay={0.1}>
            <Radar scanning={busy} items={res?.candidates ?? []} />
          </Reveal>
        </div>

        {res && (
          <motion.div
            key={res.org_id + res.generated_utc}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="mt-14 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]"
          >
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-small text-white/60">
                {res.org_name} · <span dir="ltr" className="font-mono text-white/80">{res.official_domains.join(", ")}</span>
                {res.fixture && <span className="ms-2 rounded-control bg-[#d9b76e]/15 px-1.5 py-0.5 text-[#ecd6a3]">{E.fixture}</span>}
              </p>
              <button
                onClick={copyTakedown}
                className="inline-flex min-h-9 cursor-pointer items-center gap-2 self-start rounded-control border border-[#d9b76e]/40 px-3 text-small text-[#ecd6a3] transition-colors hover:bg-[#d9b76e]/10"
              >
                {copied ? E.copied : E.export}
              </button>
            </div>
            {res.candidates.length === 0 ? (
              <p className="px-6 py-8 text-body text-white/60">{E.none}</p>
            ) : (
              <motion.ul className="divide-y divide-white/[0.07]" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}>
                {res.candidates.map((c) => (
                  <motion.li
                    key={c.domain}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } } }}
                    className="grid gap-2 px-5 py-4 sm:grid-cols-[150px_1fr] sm:gap-5 sm:px-6"
                  >
                    <div>
                      <span title={E.riskHelp[c.risk]} className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small font-medium ${RISK_STYLE[c.risk]?.pill}`}>
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                        {E.risk[c.risk]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p dir="ltr" className="break-all text-start font-mono text-body text-white">{c.domain}</p>
                      <p className="mt-1 text-small text-white/55">{c.reasons[0]}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                        {c.sources.map((s) => (
                          <span key={s} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">{E.sources[s]}</span>
                        ))}
                        {c.cert_days_ago !== null && c.cert_days_ago >= 0 && (
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">{E.certAgo(c.cert_days_ago)}</span>
                        )}
                        {c.redirects_to && (
                          <span dir="ltr" className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">{E.forwards(c.redirects_to)}</span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}
            <div className="border-t border-white/10 px-5 py-4 text-small text-white/45 sm:px-6">
              {E.certNote(res.certificate_search)} {E.police}
            </div>
          </motion.div>
        )}
      </Container>
    </section>
  );
}
