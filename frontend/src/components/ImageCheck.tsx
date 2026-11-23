// "Image" tab: a screenshot or a QR code, read entirely on the user's device.
// Order: QR code first (instant), otherwise on-device OCR (English + Arabic).
// The result (a link or editable text) is handed to the investigation form; the image itself
// is never uploaded anywhere.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./motion";
import { classifyQr, decodeQr, decodeQrFrom, readText, validateImage } from "../lib/imageScan";
import type { InvestigateRequest } from "../lib/api";
import { useI18n } from "../lib/i18n";

type Phase =
  | { k: "idle" }
  | { k: "qr" }
  | { k: "ocr"; p: number }
  | { k: "url"; url: string }
  | { k: "text"; text: string; fromQr: boolean }
  | { k: "empty" }
  | { k: "error"; msg: string };

const field =
  "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-3 outline-none transition-shadow duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(146,114,42,0.3)]";

export function ImageCheck({ onRequest }: { onRequest: (r: InvestigateRequest | null) => void }) {
  const { t } = useI18n();
  const I = t.tools.image;
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [camera, setCamera] = useState(false);
  const [camErr, setCamErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const job = useRef(0);

  // Tell the form what can be investigated right now.
  useEffect(() => {
    if (phase.k === "url") onRequest({ type: "url", url: phase.url });
    else if (phase.k === "text" && phase.text.trim()) onRequest({ type: "message", message: phase.text });
    else onRequest(null);
  }, [phase, onRequest]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const handle = useCallback(
    async (file: File) => {
      const bad = validateImage(file);
      if (bad) return setPhase({ k: "error", msg: bad === "type" ? I.badType : I.badSize });
      const id = ++job.current;
      setPreview(URL.createObjectURL(file));
      setPhase({ k: "qr" });
      try {
        const qr = await decodeQr(file);
        if (id !== job.current) return;
        if (qr) {
          const c = classifyQr(qr);
          return setPhase(c.kind === "url" ? { k: "url", url: c.url } : { k: "text", text: c.text, fromQr: true });
        }
        setPhase({ k: "ocr", p: 0 });
        const text = await readText(file, (p) => id === job.current && setPhase({ k: "ocr", p }));
        if (id !== job.current) return;
        setPhase(text ? { k: "text", text, fromQr: false } : { k: "empty" });
      } catch {
        if (id === job.current) setPhase({ k: "error", msg: I.failed });
      }
    },
    [I],
  );

  // Paste an image from the clipboard while this tab is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        handle(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handle]);

  // Live camera QR scanning.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = (now: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (now - last < 220 || !v.videoWidth) return;
          last = now;
          const found = decodeQrFrom(v, v.videoWidth, v.videoHeight);
          if (found) {
            stopped = true;
            const c = classifyQr(found);
            setPhase(c.kind === "url" ? { k: "url", url: c.url } : { k: "text", text: c.text, fromQr: true });
            setCamera(false);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamErr(true);
        setCamera(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [camera]);

  function reset() {
    job.current++;
    setPhase({ k: "idle" });
    setPreview(null);
  }

  const busy = phase.k === "qr" || phase.k === "ocr";
  const pct = phase.k === "ocr" ? Math.round(phase.p * 100) : 0;

  return (
    <div>
      {camera ? (
        <div className="relative overflow-hidden rounded-panel border border-accent/40 bg-black">
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-40 w-40 rounded-[18px] border-2 border-[#d9b76e]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              {!reduce && (
                <motion.span
                  className="absolute inset-x-2 h-0.5 rounded-full bg-[#d9b76e] shadow-[0_0_12px_#d9b76e]"
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-3">
            <span className="text-small text-white/80">{I.cameraHint}</span>
            <button type="button" onClick={() => setCamera(false)} className="min-h-9 cursor-pointer rounded-control bg-white/15 px-3 text-small font-semibold text-white hover:bg-white/25">
              {I.cameraStop}
            </button>
          </div>
        </div>
      ) : phase.k === "idle" || phase.k === "error" ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handle(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed px-4 py-9 text-center transition-colors duration-200 ${
            drag ? "border-accent bg-accent-cream" : "border-line-strong bg-canvas hover:border-accent"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-accent-cream text-accent" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
            </svg>
          </span>
          <span className="text-body font-semibold text-ink">{I.drop}</span>
          <span className="text-small text-ink-3">{I.or}</span>
          <span className="text-badge text-ink-3">{I.types}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          {preview && (
            <div className="relative overflow-hidden rounded-panel border border-line bg-canvas">
              <img src={preview} alt="" className="h-36 w-full object-cover sm:h-full" />
              {busy && !reduce && (
                <motion.span
                  aria-hidden
                  className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-accent/35 to-transparent"
                  animate={{ top: ["-20%", "100%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
          )}
          <div className="min-w-0" aria-live="polite">
            {phase.k === "qr" && <p className="text-small font-medium text-ink">{I.qrSearch}</p>}
            {phase.k === "ocr" && (
              <div>
                <p className="text-small font-medium text-ink">{pct < 30 ? I.loading : I.reading(pct)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
                  <motion.div className="h-full origin-left rounded-full bg-accent rtl:origin-right" animate={{ scaleX: Math.max(0.04, phase.p) }} transition={{ duration: 0.4, ease: EASE_OUT }} />
                </div>
              </div>
            )}
            {phase.k === "url" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-small font-medium text-ink">{I.qrUrl}</p>
                <p dir="ltr" className="mt-2 break-all rounded-control border border-accent/40 bg-accent-cream px-3 py-2 text-start font-mono text-small text-accent-strong">{phase.url}</p>
              </motion.div>
            )}
            {phase.k === "text" && (
              <motion.label className="block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <span className="mb-2 block text-small font-medium text-ink">{phase.fromQr ? I.qrText : I.textLabel}</span>
                <textarea
                  value={phase.text}
                  dir="auto"
                  rows={5}
                  maxLength={5000}
                  onChange={(e) => setPhase({ k: "text", text: e.target.value, fromQr: phase.fromQr })}
                  className={`${field} resize-none`}
                />
              </motion.label>
            )}
            {phase.k === "empty" && <p className="text-small text-risk-moderate">{I.noText}</p>}
            {!busy && (
              <button type="button" onClick={reset} className="mt-3 cursor-pointer text-small text-accent underline underline-offset-2 hover:text-accent-strong">
                {I.another}
              </button>
            )}
          </div>
        </div>
      )}

      {phase.k === "error" && <p role="alert" className="mt-2 text-small text-risk-high">{phase.msg}</p>}
      {camErr && !camera && <p role="alert" className="mt-2 text-small text-risk-moderate">{I.cameraDenied}</p>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!camera && (
          <button
            type="button"
            onClick={() => {
              reset();
              setCamErr(false);
              setCamera(true);
            }}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-control border border-line px-3 text-small font-medium text-ink-2 transition-colors duration-200 hover:border-accent hover:text-accent-strong"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            {I.camera}
          </button>
        )}
        <p className="flex items-start gap-2 text-small text-ink-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-1 shrink-0 text-accent" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {I.privacy}
        </p>
      </div>
    </div>
  );
}
