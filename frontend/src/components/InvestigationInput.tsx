import { useState } from "react";
import { Button } from "./ui";

type Tab = "url" | "message" | "screenshot";

const tabs: { id: Tab; label: string }[] = [
  { id: "url", label: "Link" },
  { id: "message", label: "Message" },
  { id: "screenshot", label: "Screenshot" },
];

const MAX_MESSAGE = 5000;

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
    <div className="rounded-card border border-white/10 bg-surface p-2 text-left shadow-[0_24px_60px_-20px_rgba(7,12,23,0.6)]">
      <div role="tablist" aria-label="Investigation type" className="flex gap-1 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-control px-4 py-2 text-[14px] font-semibold transition-colors duration-150 ${
              tab === t.id ? "bg-navy-900 text-white" : "text-ink-2 hover:bg-canvas"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 pt-2">
        {tab === "url" && (
          <label className="block">
            <span className="sr-only">Suspicious link</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example-delivery-fee.com/pay"
              className="w-full rounded-control border border-line bg-canvas px-4 py-3 font-mono text-[15px] outline-none focus:border-accent"
            />
          </label>
        )}

        {tab === "message" && (
          <label className="block">
            <span className="sr-only">Suspicious message</span>
            <textarea
              value={message}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Paste the SMS, WhatsApp or email text you received…"
              className="w-full resize-none rounded-control border border-line bg-canvas px-4 py-3 text-[15px] leading-6 outline-none focus:border-accent"
            />
            <span className="mt-1 block text-right text-[12px] text-ink-3">
              {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
            </span>
          </label>
        )}

        {tab === "screenshot" && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-dashed border-line bg-canvas px-4 py-8 text-center hover:border-accent">
            <span className="text-[15px] font-semibold text-ink">
              {file ? file.name : "Choose a screenshot"}
            </span>
            <span className="text-[13px] text-ink-3">PNG, JPG or WebP, up to 5 MB</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <div className="mt-3 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-[12.5px] leading-5 text-ink-3">
            Nothing you submit is stored. See what's sent where on the{" "}
            <a href="#privacy" className="font-medium text-accent-strong underline underline-offset-2">
              privacy page
            </a>
            .
          </p>
          <Button disabled={!ready} title="The investigation engine arrives in Phase 3">
            Start investigation
          </Button>
        </div>
      </div>
    </div>
  );
}
