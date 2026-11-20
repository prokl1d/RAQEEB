import { useState } from "react";
import type { Evidence, EvidenceStatus, InvestigationResult, RiskBand } from "../lib/api";
import { Badge, Card, Mono, RiskBadge, type RiskLevel } from "./ui";

const bandLevel: Record<RiskBand, RiskLevel> = {
  "Low Risk": "low",
  "Moderate Risk": "moderate",
  "High Risk": "high",
  "Unknown Risk": "unknown",
};

const bandBar: Record<RiskLevel, string> = {
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

const statusGroups: { status: EvidenceStatus; title: string; dot: string; hint: string }[] = [
  { status: "confirmed", title: "Confirmed malicious", dot: "bg-risk-high", hint: "Independent sources say this is malicious." },
  { status: "contradictory", title: "Contradictory", dot: "bg-risk-moderate", hint: "Findings that disagree with each other." },
  { status: "suspicious", title: "Suspicious indicators", dot: "bg-risk-moderate", hint: "Warning signs. Each one alone is not proof." },
  { status: "verified", title: "Verified information", dot: "bg-risk-low", hint: "Confirmed by an authoritative source." },
  { status: "unverified", title: "Unverified or weak signals", dot: "bg-ink-3", hint: "Information that couldn't be confirmed, or that carries little weight." },
  { status: "missing", title: "Missing information", dot: "bg-line-strong", hint: "Checks that didn't run. These never count as clean." },
];

const categoryLabel: Record<string, string> = {
  threat_intel: "Threat intelligence",
  identity: "Identity",
  url_domain: "Domain and URL",
  content: "Message",
  context: "Context",
};

function EvidenceRow({ e, note }: { e: Evidence; note?: string }) {
  const [open, setOpen] = useState(false);
  const technical = Object.entries(e.raw).filter(([k]) => !["start", "end"].includes(k));
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-canvas"
      >
        <span>
          <span className="block text-body font-medium text-ink">{e.finding}</span>
          <span className="mt-1 block text-small text-ink-2">{note ?? e.why_it_matters}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="hidden rounded-control bg-canvas px-1.5 py-0.5 text-badge text-ink-3 sm:inline">
            {categoryLabel[e.category]}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={`text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}>
            <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="space-y-2 px-5 pb-4 text-small text-ink-2">
          <p>
            <span className="font-medium text-ink">Source:</span> {e.source}
          </p>
          {technical.length > 0 && (
            <pre className="overflow-x-auto rounded-panel border border-line bg-canvas p-3 font-mono text-[12px] leading-5 text-ink-2">
              {JSON.stringify(Object.fromEntries(technical), null, 2)}
            </pre>
          )}
        </div>
      )}
    </li>
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

export function Report({ result, message }: { result: InvestigationResult; message?: string }) {
  const { score, identity, ai } = result;
  const level = bandLevel[score.band];
  const aiNotes = new Map(ai.explanation?.points.map((p) => [p.evidence_id, p.explanation]) ?? []);
  const missing = result.evidence.filter((e) => e.status === "missing");
  const claimed = identity.claimed[0];
  const firstUrl = result.urls[0];

  return (
    <section aria-label="Investigation report" className="space-y-6">
      {result.check_mode === "fixture" && (
        <div className="rounded-panel border border-accent/30 bg-accent-cream px-4 py-3 text-small text-accent-strong">
          <strong className="font-semibold">Demo mode:</strong> network and threat-intelligence results below are
          recorded demo fixtures, not live results.
        </div>
      )}

      {/* Verdict */}
      <Card className="overflow-hidden">
        <div className={`h-1.5 ${bandBar[level]}`} />
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge level={level} />
              <span className="text-small text-ink-3">
                Evidence coverage {score.coverage}%{score.low_confidence && " · not enough evidence for a verdict"}
              </span>
            </div>
            <h2 className="mt-4 text-[28px] font-extrabold leading-[36px] tracking-[-0.6px] text-ink sm:text-h3">
              {ai.explanation?.summary ?? identity.summary}
            </h2>
            <p className={`mt-3 text-lead font-medium ${outcomeTone[identity.outcome]}`}>
              {identity.outcome}
              <span className="font-normal text-ink-2"> · {identity.summary}</span>
            </p>
          </div>
          <div className="flex items-baseline gap-1 md:flex-col md:items-end">
            <span className="font-display text-[56px] font-extrabold leading-none tracking-[-2px] text-ink">
              {score.band === "Unknown Risk" ? "?" : score.score}
            </span>
            <span className="text-small text-ink-3">/ 100 risk score</span>
          </div>
        </div>
        {(score.overrides.length > 0 || score.contradictions.length > 0) && (
          <div className="space-y-1 border-t border-line bg-canvas px-6 py-4 text-small text-ink-2 sm:px-8">
            {score.contradictions.map((c) => (
              <p key={c}>
                <strong className="font-semibold text-risk-moderate">Contradiction:</strong> {c}
              </p>
            ))}
            {score.overrides.map((o) => (
              <p key={o}>{o}</p>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Identity */}
        <Card className="p-6">
          <Badge>Organization identity</Badge>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-panel border border-line bg-line text-body">
            {[
              ["Claims to be", claimed ? claimed.name : "No known organization identified"],
              [
                "Official domain",
                claimed ? <Mono key="o">{claimed.official_domains.join(", ")}</Mono> : "—",
              ],
              ["Link goes to", firstUrl ? <Mono key="l">{firstUrl.registrable_domain || firstUrl.host}</Mono> : "No link found"],
              ...(firstUrl?.final_url && firstUrl.final_url !== firstUrl.url
                ? [["Redirects to", <Mono key="r">{new URL(firstUrl.final_url).host}</Mono>]]
                : []),
              ["Result", <span key="res" className={`font-semibold ${outcomeTone[identity.outcome]}`}>{identity.outcome}</span>],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                <dt className="shrink-0 text-ink-3">{k}</dt>
                <dd className="min-w-0 break-all text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {claimed && !claimed.verified && (
            <p className="mt-3 text-small text-ink-3">
              {claimed.name}'s domain in RAQEEB's registry is not yet confirmed by an authoritative source.
            </p>
          )}
        </Card>

        {/* Score breakdown */}
        <Card className="p-6">
          <Badge>How the score was built</Badge>
          <ul className="mt-4 space-y-4">
            {score.categories
              .filter((c) => c.applicable)
              .map((c) => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span className="font-medium text-ink">
                      {c.label} <span className="font-normal text-ink-3">· {c.weight}%</span>
                    </span>
                    <span className="font-mono text-ink-2">
                      {c.covered ? `${c.risk}/100` : "not checked"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
                    {c.covered && (
                      <div
                        className={`h-full rounded-full ${
                          (c.risk ?? 0) >= 50 ? "bg-risk-high" : (c.risk ?? 0) >= 25 ? "bg-risk-moderate" : "bg-risk-low"
                        }`}
                        style={{ width: `${Math.max(c.risk ?? 0, 2)}%` }}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-small text-ink-3">{c.reason}</p>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {/* Evidence */}
      <Card>
        <div className="border-b border-line px-6 py-5">
          <Badge>Evidence</Badge>
          <p className="mt-2 text-small text-ink-3">Tap a finding to see its source and technical details.</p>
        </div>
        {statusGroups.map((g) => {
          const items = result.evidence.filter((e) => e.status === g.status);
          if (!items.length) return null;
          return (
            <div key={g.status} className="border-b border-line last:border-b-0">
              <div className="flex items-center gap-2 bg-canvas px-5 py-2.5">
                <span aria-hidden className={`h-2 w-2 rounded-full ${g.dot}`} />
                <h3 className="text-small font-semibold text-ink">
                  {g.title} <span className="font-normal text-ink-3">({items.length})</span>
                </h3>
                <span className="hidden text-small text-ink-3 sm:inline">· {g.hint}</span>
              </div>
              <ul>
                {items.map((e) => (
                  <EvidenceRow key={e.id} e={e} note={aiNotes.get(e.id)} />
                ))}
              </ul>
            </div>
          );
        })}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {message && (
          <Card className="p-6">
            <Badge>The message, with red flags highlighted</Badge>
            <div className="mt-4">
              <HighlightedMessage text={message} evidence={result.evidence} />
            </div>
          </Card>
        )}

        <Card highlight className="p-6">
          <h3 className="font-display text-card font-semibold text-accent-strong">What to do</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-accent-strong/90">
            {(ai.explanation?.recommended_actions ?? []).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Limitations and disclosures */}
      <Card className="p-6">
        <Badge>Limitations and privacy</Badge>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-small text-ink-2">
          <li>RAQEEB's score is a risk assessment, not proof. No investigation can guarantee something is safe.</li>
          {missing.length > 0 && <li>{missing.length} check(s) could not run and were not counted as clean.</li>}
          {ai.error && <li>AI explanation: {ai.error}.</li>}
          {result.disclosures.length === 0 ? (
            <li>No outside service received your submission for this investigation.</li>
          ) : (
            result.disclosures.map((d) => (
              <li key={d.service}>
                <span className="font-medium text-ink">{d.service}</span> received {d.received}.
              </li>
            ))
          )}
          <li>Nothing you submitted was stored.</li>
        </ul>
      </Card>
    </section>
  );
}
