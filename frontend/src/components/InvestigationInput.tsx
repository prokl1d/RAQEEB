import { useState } from "react";
import type { InvestigateRequest } from "../lib/api";
import { Button } from "./ui";

type Tab = "url" | "message" | "screenshot";

const tabs: { id: Tab; label: string }[] = [
  { id: "message", label: "Message" },
  { id: "url", label: "Link" },
  { id: "screenshot", label: "Screenshot" },
];

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
    value: "DEWA: your November bill is ready. View it at https://www.dewa.gov.ae/en/consumer/billing",
  },
];

const field =
  "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-3 outline-none transition-shadow duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]";

export function InvestigationInput({
  onSubmit,
  busy,
}: {
  onSubmit: (req: InvestigateRequest) => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<Tab>("message");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ready =
    (tab === "url" && url.trim().length > 0) || (tab === "message" && message.trim().length > 0);

  function submit() {
    if (!ready || busy) return;
    onSubmit(tab === "url" ? { type: "url", url } : { type: "message", message });
  }

  return (
    <div className="rounded-card border border-line bg-surface text-left">
      {/* Underline tabs */}
      <div role="tablist" aria-label="Investigation type" className="flex gap-6 border-b border-line px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-[3px] py-4 text-body font-semibold transition-colors duration-200 ${
              tab === t.id ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t.label}
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
        {tab === "message" && (
          <label className="block">
            <span className="mb-2 block text-small font-medium text-ink">Message text</span>
            <textarea
              value={message}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Paste the SMS, WhatsApp or email text you received…"
              className={`${field} resize-none`}
            />
            <span className="mt-1 block text-right text-badge text-ink-3">
              {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
            </span>
          </label>
        )}

        {tab === "url" && (
          <label className="block">
            <span className="mb-2 block text-small font-medium text-ink">Suspicious link</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example-delivery-fee.com/pay"
              className={`${field} font-mono`}
            />
          </label>
        )}

        {tab === "screenshot" && (
          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border-2 border-dashed border-line-strong bg-canvas px-4 py-10 text-center hover:border-accent">
              <span className="text-body font-semibold text-ink">{file ? file.name : "Choose a screenshot"}</span>
              <span className="text-small text-ink-3">PNG, JPG or WebP, up to 5 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-small text-ink-3">
              Screenshot investigations are coming soon. For now, copy the text into the Message tab.
            </p>
          </div>
        )}

        {tab !== "screenshot" && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-small text-ink-3">Try an example:</span>
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex.label}
                onClick={() => {
                  setTab(ex.tab);
                  if (ex.tab === "url") setUrl(ex.value);
                  else setMessage(ex.value);
                }}
                className="rounded-control border border-line px-2.5 py-1 text-small text-ink-2 hover:border-accent hover:text-accent"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-small text-ink-3">
            Nothing you submit is stored.{" "}
            <a href="#privacy" className="text-accent underline underline-offset-2 hover:text-accent-strong">
              What's shared and with whom
            </a>
          </p>
          <Button type="submit" disabled={!ready || busy} arrow={!busy}>
            {busy ? "Investigating…" : "Start investigation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
