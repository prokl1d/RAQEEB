import { useState } from "react";
import { motion } from "motion/react";
import { EASE_OUT, RiskGauge, fadeUp, stagger } from "./motion";
import type { Evidence, EvidenceStatus, InvestigationResult, RiskBand } from "../lib/api";
import { Badge, Card, Mono, RiskBadge, type RiskLevel } from "./ui";
import { useI18n } from "../lib/i18n";

const bandLevel: Record<RiskBand, RiskLevel> = {
  "Likely Safe": "safe",
  "Inactive Link": "inactive",
  "Low Risk": "low",
  "Moderate Risk": "moderate",
  "High Risk": "high",
  "Unknown Risk": "unknown",
};

const bandBar: Record<RiskLevel, string> = {
  safe: "bg-risk-safe",
  inactive: "bg-risk-inactive",
  low: "bg-risk-low",
  moderate: "bg-risk-moderate",
  high: "bg-risk-high",
  unknown: "bg-risk-unknown",
};

const outcomeTone: Record<string, string> = {
  "Verified Match": "text-risk-low",
  "Possible Impersonation": "text-risk-high",
  "No Verified Relationship Found": "text-risk-high",
  "Unable to Verify": "text-ink-2",
};

const statusGroups: { status: EvidenceStatus; dot: string }[] = [
  { status: "confirmed", dot: "bg-risk-high" },
  { status: "contradictory", dot: "bg-risk-moderate" },
  { status: "suspicious", dot: "bg-risk-moderate" },
  { status: "verified", dot: "bg-risk-low" },
  { status: "unverified", dot: "bg-ink-3" },
  { status: "missing", dot: "bg-line-strong" },
];

function EvidenceRow({ e, note }: { e: Evidence; note?: string }) {
  const [open, setOpen] = useState(false);
  const { t, lang } = useI18n();
  const technical = Object.entries(e.raw).filter(([k]) => !["start", "end"].includes(k));
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 text-start transition-colors duration-200 hover:bg-canvas"
      >
        <span dir={lang === "ar" ? "ltr" : undefined} className={lang === "ar" ? "min-w-0 flex-1 text-right" : undefined}>
          <span className="block text-body font-medium text-ink">{e.finding}</span>
          <span className="mt-1 block text-small text-ink-2">{note ?? e.why_it_matters}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="hidden rounded-control bg-canvas px-1.5 py-0.5 text-badge text-ink-3 sm:inline">
            {t.report.categoryShort[e.category]}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={`text-ink-3 transition-transform duration-200 ease-out rtl:-scale-x-100 ${open ? "rotate-90 text-accent rtl:-rotate-90" : ""}`}>
            <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 px-5 pb-4 text-small text-ink-2">
            <p>
              <span className="font-medium text-ink">{t.report.evidence.source}</span> <span dir="ltr">{e.source}</span>
            </p>
            {technical.length > 0 && (
              <pre className="overflow-x-auto rounded-panel border border-line bg-canvas p-3 font-mono text-[12px] leading-5 text-ink-2">
                {JSON.stringify(Object.fromEntries(technical), null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightedMessage({ text, evidence }: { text: string; evidence: Evidence[] }) {
  const spans = evidence
    .filter((e) => e.category === "content" && typeof e.raw.start === "number")
    .map((e) => ({ start: e.raw.start as number, end: e.raw.end as number }))
    .sort((a, b) => a.start - b.start);
  const parts: { t: string; mark: boolean }[] = [];
  let i = 0;
  for (const s of spans) {
    if (s.start < i) continue;
    parts.push({ t: text.slice(i, s.start), mark: false }, { t: text.slice(s.start, s.end), mark: true });
    i = s.end;
  }
  parts.push({ t: text.slice(i), mark: false });
  return (
    <p className="whitespace-pre-wrap break-words text-body leading-7 text-ink">
      {parts.map((p, k) =>
        p.mark ? (
          <mark key={k} className="rounded bg-risk-moderate-bg px-0.5 text-risk-moderate">
            {p.t}
          </mark>
        ) : (
          <span key={k}>{p.t}</span>
        ),
      )}
    </p>
  );
}

/** For a described phone call: who they claimed to be, what they asked for, and how to check officially. */
function CallSummary({ result }: { result: InvestigationResult }) {
  const { t } = useI18n();
  const C = t.protect.callReport;
  const call = result.call!;
  const chips = (keys: string[], tone: string) =>
    keys.map((k) => (
      <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-small font-medium ${tone}`}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {C.rules[k] ?? k}
      </span>
    ));
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-px bg-line md:grid-cols-3">
        <div className="bg-surface p-6">
          <Badge>{C.claimed}</Badge>
          <p className="mt-3 font-display text-card font-semibold text-ink">{call.claimed.length ? call.claimed.join(", ") : C.nobody}</p>
        </div>
        <div className="bg-surface p-6">
          <Badge>{C.askedFor}</Badge>
          <div className="mt-3 flex flex-wrap gap-2">
            {call.asked_for.length ? chips(call.asked_for, "bg-risk-high-bg text-risk-high") : <span className="text-body text-ink-2">{C.nothingAsked}</span>}
          </div>
        </div>
        <div className="bg-surface p-6">
          <Badge>{C.pressure}</Badge>
          <div className="mt-3 flex flex-wrap gap-2">
            {call.pressure.length ? chips(call.pressure, "bg-risk-moderate-bg text-risk-moderate") : <span className="text-body text-ink-2">{C.noPressure}</span>}
          </div>
        </div>
      </div>
      <div className="grid gap-4 border-t border-line bg-accent-cream p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          {call.contacts.map((c) =>
            c.phones.length ? (
              <p key={c.org_id} className="text-body text-accent-strong">
                <span className="font-semibold">{C.callBack}</span> · {c.org_name}:{" "}
                <span dir="ltr" className="font-mono font-semibold [unicode-bidi:isolate]">{c.phones.join(" / ")}</span>
                {c.source && (
                  <a href={c.source} target="_blank" rel="noreferrer" className="ms-2 text-small text-accent underline underline-offset-2">
                    {C.source}
                  </a>
                )}
              </p>
            ) : (
              <p key={c.org_id} className="text-body text-accent-strong">{C.noPhone(c.org_name)}</p>
            ),
          )}
          <p className="text-small text-accent-strong/80">{C.aman}</p>
        </div>
      </div>
    </Card>
  );
}

export function Report({ result, message }: { result: InvestigationResult; message?: string }) {
  const { score, identity, ai } = result;
  const level = bandLevel[score.band];
  const { t, lang } = useI18n();
  const R = t.report;
  const ar = lang === "ar";
  const outcome = R.outcomes[identity.outcome] ?? identity.outcome;
  // In Arabic, headline and advice come from the translated set (the engine writes English).
  const isCall = result.type === "call" && !!result.call;
  const C = t.protect.callReport;
  // Calls use call-specific wording in both languages; otherwise Arabic uses the translated set.
  const headline = isCall ? C.headline[level] : ar ? R.headline[level] : (ai.explanation?.summary ?? identity.summary);
  const actions = isCall
    ? (C.actions[level] ?? C.actions.low)
    : ar && R.actions ? R.actions[level] : (ai.explanation?.recommended_actions ?? []);
  const aiNotes = new Map(ai.explanation?.points.map((p) => [p.evidence_id, p.explanation]) ?? []);
  const missing = result.evidence.filter((e) => e.status === "missing");
  const claimed = identity.claimed[0];
  const firstUrl = result.urls[0];

  return (
    <motion.section aria-label={R.aria} className="space-y-6" initial="hidden" animate="show" variants={stagger(0.08)}>
      {result.check_mode === "fixture" && result.urls.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-panel border border-accent/30 bg-accent-cream px-4 py-3 text-small text-accent-strong">
          <strong className="font-semibold">{R.demo.strong}</strong>{R.demo.rest}
        </motion.div>
      )}

      {/* Verdict */}
      <motion.div variants={fadeUp}>
      <Card className="overflow-hidden shadow-[0_24px_60px_-36px_rgba(27,29,36,0.4)]">
        <motion.div
          className={`h-1.5 origin-left rtl:origin-right ${bandBar[level]}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        />
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge level={level} />
              <span className="text-small text-ink-3">
                {R.coverage(score.coverage)}{score.low_confidence && R.notEnough}
              </span>
            </div>
            <h2 className="mt-4 text-[28px] font-extrabold leading-[36px] tracking-[-0.6px] text-ink sm:text-h3">
              {headline}
            </h2>
            {!isCall && (
              <p className={`mt-3 text-lead font-medium ${outcomeTone[identity.outcome]}`}>
                {outcome}
                {!ar && <span className="font-normal text-ink-2"> · {identity.summary}</span>}
              </p>
            )}
          </div>
          <div className="flex justify-center md:justify-end">
            <RiskGauge
              score={score.score}
              level={level}
              noScore={score.band === "Unknown Risk" || score.band === "Inactive Link"}
            />
          </div>
        </div>
        {(score.overrides.length > 0 || score.contradictions.length > 0) && (
          <div className="space-y-1 border-t border-line bg-canvas px-6 py-4 text-small text-ink-2 sm:px-8">
            {score.contradictions.map((c) => (
              <p key={c}>
                <strong className="font-semibold text-risk-moderate">{R.contradiction}</strong> <span dir={ar ? "ltr" : undefined}>{c}</span>
              </p>
            ))}
            {score.overrides.map((o) => (
              <p key={o} dir={ar ? "ltr" : undefined} className={ar ? "text-right" : undefined}>{o}</p>
            ))}
          </div>
        )}
      </Card>
      </motion.div>

      {isCall && (
        <motion.div variants={fadeUp}>
          <CallSummary result={result} />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Identity */}
        <Card className="p-6">
          <Badge>{R.identity.badge}</Badge>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-panel border border-line bg-line text-body">
            {[
              [R.identity.claims, claimed ? claimed.name : R.identity.none],
              [
                R.identity.official,
                claimed ? <Mono key="o">{claimed.official_domains.join(", ")}</Mono> : "—",
              ],
              [R.identity.goesTo, firstUrl ? <Mono key="l">{firstUrl.registrable_domain || firstUrl.host}</Mono> : R.identity.noLink],
              ...(firstUrl?.final_url && new URL(firstUrl.final_url).host !== new URL(firstUrl.url).host
                ? [[R.identity.redirects, <Mono key="r">{new URL(firstUrl.final_url).host}</Mono>]]
                : []),
              [R.identity.result, <span key="res" className={`font-semibold ${outcomeTone[identity.outcome]}`}>{outcome}</span>],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                <dt className="shrink-0 text-ink-3">{k}</dt>
                <dd className="min-w-0 break-all text-end">{v}</dd>
              </div>
            ))}
          </dl>
          {claimed && !claimed.verified && (
            <p className="mt-3 text-small text-ink-3">
              {R.identity.unconfirmed(claimed.name)}
            </p>
          )}
        </Card>

        {/* Score breakdown */}
        <Card className="p-6">
          <Badge>{R.score.badge}</Badge>
          <ul className="mt-4 space-y-4">
            {score.categories
              .filter((c) => c.applicable)
              .map((c, idx) => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span className="font-medium text-ink">
                      {R.categories[c.category] ?? c.label} <span className="font-normal text-ink-3">· {c.weight}%</span>
                    </span>
                    <span className="font-mono text-ink-2" dir="ltr">
                      {c.covered ? `${c.risk}/100` : R.score.notChecked}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
                    {c.covered && (
                      <motion.div
                        className={`h-full origin-left rounded-full rtl:origin-right ${
                          (c.risk ?? 0) >= 50 ? "bg-risk-high" : (c.risk ?? 0) >= 25 ? "bg-risk-moderate" : "bg-risk-low"
                        }`}
                        style={{ width: "100%" }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: Math.max(c.risk ?? 0, 2) / 100 }}
                        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.25 + idx * 0.08 }}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-small text-ink-3" dir={ar ? "ltr" : undefined} style={ar ? { textAlign: "right" } : undefined}>{c.reason}</p>
                </li>
              ))}
          </ul>
        </Card>
      </motion.div>

      {/* Evidence */}
      <motion.div variants={fadeUp}>
      <Card>
        <div className="border-b border-line px-6 py-5">
          <Badge>{R.evidence.badge}</Badge>
          <p className="mt-2 text-small text-ink-3">{R.evidence.hint}</p>
          {ar && R.englishNote && <p className="mt-1 text-small text-ink-3">{R.englishNote}</p>}
        </div>
        {statusGroups.map((g) => {
          const items = result.evidence.filter((e) => e.status === g.status);
          if (!items.length) return null;
          return (
            <div key={g.status} className="border-b border-line last:border-b-0">
              <div className="flex items-center gap-2 bg-canvas px-5 py-2.5">
                <span aria-hidden className={`h-2 w-2 rounded-full ${g.dot}`} />
                <h3 className="text-small font-semibold text-ink">
                  {R.groups[g.status][0]} <span className="font-normal text-ink-3">({items.length})</span>
                </h3>
                <span className="hidden text-small text-ink-3 sm:inline">· {R.groups[g.status][1]}</span>
              </div>
              <motion.ul initial="hidden" animate="show" variants={stagger(0.05, 0.2)}>
                {items.map((e) => (
                  <motion.li key={e.id} variants={fadeUp} className="border-t border-line first:border-t-0">
                    <EvidenceRow e={e} note={aiNotes.get(e.id)} />
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          );
        })}
      </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-2">
        {message && (
          <Card className="p-6">
            <Badge>{isCall ? C.described : R.message}</Badge>
            <div className="mt-4">
              <div dir="auto">
                <HighlightedMessage text={message} evidence={result.evidence} />
              </div>
            </div>
          </Card>
        )}

        <Card highlight className="p-6">
          <h3 className="font-display text-card font-semibold text-accent-strong">{R.todo}</h3>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-body text-accent-strong/90">
            {actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      </motion.div>

      {/* Limitations and disclosures */}
      <motion.div variants={fadeUp}>
      <Card className="p-6">
        <Badge>{R.limits.badge}</Badge>
        <ul className="mt-4 list-disc space-y-1.5 ps-5 text-small text-ink-2">
          <li>{R.limits.notProof}</li>
          {missing.length > 0 && <li>{R.limits.missing(missing.length)}</li>}
          {ai.error && <li>{R.limits.ai(ai.error)}</li>}
          {result.disclosures.length === 0 ? (
            <li>{R.limits.noneShared}</li>
          ) : (
            result.disclosures.map((d) => {
              const [svc, rest] = R.limits.received(d.service, d.received);
              return (
                <li key={d.service}>
                  <span className="font-medium text-ink">{svc}</span>
                  {rest}
                </li>
              );
            })
          )}
          <li>{R.limits.notStored}</li>
        </ul>
      </Card>
      </motion.div>
    </motion.section>
  );
}
