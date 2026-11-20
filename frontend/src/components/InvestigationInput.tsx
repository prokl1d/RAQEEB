import { useState } from "react";
import { motion } from "motion/react";
import { EASE_OUT } from "./motion";
import type { InvestigateRequest } from "../lib/api";
import { Button } from "./ui";
import { useI18n } from "../lib/i18n";

type Tab = "url" | "message" | "screenshot";

const tabs: Tab[] = ["message", "url", "screenshot"];

const MAX_MESSAGE = 5000;

/** The three demo scenarios (docs/PLAN.md section 18). Domains are fictional except dewa.gov.ae. */
export const EXAMPLES: { label: string; tab: Tab; value: string }[] = [
  {
    label: "Bank impersonation",
    tab: "message",
    value:
      "URGENT: Emirates NBD has suspended your card due to unusual activity. Verify your details within 24 hours at https://emiratesnbd-secure.co/verify and enter the OTP we send you, or your account will be closed.",
  },
  {
    label: "Delivery fee",
    tab: "message",
    value:
      "Emirates Post: your parcel is on hold at our warehouse. Pay the AED 4.50 redelivery fee today to release it: https://emiratespost-redelivery.com/pay",
  },
  {
    label: "Legitimate-looking",
    tab: "message",
    value: "DEWA: your November bill is ready. View it at https://www.dewa.gov.ae/en",
  },
];

const field =
  "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-3 outline-none transition-shadow duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]";

export function InvestigationInput({
  onSubmit,
  busy,
  initial,
}: {
  onSubmit: (req: InvestigateRequest) => void;
  busy: boolean;
  initial?: InvestigateRequest | null;
}) {
  const [tab, setTab] = useState<Tab>(initial?.type ?? "message");
  const [url, setUrl] = useState(initial?.type === "url" ? initial.url : "");
  const [message, setMessage] = useState(initial?.type === "message" ? initial.message : "");
  const [file, setFile] = useState<File | null>(null);
  const { t } = useI18n();
  const L = t.input;

  const ready =
    (tab === "url" && url.trim().length > 0) || (tab === "message" && message.trim().length > 0);

  function submit() {
    if (!ready || busy) return;
    onSubmit(tab === "url" ? { type: "url", url } : { type: "message", message });
  }

  return (
    <div className="rounded-card border border-line bg-surface text-start shadow-[0_24px_60px_-36px_rgba(27,29,36,0.35)] transition-shadow duration-300 focus-within:shadow-[0_28px_70px_-34px_rgba(146,114,42,0.45)]">
      {/* Underline tabs */}
      <div role="tablist" aria-label={L.tablist} className="flex gap-6 border-b border-line px-6">
        {tabs.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative -mb-px min-h-11 cursor-pointer py-4 text-body font-semibold transition-colors duration-200 ${
              tab === id ? "text-ink" : "text-ink-3 hover:text-ink"
            }`}
          >
            {L.tabs[id]}
            {tab === id && (
              <motion.span
                layoutId="tab-underline"
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
        {tab === "message" && (
          <label className="block">
            <span className="mb-2 block text-small font-medium text-ink">{L.messageLabel}</span>
            <textarea
              value={message}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={L.messagePh}
              className={`${field} resize-none`}
            />
            <span className="mt-1 block text-end text-badge text-ink-3">
              {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
            </span>
          </label>
        )}

        {tab === "url" && (
          <label className="block">
            <span className="mb-2 block text-small font-medium text-ink">{L.linkLabel}</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example-delivery-fee.com/pay"
              dir="ltr"
              className={`${field} font-mono`}
            />
          </label>
        )}

        {tab === "screenshot" && (
          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border-2 border-dashed border-line-strong bg-canvas px-4 py-10 text-center hover:border-accent">
              <span className="text-body font-semibold text-ink">{file ? file.name : L.chooseShot}</span>
              <span className="text-small text-ink-3">{L.shotTypes}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-small text-ink-3">
              {L.shotSoon}
            </p>
          </div>
        )}
        </motion.div>

        {tab !== "screenshot" && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-small text-ink-3">{L.tryExample}</span>
            {EXAMPLES.map((ex, i) => (
              <button
                type="button"
                key={ex.label}
                onClick={() => {
                  setTab(ex.tab);
                  if (ex.tab === "url") setUrl(ex.value);
                  else setMessage(ex.value);
                }}
                className="min-h-9 cursor-pointer rounded-control border border-line px-2.5 py-1 text-small text-ink-2 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-accent hover:bg-accent-cream hover:text-accent-strong active:translate-y-0"
              >
                {L.examples[i]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-small text-ink-3">
            {L.notStored}{" "}
            <a href="#privacy" className="text-accent underline underline-offset-2 hover:text-accent-strong">
              {L.shared}
            </a>
          </p>
          <Button type="submit" disabled={!ready || busy} arrow={!busy}>
            {busy ? L.busy : L.start}
          </Button>
        </div>
      </form>
    </div>
  );
}
