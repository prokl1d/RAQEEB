import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GsapSplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { InvestigationInput } from "../components/InvestigationInput";
import { Report } from "../components/Report";
import { Badge, Card, Container, Mono, RiskBadge } from "../components/ui";
import { CountUp, EASE_OUT, Reveal, RevealGroup, fadeUp } from "../components/motion";
import LightRays from "../components/bits/LightRays";
import DecryptedText from "../components/bits/DecryptedText";
import SpotlightCard from "../components/bits/SpotlightCard";
import ScrollReveal from "../components/bits/ScrollReveal";
import { investigate, type InvestigateRequest, type InvestigationResult } from "../lib/api";
import { scrollToTarget } from "../lib/smooth";

gsap.registerPlugin(ScrollTrigger, GsapSplitText, useGSAP);

/** Links from the RAQEEB Link Guard extension: /?url=... or /?message=... start an investigation. */
function requestFromQuery(): InvestigateRequest | null {
  const p = new URLSearchParams(window.location.search);
  const url = p.get("url");
  const message = p.get("message");
  if (url) return { type: "url", url: url.slice(0, 2048) };
  if (message) return { type: "message", message: message.slice(0, 5000) };
  return null;
}

const PROGRESS = [
  "Extracting links and the claimed organization",
  "Checking the domain against official UAE domains",
  "Checking DNS, certificate, redirects and domain age",
  "Checking threat intelligence",
  "Scoring the evidence and writing the explanation",
];

/** Step-by-step progress. Steps advance on a timer while the request runs; the last step waits for the answer. */
function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 650);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-accent-soft" aria-hidden>
        <motion.div
          className="h-full origin-left bg-accent"
          initial={{ scaleX: 0.04 }}
          animate={{ scaleX: (step + 1) / (PROGRESS.length + 0.6) }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        />
      </div>
      <div className="p-6" aria-busy="true">
        <p className="text-small font-semibold text-ink" aria-live="polite">
          Investigating… <span className="font-normal text-ink-3">step {step + 1} of {PROGRESS.length}</span>
        </p>
        <ul className="mt-4 space-y-3">
          {PROGRESS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <li
                key={label}
                className={`flex items-center gap-3 text-small transition-colors duration-300 ${state === "pending" ? "text-ink-3" : "text-ink"}`}
              >
                <span aria-hidden className="relative flex h-5 w-5 items-center justify-center">
                  {state === "done" && (
                    <motion.svg
                      viewBox="0 0 20 20"
                      className="h-5 w-5 text-accent"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                    >
                      <circle cx="10" cy="10" r="9" fill="currentColor" />
                      <path d="m6 10.2 2.6 2.6L14 7.6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                  {state === "active" && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-soft border-t-accent" />
                  )}
                  {state === "pending" && <span className="h-2 w-2 rounded-full bg-line-strong" />}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/** Hero headline: GSAP SplitText, characters rise out of a mask (nested gold spans are preserved). */
function HeroHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = GsapSplitText.create(ref.current!, { type: "words,chars", mask: "words", charsClass: "hero-char" });
        gsap.from(split.chars, { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.022, delay: 0.15 });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  return (
    <h1
      ref={ref}
      className="text-balance font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-[72px] lg:text-[88px]"
    >
      Verify the <span className="text-[#d8b773]">claim</span>,<br />
      not just the <span className="text-[#d8b773]">link</span>.
    </h1>
  );
}

const SCANS = [
  { domain: "emiratesnbd-secure.co", level: "high" as const, verdict: "Possible Impersonation", note: "“emiratesnbd” plus extra words. The real domain is emiratesnbd.com" },
  { domain: "emiratesp0st.ae", level: "high" as const, verdict: "Possible Impersonation", note: "A zero instead of the letter “o”. The real domain is emiratespost.ae" },
  { domain: "dewa.gov.ae", level: "safe" as const, verdict: "Verified Match", note: "Official domain, confirmed by the Dubai government directory" },
];

/** Showpiece: domains "decrypt" and RAQEEB's verdict appears. Static under reduced motion. */
function LiveScan() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [done, setDone] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) return;
    setDone(false);
    const reveal = setTimeout(() => setDone(true), 1300);
    const next = setTimeout(() => setI((n) => (n + 1) % SCANS.length), 5200);
    return () => {
      clearTimeout(reveal);
      clearTimeout(next);
    };
  }, [i, reduce]);
  const s = SCANS[i];
  return (
    <div className="relative overflow-hidden rounded-card border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md sm:p-6" aria-label="Example domain checks">
      <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-white/50">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d8b773] opacity-60" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d8b773]" />
          </span>
          Live identity check · example
        </span>
        <span className="font-mono normal-case tracking-normal text-white/40">{i + 1}/{SCANS.length}</span>
      </div>
      <div className="mt-4 min-h-[36px] font-mono text-[20px] text-white sm:text-[24px]" aria-live="polite">
        {reduce ? (
          s.domain
        ) : (
          <DecryptedText
            key={s.domain}
            text={s.domain}
            animateOn="view"
            sequential
            revealDirection="start"
            speed={38}
            maxIterations={14}
            characters="abcdefghijklmnopqrstuvwxyz0123456789-."
            className="text-white"
            encryptedClassName="text-[#d8b773]/70"
          />
        )}
      </div>
      <div className="mt-3 min-h-[52px]">
        <AnimatePresence mode="wait">
          {done && (
            <motion.div key={s.domain} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
              <span className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small font-medium ${s.level === "high" ? "bg-[#3a1414] text-[#ff8a80]" : "bg-[#0f2e24] text-[#6ee7b7]"}`}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {s.verdict}
              </span>
              <p className="mt-2 text-small text-white/60">{s.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const checks = [
  { title: "Threat intelligence", weight: 30, body: "Google Safe Browsing and existing VirusTotal reports. A failed lookup is reported as missing, never as clean." },
  { title: "Organization identity", weight: 25, body: "The claimed sender against a curated registry of official UAE domains, each backed by an authoritative source." },
  { title: "Domain and URL", weight: 20, body: "Lookalike spellings, swapped characters, odd subdomains, domain age, the certificate and every redirect hop." },
  { title: "Message content", weight: 15, body: "Requests for OTPs, card details or fees, and pressure tactics like deadlines and threats." },
  { title: "Context", weight: 10, body: "How the pieces fit together, like a bank that asks for payment through a courier link." },
];

const steps = [
  ["01", "Extract", "Links, the claimed organization and what the message asks you to do, including disguised links like hxxps://site[.]com."],
  ["02", "Verify", "The claim against official domains from authoritative sources. Never search results or social media."],
  ["03", "Check", "DNS, certificate, domain age and the full redirect chain, safely. Then Google Safe Browsing and VirusTotal."],
  ["04", "Explain", "Fixed rules score the evidence. The AI only explains it, and it can't invent findings."],
];

/** Pinned on desktop: the section holds while you scroll and the steps light up one by one. */
function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  // Only the pinned desktop version steps through; elsewhere every step is shown as complete.
  const [pinned] = useState(() => window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches);
  const [active, setActive] = useState(pinned ? 0 : steps.length - 1);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top top+=110",
          end: "+=1400",
          pin: true,
          scrub: true,
          onUpdate: (self) => setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
        });
        gsap.fromTo(".how-progress", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top+=110", end: "+=1400", scrub: true } });
        return () => st.kill();
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <div ref={root} className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <Badge>How it works</Badge>
        <h2 className="mt-4 font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[52px]">
          Evidence first.
          <br />
          <span className="text-accent">AI second.</span>
        </h2>
        <p className="mt-5 max-w-[460px] text-lead text-ink-2">
          Every verdict comes from fixed, published rules. The same input always gets the same answer, and every
          finding shows its source.
        </p>
      </div>
      <ol className="relative space-y-3 pl-8">
        <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-px bg-line" />
        <span aria-hidden className="how-progress absolute bottom-2 left-[11px] top-2 hidden w-px origin-top bg-accent lg:block" />
        {steps.map(([num, title, body], i) => {
          const on = i <= active;
          return (
            <li
              key={title}
              className={`relative rounded-card border p-6 transition-[background-color,border-color,box-shadow,opacity] duration-500 ease-out ${
                !pinned
                  ? "border-line bg-surface"
                  : i === active
                    ? "border-accent/40 bg-surface shadow-[0_24px_60px_-34px_rgba(146,114,42,0.55)]"
                    : "border-line bg-surface/60 opacity-60"
              }`}
            >
              <span
                aria-hidden
                className={`absolute -left-[29px] top-7 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                  on ? "border-accent bg-accent" : "border-line-strong bg-canvas"
                }`}
              >
                {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-badge text-accent">{num}</span>
                <h3 className="font-display text-card font-semibold text-ink">{title}</h3>
              </div>
              <p className="mt-2 text-body text-ink-2">{body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionTitle({ badge, title, lead }: { badge: string; title: string; lead?: string }) {
  return (
    <div className="max-w-[760px]">
      <Reveal>
        <Badge>{badge}</Badge>
      </Reveal>
      <ScrollReveal
        containerClassName="mt-4"
        textClassName="font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[48px]"
        baseOpacity={0.12}
        enableBlur
        blurStrength={6}
        baseRotation={0}
      >
        {title}
      </ScrollReveal>
      {lead && (
        <Reveal delay={0.1}>
          <p className="mt-4 text-lead text-ink-2">{lead}</p>
        </Reveal>
      )}
    </div>
  );
}

const STATS = [
  { value: 26, suffix: "", label: "UAE organizations in the identity registry" },
  { value: 5, suffix: "", label: "kinds of evidence behind every score" },
  { value: 102, suffix: "", label: "automated tests, including SSRF and prompt injection" },
  { value: 0, suffix: "", label: "messages stored. Ever." },
];

export function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: InvestigationResult; message?: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [initial] = useState(requestFromQuery);
  const started = useRef(false);
  const reduce = useReducedMotion();

  async function run(req: InvestigateRequest) {
    setBusy(true);
    setError(null);
    setResult(null);
    setTimeout(() => reportRef.current && scrollToTarget(reportRef.current, -110), 60);
    try {
      // Keep the progress panel up long enough to read (avoids a flash on near-instant demo answers).
      const minShow = reduce ? 0 : 1400;
      const [data] = await Promise.all([investigate(req), new Promise((r) => setTimeout(r, minShow))]);
      setResult({ data, message: req.type === "message" ? req.message : undefined });
      setTimeout(() => ScrollTrigger.refresh(), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initial && !started.current) {
      started.current = true;
      run(initial);
      window.history.replaceState(null, "", window.location.pathname); // don't keep the link in the address bar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showResults = busy || error || result;

  return (
    <>
      {/* ───────── Hero (dark) ───────── */}
      <section data-theme="dark" className="grain relative -mt-[84px] overflow-hidden bg-shell-950 pb-20 pt-[140px] sm:-mt-[116px] sm:pb-28 sm:pt-[200px]">
        <div aria-hidden className="absolute inset-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#d8b773"
            raysSpeed={0.55}
            lightSpread={0.85}
            rayLength={1.5}
            followMouse
            mouseInfluence={0.06}
            noiseAmount={0.06}
            distortion={0.04}
            opacity={0.85}
            maxDevicePixelRatio={1.5}
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,transparent,rgba(18,19,24,0.4)_60%,#121318_100%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-shell-950" />

        <Container className="relative">
          <div className="mx-auto max-w-[1040px] text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d8b773]/30 bg-[#d8b773]/[0.08] px-3.5 py-1.5 text-[13px] font-medium tracking-[0.02em] text-[#e9d3a1]"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d8b773]" />
              Digital trust investigation for the UAE<span className="hidden sm:inline"> · AD Police x 42AD Hackathon 2026</span>
            </motion.p>
            <div className="mt-8">
              <HeroHeadline />
            </div>
            <motion.p
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.75 }}
              className="mx-auto mt-8 max-w-[620px] text-[18px] leading-[30px] text-white/65 sm:text-[20px]"
            >
              Paste a suspicious message or link. RAQEEB checks who it claims to be from, gathers the evidence, and
              shows you exactly why it reached its verdict.
            </motion.p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[1120px] gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
            <motion.div
              id="investigate"
              className="scroll-mt-32"
              initial={{ opacity: 0, y: 36, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.95 }}
            >
              <div className="rounded-[20px] bg-gradient-to-b from-[#d8b773]/50 via-[#d8b773]/10 to-transparent p-px shadow-[0_40px_120px_-40px_rgba(216,183,115,0.45)]">
                <InvestigationInput onSubmit={run} busy={busy} initial={initial} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_OUT, delay: 1.1 }} className="space-y-4">
              <LiveScan />
              <p className="px-1 text-[13px] leading-5 text-white/40">
                Examples only. The scam domains are fictional; dewa.gov.ae is the real DEWA site.
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ───────── Results (light) ───────── */}
      <div ref={reportRef} className={showResults ? "bg-canvas py-12 sm:py-16" : ""}>
        <Container>
          <div className="mx-auto max-w-[1100px]">
            <AnimatePresence mode="wait">
              {busy && (
                <motion.div key="progress" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={{ duration: 0.3, ease: EASE_OUT }}>
                  <Progress />
                </motion.div>
              )}
              {!busy && error && (
                <motion.div key="error" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-panel border border-risk-high/30 bg-risk-high-bg px-4 py-3 text-body text-risk-high">
                  {error}
                </motion.div>
              )}
              {!busy && result && (
                <motion.div key={result.data.urls.map((u) => u.url).join() + (result.message ?? "")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Report result={result.data} message={result.message} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Container>
      </div>

      {/* ───────── Stats strip ───────── */}
      <section className="border-b border-line bg-surface">
        <Container>
          <RevealGroup className="grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
            {STATS.map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="px-2 py-10 sm:px-8">
                <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[56px]">
                  <CountUp value={s.value} duration={1.4} />
                  <span className="text-accent">{s.suffix}</span>
                </p>
                <p className="mt-3 max-w-[220px] text-small text-ink-2">{s.label}</p>
              </motion.div>
            ))}
          </RevealGroup>
        </Container>
      </section>

      {/* ───────── What RAQEEB checks ───────── */}
      <section id="checks" className="scroll-mt-32 py-24 sm:py-32">
        <Container>
          <SectionTitle
            badge="What we check"
            title="Five kinds of evidence. One transparent score."
            lead="Each category adds a weighted share of the score. With too little evidence, RAQEEB says Unknown Risk instead of guessing."
          />
          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c, i) => (
              <motion.div key={c.title} variants={fadeUp} className="flex">
                <SpotlightCard
                  theme="light"
                  spotlightColor="rgba(201, 165, 90, 0.28)"
                  className={`flex w-full flex-col rounded-card border p-7 ${i === 1 ? "border-accent/30 !bg-accent-cream" : "border-line !bg-surface"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] text-accent">{c.weight}<span className="text-[22px]">%</span></span>
                    <span className="font-mono text-badge text-ink-3">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 font-display text-card font-semibold text-ink">{c.title}</h3>
                  <p className="mt-2 text-body text-ink-2">{c.body}</p>
                </SpotlightCard>
              </motion.div>
            ))}
            <motion.div variants={fadeUp} className="flex">
              <div className="flex w-full flex-col justify-between gap-6 rounded-card bg-shell-900 p-7 text-white">
                <h3 className="font-display text-card font-semibold">Every report ends in one of six verdicts</h3>
                <div className="flex flex-wrap gap-2">
                  <RiskBadge level="safe" />
                  <RiskBadge level="low" />
                  <RiskBadge level="inactive" />
                  <RiskBadge level="moderate" />
                  <RiskBadge level="high" />
                  <RiskBadge level="unknown" />
                </div>
                <p className="text-small text-white/60">“Likely Safe” is the strongest RAQEEB ever says. It never claims 100%.</p>
              </div>
            </motion.div>
          </RevealGroup>
        </Container>
      </section>

      {/* ───────── How it works (pinned on desktop) ───────── */}
      <section id="how" className="scroll-mt-32 border-y border-line bg-surface py-24 sm:py-32">
        <Container>
          <HowItWorks />
        </Container>
      </section>

      {/* ───────── Sample report ───────── */}
      <section className="py-24 sm:py-32">
        <Container>
          <SectionTitle badge="Sample report" title="When the claim doesn't match the link." />
          <Reveal className="mt-12">
            <div className="grid overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_40px_100px_-60px_rgba(27,29,36,0.5)] lg:grid-cols-[1fr_1.1fr]">
              <div className="p-8 sm:p-10">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>Illustration</Badge>
                  <RiskBadge level="high" />
                </div>
                <p className="mt-6 font-display text-[26px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">
                  The message claims to be from <span className="text-accent">Emirates NBD</span>. The link points somewhere else.
                </p>
                <p className="mt-4 text-small text-ink-3">Example domains for illustration only. Not a real investigation result.</p>
              </div>
              <dl className="grid content-center gap-px bg-line">
                {[
                  ["Official domain", <Mono key="a">emiratesnbd.com</Mono>],
                  ["Link in message", <Mono key="b">emiratesnbd<span className="rounded bg-risk-high-bg px-0.5 text-risk-high">-secure</span>.co</Mono>],
                  ["Domain age", <span key="c">3 days</span>],
                  ["Verification", <span key="d" className="font-semibold text-risk-high">Possible Impersonation</span>],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center justify-between gap-4 bg-canvas px-8 py-5">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="text-right text-body">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ───────── Privacy (dark) ───────── */}
      <section id="privacy" data-theme="dark" className="grain relative scroll-mt-32 overflow-hidden bg-shell-950 py-24 text-white sm:py-32">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_80%_0%,rgba(216,183,115,0.14),transparent_70%)]" />
        <Container className="relative">
          <div className="max-w-[760px]">
            <span className="inline-flex rounded-control bg-[#d8b773]/10 px-1.5 py-0.5 text-small text-[#e9d3a1]">Privacy</span>
            <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
              Nothing is stored. <span className="text-[#d8b773]">Here's what is shared.</span>
            </h2>
          </div>
          <RevealGroup className="mt-14 grid gap-px overflow-hidden rounded-[20px] border border-white/10 bg-white/10 md:grid-cols-2">
            {[
              ["Stored", "Nothing. No accounts, no scan history, no analytics. Every investigation runs in memory and is gone."],
              ["Domain checks", "Only links and domain names go to DNS, domain registries, Google Safe Browsing and VirusTotal (lookup only)."],
              ["AI explanation", "Message text goes to Google Gemini only after names, phone numbers, emails, cards, Emirates ID and OTPs are masked."],
              ["Browser extension", "Only the link you click is checked, on four messaging and email sites. Message text is never read."],
            ].map(([title, body]) => (
              <motion.div key={title} variants={fadeUp} className="bg-shell-950 p-8">
                <h3 className="font-display text-card font-semibold text-white">{title}</h3>
                <p className="mt-2 text-body text-white/60">{body}</p>
              </motion.div>
            ))}
          </RevealGroup>
        </Container>
      </section>
    </>
  );
}
