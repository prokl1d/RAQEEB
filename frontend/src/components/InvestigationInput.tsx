import { useState } from "react";
import { Button } from "./ui";

type Tab = "url" | "message" | "screenshot";

const tabs: { id: Tab; label: string }[] = [
  { id: "message", label: "Message" },
  { id: "url", label: "Link" },
  { id: "screenshot", label: "Screenshot" },
];

const MAX_MESSAGE = 5000;

const field =
  "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-3 outline-none transition-shadow duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]";

export function InvestigationInput() {
  const [tab, setTab] = useState<Tab>("message");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ready =
    (tab === "url" && url.trim().length > 0) ||
    (tab === "message" && message.trim().length > 0) ||
    (tab === "screenshot" && file !== null);

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
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
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
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border-2 border-dashed border-line-strong bg-canvas px-4 py-10 text-center hover:border-accent">
            <span className="text-body font-semibold text-ink">
              {file ? file.name : "Choose a screenshot"}
            </span>
            <span className="text-small text-ink-3">PNG, JPG or WebP, up to 5 MB</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-small text-ink-3">
            Nothing you submit is stored.{" "}
            <a href="#privacy" className="text-accent underline underline-offset-2 hover:text-accent-strong">
              What's shared and with whom
            </a>
          </p>
          <Button disabled={!ready} arrow title="The investigation engine arrives in Phase 3">
            Start investigation
          </Button>
        </div>
      </div>
    </div>
  );
}
