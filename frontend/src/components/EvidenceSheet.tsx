// "Report to AD Police": turns an investigation into a clean evidence sheet the person can print,
// save as PDF, copy, or send to the Aman service (800 2626 / SMS 2828).
// Generated on the device; nothing is stored or sent. It is clearly NOT a police document.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./motion";
import type { InvestigationResult } from "../lib/api";
import { useI18n } from "../lib/i18n";

const LEVEL: Record<string, "safe" | "low" | "inactive" | "moderate" | "high" | "unknown"> = {
  "Likely Safe": "safe",
  "Low Risk": "low",
  "Inactive Link": "inactive",
  "Moderate Risk": "moderate",
  "High Risk": "high",
  "Unknown Risk": "unknown",
};
const BAND_COLOR: Record<string, string> = {
  safe: "#065f46", low: "#047857", inactive: "#3f5873", moderate: "#c2410c", high: "#b91c1c", unknown: "#4b4840",
};

function reference(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return `RQB-${ymd}-${r[0].toString(36).toUpperCase().slice(-5).padStart(5, "0")}`;
}

export function EvidenceSheet({ result, message, onClose }: { result: InvestigationResult; message?: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const P = t.tools.pack;
  const C = t.protect.callReport;
  const reduce = useReducedMotion();
  const [withMessage, setWithMessage] = useState(true);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const ref = useMemo(reference, []);
  const prepared = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ar" ? "ar-AE" : "en-AE", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date()),
    [lang],
  );
  const level = LEVEL[result.score.band] ?? "unknown";
  const flags = result.evidence.filter((e) => e.status === "confirmed" || e.status === "suspicious" || e.status === "contradictory");
  const claimed = result.identity.claimed;
  const contacts = result.call?.contacts ?? claimed.map((c) => ({ org_id: c.id, org_name: c.name, phones: [] as string[], domains: c.official_domains, source: null }));
  const links = result.urls.map((u) => ({
    from: u.registrable_domain || u.host,
    to: u.final_url ? new URL(u.final_url).host : null,
    url: u.url,
  }));

  // Focus, Escape to close, and no page scrolling underneath.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);

  const plain = useMemo(() => {
    const L: string[] = [];
    L.push(`${t.brand.name} · ${P.title}`, `${P.ref}: ${ref}`, `${P.prepared}: ${prepared}`, "");
    L.push(`${P.verdict}: ${t.risk[level]} · ${P.score(result.score.score)}`);
    L.push(`${P.what}: ${P.kinds[result.type] ?? result.type}`);
    L.push(`${P.claimed}: ${claimed.length ? claimed.map((c) => c.name).join(", ") : P.none}`);
    if (links.length) L.push(`${P.links}: ${links.map((l) => l.from + (l.to && l.to !== l.from ? ` → ${l.to}` : "")).join("; ")}`);
    if (result.call?.asked_for.length) L.push(`${P.asked}: ${result.call.asked_for.map((k) => C.rules[k] ?? k).join(", ")}`);
    if (result.call?.pressure.length) L.push(`${P.pressure}: ${result.call.pressure.map((k) => C.rules[k] ?? k).join(", ")}`);
    L.push("", `${P.flags}:`);
    L.push(...(flags.length ? flags.map((f) => `- ${f.finding}`) : [P.noFlags]));
    if (withMessage && message) L.push("", `${P.message}:`, message);
    L.push("", P.aman, "", P.disclaimer);
    return L.join("\n");
  }, [P, C, ref, prepared, t, level, result, claimed, links, flags, withMessage, message]);

  const sms = `RAQEEB ${ref}: ${P.kinds[result.type] ?? result.type}${claimed.length ? ` · ${P.claimed} ${claimed[0].name}` : ""}${links[0] ? ` · ${links[0].from}` : ""} · ${t.risk[level]} ${result.score.score}/100`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  const row = "sheet-row grid gap-1 border-b border-[#e8e1d4] py-3 sm:grid-cols-[180px_1fr] sm:gap-4";
  const key = "text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8c6b2a]";

  return createPortal(
    <div className="raqeeb-print-root fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-8" data-lenis-prevent role="dialog" aria-modal="true" aria-label={P.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="print-sheet w-full max-w-[820px]"
      >
        {/* Toolbar (not printed) */}
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-[#d9b76e] px-4 text-small font-semibold text-[#1a1408] hover:bg-[#e8ca88]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            {P.print}
          </button>
          <button onClick={copy} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-white/15 px-4 text-small font-semibold text-white hover:bg-white/25">
            {copied ? P.copied : P.copy}
          </button>
          <a href="tel:8002626" className="inline-flex min-h-10 items-center rounded-control bg-white/15 px-4 text-small font-semibold text-white hover:bg-white/25">{P.call}</a>
          <a href={`sms:2828?&body=${encodeURIComponent(sms)}`} className="inline-flex min-h-10 items-center rounded-control bg-white/15 px-4 text-small font-semibold text-white hover:bg-white/25">{P.sms}</a>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 px-1 text-small text-white/85">
            <input type="checkbox" checked={withMessage} onChange={(e) => setWithMessage(e.target.checked)} className="h-4 w-4 accent-[#d9b76e]" />
            {P.includeMessage}
          </label>
          <button ref={closeRef} onClick={onClose} aria-label={P.close} title={P.close} className="ms-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* The sheet: always paper-white, also in dark mode and when printed */}
        <article className="overflow-hidden rounded-[16px] bg-[#fffdf9] text-[#16161a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)]">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-[#d9b76e] bg-[#16161a] px-6 py-5 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#d9b76e]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d9b76e" strokeWidth="2.2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </span>
              <div>
                <p className={lang === "ar" ? "font-['Noto_Kufi_Arabic'] text-[22px] font-bold" : "font-display text-[20px] font-extrabold tracking-[0.04em]"}>{t.brand.name}</p>
                <p className="text-small text-[#ecd6a3]">{P.title}</p>
              </div>
            </div>
            <div className="text-end text-small">
              <p><span className="text-white/60">{P.ref}: </span><span dir="ltr" className="font-mono font-semibold">{ref}</span></p>
              <p className="text-white/60">{P.prepared}: {prepared}</p>
            </div>
          </header>

          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border-2 p-4" style={{ borderColor: BAND_COLOR[level] }}>
              <div>
                <p className={key}>{P.verdict}</p>
                <p className="mt-1 font-display text-[26px] font-extrabold" style={{ color: BAND_COLOR[level] }}>{t.risk[level]}</p>
              </div>
              <div className="text-end">
                <p dir="ltr" className="font-display text-[34px] font-extrabold leading-none">{result.score.score}<span className="text-[16px] text-[#75716a]">/100</span></p>
                <p className="mt-1 text-small text-[#75716a]">{P.coverage(result.score.coverage)}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className={row}><p className={key}>{P.what}</p><p>{P.kinds[result.type] ?? result.type}</p></div>
              <div className={row}><p className={key}>{P.claimed}</p><p>{claimed.length ? claimed.map((c) => c.name).join(", ") : P.none}</p></div>
              {links.length > 0 && (
                <div className={row}>
                  <p className={key}>{P.links}</p>
                  <ul className="space-y-1">
                    {links.map((l) => (
                      <li key={l.url} dir="ltr" className="break-all text-start font-mono text-[14px]">
                        {l.from}
                        {l.to && l.to !== l.from && <span className="text-[#b91c1c]"> → {l.to}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.call && result.call.asked_for.length > 0 && (
                <div className={row}><p className={key}>{P.asked}</p><p>{result.call.asked_for.map((k) => C.rules[k] ?? k).join(" · ")}</p></div>
              )}
              {result.call && result.call.pressure.length > 0 && (
                <div className={row}><p className={key}>{P.pressure}</p><p>{result.call.pressure.map((k) => C.rules[k] ?? k).join(" · ")}</p></div>
              )}
              <div className={row}>
                <p className={key}>{P.flags}</p>
                <div>
                  {flags.length ? (
                    <ol className="list-decimal space-y-1.5 ps-5 text-[14px]" dir={lang === "ar" ? "ltr" : undefined} style={lang === "ar" ? { textAlign: "left" } : undefined}>
                      {flags.map((f) => <li key={f.id}>{f.finding}</li>)}
                    </ol>
                  ) : (
                    <p>{P.noFlags}</p>
                  )}
                  {lang === "ar" && P.englishNote && flags.length > 0 && <p className="mt-2 text-[12px] text-[#75716a]">{P.englishNote}</p>}
                </div>
              </div>
              {withMessage && message && (
                <div className={row}>
                  <p className={key}>{P.message}</p>
                  <p dir="auto" className="whitespace-pre-wrap break-words rounded-[10px] bg-[#f8f5ef] p-3 text-[14px] leading-6">{message}</p>
                </div>
              )}
              <div className={row}>
                <p className={key}>{P.contacts}</p>
                <div className="space-y-1 text-[14px]">
                  {contacts.map((c) => (
                    <p key={c.org_id}>
                      {c.org_name}
                      {c.phones.length > 0 && <> · <span dir="ltr" className="font-mono">{c.phones.join(" / ")}</span></>}
                      {c.domains.length > 0 && <> · <span dir="ltr" className="font-mono">{c.domains.join(", ")}</span></>}
                    </p>
                  ))}
                  <p className="font-semibold">{P.aman}</p>
                </div>
              </div>
            </div>

            <footer className="mt-6 space-y-1 border-t border-[#e8e1d4] pt-4 text-[12px] leading-5 text-[#75716a]">
              <p>{P.disclaimer}</p>
              <p>{P.privacy}</p>
            </footer>
          </div>
        </article>
      </motion.div>
    </div>,
    document.body,
  );
}
