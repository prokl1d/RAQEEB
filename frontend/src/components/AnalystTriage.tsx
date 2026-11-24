// Analyst triage: paste up to 20 reported links, get them investigated, ranked by risk and grouped
// into campaigns that share infrastructure. Built for AD Police analysts; nothing is stored.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Badge, Button, Container } from "./ui";
import { EASE_OUT, Reveal } from "./motion";
import { investigateBatch, type BatchResult } from "../lib/api";
import { useI18n } from "../lib/i18n";

const SAMPLE = [
  "https://emiratesnbd-secure.co/verify",
  "https://emiratespost-redelivery.com/pay",
  "https://paypal-account-verify.top/login",
  "https://www.dewa.gov.ae/en",
  "https://www.emiratesnbd.com/en",
  "https://www.adpolice.gov.ae/en",
].join("\n");

const PILL: Record<string, string> = {
  "High Risk": "bg-risk-high-bg text-risk-high",
  "Moderate Risk": "bg-risk-moderate-bg text-risk-moderate",
  "Low Risk": "bg-risk-low-bg text-risk-low",
  "Likely Safe": "bg-risk-safe-bg text-risk-safe",
  "Inactive Link": "bg-risk-inactive-bg text-risk-inactive",
  "Unknown Risk": "bg-risk-unknown-bg text-risk-unknown",
};
const CAMP = ["#b45309", "#7c3aed", "#0f766e", "#be123c", "#1d4ed8"];

export function AnalystTriage() {
  const { t } = useI18n();
  const T = t.triage;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<BatchResult | null>(null);
  const links = useMemo(() => text.split(/\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 20), [text]);
  const colour = (id: string | null) => (id ? CAMP[(id.charCodeAt(0) - 65) % CAMP.length] : undefined);

  async function run() {
    if (!links.length) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await investigateBatch(links));
    } catch {
      setErr(T.error);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!res) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: "raqeeb-triage/1", ...res }, null, 2)], { type: "application/json" }));
    a.download = `RAQEEB-triage-${res.generated_utc.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <section id="triage" className="scroll-mt-28 border-b border-line bg-surface py-24 sm:py-32">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <Reveal><Badge>{T.badge}</Badge></Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 text-balance font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">{T.title}</h2>
            </Reveal>
            <Reveal delay={0.1}><p className="mt-5 max-w-[560px] text-lead text-ink-2">{T.body}</p></Reveal>
          </div>
          <Reveal delay={0.12}>
            <div className="rounded-card border border-line bg-canvas p-5 sm:p-6">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir="ltr"
                rows={7}
                placeholder={T.placeholder}
                className="w-full resize-y rounded-control border border-line-strong bg-surface px-4 py-3 font-mono text-small text-ink outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setText(SAMPLE)} className="cursor-pointer text-small text-accent underline-offset-4 hover:underline">{T.sample}</button>
                <div className="flex items-center gap-3">
                  <span className="text-small text-ink-3 tabular-nums">{links.length}/20</span>
                  <Button onClick={run} disabled={busy || !links.length} arrow={!busy}>{busy ? T.running : T.run}</Button>
                </div>
              </div>
              {err && <p role="alert" className="mt-3 text-small text-risk-high">{err}</p>}
            </div>
          </Reveal>
        </div>

        <AnimatePresence>
          {res && (
            <motion.div key={res.generated_utc} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }} className="mt-12 overflow-hidden rounded-[20px] border border-line bg-canvas">
              <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{res.campaigns.length ? T.campaigns(res.campaigns.length) : T.noCampaign}</p>
                  {res.campaigns.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: colour(c.id) }}>
                      {c.id} · {c.members.length}
                    </span>
                  ))}
                </div>
                <button onClick={download} className="inline-flex min-h-9 cursor-pointer items-center self-start rounded-control border border-accent/50 px-3 text-small font-medium text-accent hover:bg-accent-cream">{T.export}</button>
              </div>
              {res.campaigns.length > 0 && (
                <div className="space-y-1 border-b border-line bg-accent-cream px-5 py-3 text-small text-accent-strong sm:px-6">
                  {res.campaigns.map((c) => (
                    <p key={c.id}><span className="font-semibold" style={{ color: colour(c.id) }}>{c.id}</span> · {T.linkedBy}: <span dir="ltr">{c.links.join("; ")}</span></p>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-start text-small">
                  <thead>
                    <tr className="border-b border-line text-ink-3">
                      {[T.cols.risk, T.cols.link, T.cols.why, T.cols.registrar, T.cols.campaign].map((h) => (
                        <th key={h} className="px-5 py-3 text-start font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <motion.tbody initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
                    {res.items.map((it) => (
                      <motion.tr key={it.url} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="border-b border-line align-top last:border-0">
                        <td className="px-5 py-3">
                          {it.verdict ? (
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-control px-2 py-1 font-medium ${PILL[it.verdict] ?? ""}`}>
                              {t.risk[{ "High Risk": "high", "Moderate Risk": "moderate", "Low Risk": "low", "Likely Safe": "safe", "Inactive Link": "inactive", "Unknown Risk": "unknown" }[it.verdict] as keyof typeof t.risk] ?? it.verdict}
                              <span className="tabular-nums opacity-70">{it.score}</span>
                            </span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        <td className="max-w-[260px] px-5 py-3"><span dir="ltr" className="break-all font-mono text-ink">{it.domain || it.url}</span></td>
                        <td className="max-w-[340px] px-5 py-3 text-ink-2">{it.error ?? it.top_reasons[0] ?? "—"}</td>
                        <td className="px-5 py-3 text-ink-2">
                          {it.registrar ?? "—"}
                          {it.abuse_email && <span dir="ltr" className="block font-mono text-[12px] text-ink-3">{it.abuse_email}</span>}
                        </td>
                        <td className="px-5 py-3">
                          {it.campaign ? (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: colour(it.campaign) }}>{it.campaign}</span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </section>
  );
}
