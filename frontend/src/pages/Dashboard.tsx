import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GsapSplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { InvestigationInput, type InputPreset } from "../components/InvestigationInput";
import { CallCheck, ListingCheck, ProtectIntro, SearchShield } from "../components/Protection";
import { Report } from "../components/Report";
import { Badge, Card, Container, Mono, RiskBadge } from "../components/ui";
import { CountUp, EASE_OUT, Reveal, RevealGroup, fadeUp } from "../components/motion";
import LightRays from "../components/bits/LightRays";
import Particles from "../components/bits/Particles";
import ScrollVelocity from "../components/bits/ScrollVelocity";
import { useIsDark } from "../lib/theme";
import DecryptedText from "../components/bits/DecryptedText";
import SpotlightCard from "../components/bits/SpotlightCard";
import ScrollReveal from "../components/bits/ScrollReveal";
import { investigate, type InvestigateRequest, type InvestigationResult } from "../lib/api";
import { scrollToTarget } from "../lib/smooth";
import { useI18n } from "../lib/i18n";

// The 3D flag (Three.js) loads separately so it doesn't slow down the first paint.
const Flag3D = lazy(() => import("../components/Flag3D"));

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

/** Step-by-step progress. Steps advance on a timer while the request runs; the last step waits for the answer. */
function Progress() {
  const { t } = useI18n();
  const PROGRESS = t.progress.steps;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 650);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-accent-soft" aria-hidden>
        <motion.div
          className="h-full origin-left bg-accent rtl:origin-right"
          initial={{ scaleX: 0.04 }}
          animate={{ scaleX: (step + 1) / (PROGRESS.length + 0.6) }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        />
      </div>
      <div className="p-6" aria-busy="true">
        <p className="text-small font-semibold text-ink" aria-live="polite">
          {t.progress.title} <span className="font-normal text-ink-3">{t.progress.step(step + 1, PROGRESS.length)}</span>
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
                      <path d="m6 10.2 2.6 2.6L14 7.6" fill="none" stroke="var(--color-on-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
  const { t, lang } = useI18n();
  const h = t.hero.h1;
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Arabic letters join to each other, so Arabic animates word by word; Latin letter by letter.
        const arabic = lang === "ar";
        const split = GsapSplitText.create(ref.current!, arabic ? { type: "words", mask: "words" } : { type: "words,chars", mask: "words", charsClass: "hero-char" });
        gsap.from(arabic ? split.words : split.chars, { yPercent: 115, duration: arabic ? 1 : 1.1, ease: "expo.out", stagger: arabic ? 0.08 : 0.022, delay: 0.15 });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [lang], revertOnUpdate: true },
  );
  return (
    <h1
      key={lang}
      ref={ref}
      className="text-balance font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-[72px] lg:text-[88px]"
    >
      {h.a}<span className="text-[#d9b76e]">{h.claim}</span>{h.b}<br />
      {h.c}<span className="text-[#d9b76e]">{h.link}</span>{h.d}
    </h1>
  );
}

const SCANS = [
  { domain: "emiratesnbd-secure.co", level: "high" as const },
  { domain: "emiratesp0st.ae", level: "high" as const },
  { domain: "dewa.gov.ae", level: "safe" as const },
];

/** Showpiece: domains "decrypt" and RAQEEB's verdict appears. Static under reduced motion. */
function LiveScan() {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [done, setDone] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) return;
    const reveal = setTimeout(() => setDone(true), 1300);
    const next = setTimeout(() => {
      setDone(false); // clear the old verdict in the same render as the new domain
      setI((n) => (n + 1) % SCANS.length);
    }, 5200);
    return () => {
      clearTimeout(reveal);
      clearTimeout(next);
    };
  }, [i, reduce]);
  const s = { ...SCANS[i], verdict: SCANS[i].level === "high" ? t.scan.impersonation : t.scan.verified, note: t.scan.notes[i] };
  return (
    <div className="relative overflow-hidden rounded-card border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md sm:p-6" aria-label={t.scan.aria}>
      <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-white/50">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d9b76e] opacity-60" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d9b76e]" />
          </span>
          {t.scan.title}
        </span>
        <span className="font-mono normal-case tracking-normal text-white/40">{i + 1}/{SCANS.length}</span>
      </div>
      <div dir="ltr" className="mt-4 min-h-[36px] text-start font-mono text-[20px] text-white sm:text-[24px] rtl:text-end" aria-live="polite">
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
            encryptedClassName="text-[#d9b76e]/70"
          />
        )}
      </div>
      <div className="mt-3 min-h-[52px]">
          {done && (
            <motion.div key={s.domain} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
              <span className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small font-medium ${s.level === "high" ? "bg-[#3a1414] text-[#ff8a80]" : "bg-[#0f2e24] text-[#6ee7b7]"}`}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {s.verdict}
              </span>
              <p className="mt-2 text-small text-white/60">{s.note}</p>
            </motion.div>
          )}
      </div>
    </div>
  );
}

const WEIGHTS = [30, 25, 20, 15, 10];
const STEP_COUNT = 4;

/** Pinned on desktop: the section holds while you scroll and the steps light up one by one. */
function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const steps = t.how.steps;
  // Only the pinned desktop version steps through; elsewhere every step is shown as complete.
  const [pinned] = useState(() => window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches);
  const [active, setActive] = useState(pinned ? 0 : STEP_COUNT - 1);
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
          onUpdate: (self) => setActive(Math.min(STEP_COUNT - 1, Math.floor(self.progress * STEP_COUNT))),
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
        <Badge>{t.how.badge}</Badge>
        <h2 className="mt-4 font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[52px]">
          {t.how.t1}
          <br />
          <span className="text-accent">{t.how.t2}</span>
        </h2>
        <p className="mt-5 max-w-[460px] text-lead text-ink-2">
          {t.how.body}
        </p>
      </div>
      <ol className="relative space-y-3 ps-8">
        <span aria-hidden className="absolute bottom-2 start-[11px] top-2 w-px bg-line" />
        <span aria-hidden className="how-progress absolute bottom-2 start-[11px] top-2 hidden w-px origin-top bg-accent lg:block" />
        {steps.map(({ title, body }, i) => {
          const num = `0${i + 1}`;
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
                className={`absolute -start-[29px] top-7 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                  on ? "border-accent bg-accent" : "border-line-strong bg-canvas"
                }`}
              >
                {on && <span className="h-1.5 w-1.5 rounded-full bg-on-accent" />}
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

const STAT_VALUES = [26, 5, 132, 0];

/** "Made for the UAE": 3D waving flag in a dark showcase, beside the registry story. */
function MadeForUAE() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <Reveal>
              <Badge>{t.flag.badge}</Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[46px]">{t.flag.title}</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-[560px] text-lead text-ink-2">{t.flag.body}</p>
            </Reveal>
            <RevealGroup className="mt-7 flex flex-wrap gap-2" each={0.05}>
              {t.flag.chips.map((c) => (
                <motion.span key={c} variants={fadeUp} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-small font-medium text-ink-2">
                  {c}
                </motion.span>
              ))}
            </RevealGroup>
            <Reveal delay={0.15}>
              <p className="mt-7 flex items-center gap-2 text-small text-ink-3">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t.flag.disclaimer}
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div data-theme="dark" className="grain relative aspect-[5/4] overflow-hidden rounded-[24px] border border-white/10 bg-shell-950 shadow-[0_50px_120px_-50px_rgba(217,183,110,0.45)]">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_55%_at_40%_35%,rgba(217,183,110,0.18),transparent_70%)]" />
              <Suspense fallback={null}>
                <Flag3D />
              </Suspense>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-shell-950 to-transparent" />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: InvestigationResult; message?: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [initial] = useState(requestFromQuery);
  const started = useRef(false);
  const reduce = useReducedMotion();
  const isDark = useIsDark();
  const heroRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const [preset, setPreset] = useState<InputPreset | null>(null);

  /** Fill the investigation box and bring it into view (used by "Describe a call"). */
  function openInput(tab: InputPreset["tab"], value: string) {
    setPreset({ tab, value, nonce: Date.now() });
    const box = document.getElementById("investigate");
    if (box) scrollToTarget(box, -120);
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero parallax: copy drifts up and fades, rays dim, particles linger.
        const hero = { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true };
        gsap.to(".hero-copy", { yPercent: -22, opacity: 0.1, ease: "none", scrollTrigger: hero });
        gsap.to(".hero-rays", { opacity: 0, ease: "none", scrollTrigger: hero });
        gsap.to(".hero-particles", { yPercent: 12, ease: "none", scrollTrigger: hero });
        // Sample report tilts up into place.
        gsap.fromTo(
          ".tilt-in",
          { rotateX: 14, scale: 0.92, opacity: 0.4, transformPerspective: 1200, transformOrigin: "50% 100%" },
          { rotateX: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: ".tilt-in", start: "top bottom", end: "top 45%", scrub: true } },
        );
        // Privacy cards rise in sequence while scrolling.
        gsap.utils.toArray<HTMLElement>(".rise-scrub").forEach((el, i) => {
          gsap.fromTo(el, { y: 60 + i * 18, opacity: 0 }, { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 70%", scrub: true } });
        });
      });
      return () => mm.revert();
    },
    { scope: pageRef },
  );

  async function run(req: InvestigateRequest) {
    setBusy(true);
    setError(null);
    setResult(null);
    setTimeout(() => reportRef.current && scrollToTarget(reportRef.current, -110), 60);
    try {
      // Keep the progress panel up long enough to read (avoids a flash on near-instant demo answers).
      const minShow = reduce ? 0 : 1400;
      const [data] = await Promise.all([investigate(req), new Promise((r) => setTimeout(r, minShow))]);
      setResult({ data, message: req.type === "message" || req.type === "call" ? req.message : undefined });
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
    <div ref={pageRef}>
      {/* ───────── Hero (dark) ───────── */}
      <section ref={heroRef} data-theme="dark" className="grain relative -mt-[84px] overflow-hidden bg-shell-950 pb-20 pt-[140px] sm:-mt-[116px] sm:pb-28 sm:pt-[200px]">
        <div aria-hidden className="hero-particles absolute inset-0">
          <Particles
            particleColors={["#d9b76e", "#f3dfae", "#a8863f"]}
            particleCount={180}
            particleSpread={11}
            speed={0.06}
            particleBaseSize={70}
            sizeRandomness={0.9}
            alphaParticles
            moveParticlesOnHover
            particleHoverFactor={0.4}
            glow={0.7}
            twinkle={0.45}
            pixelRatio={1}
          />
        </div>
        <div aria-hidden className="hero-rays absolute inset-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#d9b76e"
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
          <div className="hero-copy mx-auto max-w-[1040px] text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d9b76e]/30 bg-[#d9b76e]/[0.08] px-3.5 py-1.5 text-[13px] font-medium tracking-[0.02em] text-[#ecd6a3]"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d9b76e]" />
              {t.hero.badge}<span className="hidden sm:inline">{t.hero.event}</span>
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
              {t.hero.lead}
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
              <div className="rounded-[20px] bg-gradient-to-b from-[#d9b76e]/50 via-[#d9b76e]/10 to-transparent p-px shadow-[0_40px_120px_-40px_rgba(216,183,115,0.45)]">
                <InvestigationInput onSubmit={run} busy={busy} initial={initial} preset={preset} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_OUT, delay: 1.1 }} className="space-y-4">
              <LiveScan />
              <p className="px-1 text-[13px] leading-5 text-white/40">
                {t.scan.footnote}
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ───────── Results (light) ───────── */}
      <div ref={reportRef} className={showResults ? "bg-canvas py-12 sm:py-16" : ""}>
        <Container>
          <div className="mx-auto max-w-[1100px]">
            {/* No exit-wait: the report must never depend on an exit animation finishing. */}
            {busy && (
              <motion.div key="progress" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
                <Progress />
              </motion.div>
            )}
            {!busy && error && (
              <motion.div key="error" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-panel border border-risk-high/30 bg-risk-high-bg px-4 py-3 text-body text-risk-high">
                {error}
              </motion.div>
            )}
            {!busy && result && (
              <motion.div key={result.data.urls.map((u) => u.url).join() + (result.message ?? "")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                <Report result={result.data} message={result.message} />
              </motion.div>
            )}
          </div>
        </Container>
      </div>

      {/* ───────── Stats strip ───────── */}
      <section className="border-b border-line bg-surface">
        <Container>
          <RevealGroup className="grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
            {STAT_VALUES.map((value, i) => (
              <motion.div key={i} variants={fadeUp} className="px-2 py-10 sm:px-8">
                <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[56px]">
                  <CountUp value={value} duration={1.4} />
                </p>
                <p className="mt-3 max-w-[220px] text-small text-ink-2">{t.stats[i]}</p>
              </motion.div>
            ))}
          </RevealGroup>
        </Container>
      </section>

      {/* ───────── Protection everywhere: Search Shield, calls, listings ───────── */}
      <ProtectIntro />
      <SearchShield />
      <CallCheck
        onTry={(story) => {
          setPreset({ tab: "call", value: story, nonce: Date.now() });
          run({ type: "call", message: story });
        }}
        onDescribe={() => openInput("call", "")}
      />
      <ListingCheck />

      {/* ───────── Made for the UAE (3D flag) ───────── */}
      <MadeForUAE />

      {/* ───────── Scroll-velocity marquee ───────── */}
      <section aria-hidden className="overflow-hidden border-b border-line bg-canvas py-10 sm:py-14">
        <ScrollVelocity
          texts={t.marquee}
          velocity={40}
          numCopies={6}
          outlineAlternate
          separator={<span className="mx-6 text-[0.45em] align-middle text-accent">◆</span>}
          className="font-display font-extrabold tracking-[-0.04em] text-accent"
          fontSize="clamp(44px, 8vw, 112px)"
        />
      </section>

      {/* ───────── What RAQEEB checks ───────── */}
      <section id="checks" className="scroll-mt-32 py-24 sm:py-32">
        <Container>
          <SectionTitle
            key={t.checks.title}
            badge={t.checks.badge}
            title={t.checks.title}
            lead={t.checks.lead}
          />
          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.checks.items.map((c, i) => (
              <motion.div key={i} variants={fadeUp} className="flex">
                <SpotlightCard
                  theme={isDark ? "dark" : "light"}
                  spotlightColor={isDark ? "rgba(217, 183, 110, 0.22)" : "rgba(201, 165, 90, 0.28)"}
                  className={`flex w-full flex-col rounded-card border p-7 ${i === 1 ? "border-accent/30 !bg-accent-cream" : "border-line !bg-surface"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] text-accent"><span dir="ltr">{WEIGHTS[i]}<span className="text-[22px]">%</span></span></span>
                    <span className="font-mono text-badge text-ink-3">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 font-display text-card font-semibold text-ink">{c.title}</h3>
                  <p className="mt-2 text-body text-ink-2">{c.body}</p>
                </SpotlightCard>
              </motion.div>
            ))}
            <motion.div variants={fadeUp} className="flex">
              <div className="flex w-full flex-col justify-between gap-6 rounded-card bg-shell-900 p-7 text-white">
                <h3 className="font-display text-card font-semibold">{t.checks.verdictsTitle}</h3>
                <div className="flex flex-wrap gap-2">
                  <RiskBadge level="safe" />
                  <RiskBadge level="low" />
                  <RiskBadge level="inactive" />
                  <RiskBadge level="moderate" />
                  <RiskBadge level="high" />
                  <RiskBadge level="unknown" />
                </div>
                <p className="text-small text-white/60">{t.checks.verdictsNote}</p>
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
          <SectionTitle key={t.sample.title} badge={t.sample.badge} title={t.sample.title} />
          <div className="mt-12 [perspective:1200px]">
            <div className="tilt-in grid overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_40px_100px_-60px_rgba(27,29,36,0.5)] lg:grid-cols-[1fr_1.1fr]">
              <div className="p-8 sm:p-10">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{t.sample.illustration}</Badge>
                  <RiskBadge level="high" />
                </div>
                <p className="mt-6 font-display text-[26px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">
                  {t.sample.text.a}<span className="text-accent">{t.sample.text.org}</span>{t.sample.text.b}
                </p>
                <p className="mt-4 text-small text-ink-3">{t.sample.disclaimer}</p>
              </div>
              <dl className="grid content-center gap-px bg-line">
                {[
                  [t.sample.rows[0], <Mono key="a">emiratesnbd.com</Mono>],
                  [t.sample.rows[1], <Mono key="b">emiratesnbd<span className="rounded bg-risk-high-bg px-0.5 text-risk-high">-secure</span>.co</Mono>],
                  [t.sample.rows[2], <span key="c">{t.sample.age}</span>],
                  [t.sample.rows[3], <span key="d" className="font-semibold text-risk-high">{t.scan.impersonation}</span>],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center justify-between gap-4 bg-canvas px-8 py-5">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="text-end text-body">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </section>

      {/* ───────── Privacy (dark) ───────── */}
      <section id="privacy" data-theme="dark" className="grain relative scroll-mt-32 overflow-hidden bg-shell-950 py-24 text-white sm:py-32">
        <div aria-hidden className="absolute inset-0 opacity-70">
          <Particles particleColors={["#d9b76e", "#f3dfae", "#a8863f"]} particleCount={110} particleSpread={12} speed={0.04} particleBaseSize={60} alphaParticles moveParticlesOnHover={false} glow={0.6} twinkle={0.5} pixelRatio={1} />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_80%_0%,rgba(217,183,110,0.14),transparent_70%)]" />
        <Container className="relative">
          <div className="max-w-[760px]">
            <span className="inline-flex rounded-control bg-[#d9b76e]/10 px-1.5 py-0.5 text-small text-[#ecd6a3]">{t.privacy.badge}</span>
            <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
              {t.privacy.t1}<span className="text-[#d9b76e]">{t.privacy.t2}</span>
            </h2>
          </div>
          <RevealGroup className="mt-14 grid gap-px overflow-hidden rounded-[20px] border border-white/10 bg-white/10 md:grid-cols-2">
            {t.privacy.items.map(({ title, body }) => (
              <motion.div key={title} variants={fadeUp} className="rise-scrub bg-shell-950/90 p-8 backdrop-blur-sm">
                <h3 className="font-display text-card font-semibold text-white">{title}</h3>
                <p className="mt-2 text-body text-white/60">{body}</p>
              </motion.div>
            ))}
          </RevealGroup>
        </Container>
      </section>
    </div>
  );
}
