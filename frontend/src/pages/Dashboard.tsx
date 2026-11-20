import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { InvestigationInput } from "../components/InvestigationInput";
import { EASE_OUT, Reveal, RevealGroup, fadeUp, stagger } from "../components/motion";
import { Report } from "../components/Report";
import { Badge, Card, Container, LinkMore, Mono, RiskBadge } from "../components/ui";
import { investigate, type InvestigateRequest, type InvestigationResult } from "../lib/api";

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

/** Gold word with an underline that draws itself once. */
function Underlined({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="relative inline-block text-accent">
      {children}
      <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2.5 w-full sm:-bottom-2 sm:h-3">
        <motion.path
          d="M2 8 C 50 2, 150 2, 198 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay }}
        />
      </svg>
    </span>
  );
}

const checks = [
  {
    title: "Threat intelligence",
    weight: 30,
    body: "Looks the link up in Google Safe Browsing and existing VirusTotal reports. A failed lookup is reported as missing, never as clean.",
  },
  {
    title: "Organization identity",
    weight: 25,
    body: "Compares the claimed sender with a curated registry of official UAE domains, each backed by an authoritative source.",
  },
  {
    title: "Domain and URL",
    weight: 20,
    body: "Checks lookalike spellings, swapped characters, odd subdomains, domain age, TLS and every redirect hop.",
  },
  {
    title: "Message content",
    weight: 15,
    body: "Finds requests for OTPs, card details or fees, and pressure tactics like deadlines and threats.",
  },
  {
    title: "Context",
    weight: 10,
    body: "Weighs how the pieces fit together, such as a bank that asks for payment through a courier link.",
  },
];

const steps = [
  ["01", "Extract", "Pull out links, the claimed organization and what the message asks you to do."],
  ["02", "Verify", "Match the claim against official domains, not search results or social media."],
  ["03", "Check", "Query threat intelligence and inspect the domain's technical signals."],
  ["04", "Explain", "Score the evidence with fixed rules, then explain every finding in plain English."],
];

function SectionHead({ badge, title, lead }: { badge: string; title: string; lead?: string }) {
  return (
    <Reveal className="max-w-[720px]">
      <Badge>{badge}</Badge>
      <h2 className="mt-4 text-[32px] font-extrabold leading-[40px] tracking-[-0.8px] text-ink sm:text-section">
        {title}
      </h2>
      {lead && <p className="mt-4 text-lead text-ink-2">{lead}</p>}
    </Reveal>
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

  async function run(req: InvestigateRequest) {
    setBusy(true);
    setError(null);
    setResult(null);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 50);
    try {
      // Keep the progress panel up long enough to read (avoids a flash on near-instant demo answers).
      const minShow = reduce ? 0 : 1400;
      const [data] = await Promise.all([investigate(req), new Promise((r) => setTimeout(r, minShow))]);
      setResult({ data, message: req.type === "message" ? req.message : undefined });
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

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_50%_at_30%_35%,rgba(233,161,94,0.14),transparent_70%),radial-gradient(40%_45%_at_72%_40%,rgba(146,170,90,0.11),transparent_70%)]"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE_OUT }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(27,29,36,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(27,29,36,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(60%_55%_at_50%_30%,black,transparent_75%)]"
        />
        <Container className="relative pb-16 pt-14 sm:pb-24 sm:pt-20">
          <motion.div className="mx-auto max-w-[860px] text-center" initial="hidden" animate="show" variants={stagger(0.09, 0.05)}>
            <motion.div variants={fadeUp}>
            <Badge className="font-medium">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4v3.2l2 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              AD Police x 42AD Hackathon 2026
            </Badge>
            </motion.div>
            <motion.h1 variants={fadeUp} className="mt-6 text-balance text-[40px] font-extrabold leading-[48px] tracking-[-1px] text-ink sm:text-hero">
              Verify the <Underlined delay={0.55}>claim</Underlined>,{" "}
              <br className="hidden sm:block" />
              not just the <Underlined delay={0.75}>link</Underlined>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-[607px] text-lead text-ink-2">
              Paste a suspicious message, link or screenshot. RAQEEB checks who it claims to be from,
              gathers evidence and shows you exactly why it reached its verdict.
            </motion.p>
          </motion.div>

          <motion.div
            id="investigate"
            className="mx-auto mt-12 max-w-[800px] scroll-mt-32"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.35 }}
          >
            <InvestigationInput onSubmit={run} busy={busy} initial={initial} />
          </motion.div>

          <div ref={reportRef} className="mx-auto mt-8 max-w-[1100px] scroll-mt-32">
            <AnimatePresence mode="wait">
              {busy && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  <Progress />
                </motion.div>
              )}
              {!busy && error && (
                <motion.div
                  key="error"
                  role="alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-panel border border-risk-high/30 bg-risk-high-bg px-4 py-3 text-body text-risk-high"
                >
                  {error}
                </motion.div>
              )}
              {!busy && result && (
                <motion.div
                  key={result.data.urls.map((u) => u.url).join() + (result.message ?? "")}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Report result={result.data} message={result.message} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Container>
      </section>

      {/* What RAQEEB checks */}
      <section id="checks" className="scroll-mt-32 py-20 sm:py-28">
        <Container>
          <SectionHead
            badge="What we check"
            title="Five kinds of evidence, one transparent score"
            lead="Each category adds a weighted share of the score. When too little evidence is available, RAQEEB says Unknown Risk instead of guessing. A link whose domain doesn't exist is shown as Inactive Link."
          />
          <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c, i) => (
              <motion.div key={c.title} variants={fadeUp} className="flex">
              <Card highlight={i === 1} interactive className="flex w-full flex-col p-6">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-control px-1.5 py-0.5 font-mono text-badge ${
                      i === 1 ? "bg-accent-strong text-white" : "bg-accent-soft text-accent-strong"
                    }`}
                  >
                    {c.weight}%
                  </span>
                  <span className="text-small text-ink-3">of the score</span>
                </div>
                <h3
                  className={`mt-4 font-display text-card font-semibold ${
                    i === 1 ? "text-accent-strong" : "text-ink"
                  }`}
                >
                  {c.title}
                </h3>
                <p className={`mt-2 text-body ${i === 1 ? "text-accent-strong/90" : "text-ink-2"}`}>
                  {c.body}
                </p>
              </Card>
              </motion.div>
            ))}
            <motion.div variants={fadeUp} className="flex">
            <Card interactive className="flex w-full flex-col justify-between gap-4 p-6">
              <div>
                <h3 className="font-display text-card font-semibold text-ink">Every report ends in one of</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <RiskBadge level="safe" />
                  <RiskBadge level="low" />
                  <RiskBadge level="inactive" />
                  <RiskBadge level="moderate" />
                  <RiskBadge level="high" />
                  <RiskBadge level="unknown" />
                </div>
              </div>
              <LinkMore href="#how">How the score works</LinkMore>
            </Card>
            </motion.div>
          </RevealGroup>
        </Container>
      </section>

      {/* How it works: timeline */}
      <section id="how" className="scroll-mt-32 border-y border-line bg-surface py-20 sm:py-28">
        <Container>
          <SectionHead badge="How it works" title="Evidence first, AI second" />

          <RevealGroup as="ol" each={0.12} className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
            <motion.span
              aria-hidden
              className="absolute left-0 right-0 top-[7px] hidden h-px origin-left bg-line-strong md:block"
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.9, ease: EASE_OUT } } }}
            />
            {steps.map(([num, title, body], i) => (
              <motion.li key={title} className="relative" variants={fadeUp}>
                <motion.span
                  aria-hidden
                  className={`relative block h-3.5 w-3.5 rounded-full ring-4 ring-surface ${
                    i === 0 ? "bg-marker-active" : "bg-marker"
                  }`}
                  variants={{ hidden: { scale: 0 }, show: { scale: 1, transition: { duration: 0.3, ease: EASE_OUT } } }}
                />
                <div className="mt-6">
                  <span className="rounded-control bg-accent-soft px-1.5 py-0.5 font-mono text-badge text-accent-strong">
                    {num}
                  </span>
                  <h3 className="mt-3 font-display text-card font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-body text-ink-2">{body}</p>
                </div>
              </motion.li>
            ))}
          </RevealGroup>

          {/* Static sample report preview (illustrative, clearly labelled) */}
          <Reveal className="mt-16">
          <Card interactive className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>Sample report · illustration</Badge>
                <RiskBadge level="high" />
              </div>
              <h3 className="mt-4 text-[26px] font-semibold leading-[34px] tracking-[-0.5px] text-ink">
                The claim doesn't match the link
              </h3>
              <p className="mt-3 text-body text-ink-2">
                The message claims to be from <strong className="font-semibold text-ink">Emirates NBD</strong>,
                but the link points to a domain that is not one of the bank's official domains.
              </p>
              <p className="mt-4 text-small text-ink-3">
                Example domains for illustration only. Not a real investigation result.
              </p>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line text-body">
              {[
                ["Official domain", <Mono key="a">emiratesnbd.com</Mono>],
                [
                  "Link in message",
                  <Mono key="b">
                    emiratesnbd<span className="rounded bg-risk-high-bg px-0.5 text-risk-high">-secure</span>.co
                  </Mono>,
                ],
                ["Verification", <span key="c" className="font-semibold text-risk-high">Possible Impersonation</span>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-4 bg-surface px-5 py-4">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          </Reveal>
        </Container>
      </section>

      {/* Privacy summary */}
      <section id="privacy" className="scroll-mt-32 py-20 sm:py-28">
        <Container>
          <SectionHead badge="Privacy" title="Nothing is stored. Here's what is shared." />
          <RevealGroup className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              ["Stored", "Nothing. No accounts, no scan history, no analytics. Screenshots are deleted as soon as text is extracted."],
              ["Domain checks", "Links and domains are checked with Google Safe Browsing, VirusTotal and public domain registries."],
              ["AI explanation", "Message text, with phone numbers, emails and names masked, is sent to Google Gemini. On Gemini's free tier, Google may review it."],
              ["Not shared", "Screenshots never leave the server. Text is read from them locally."],
            ].map(([title, body]) => (
              <motion.div key={title} variants={fadeUp} className="flex">
              <Card interactive className="w-full p-6">
                <h3 className="font-display text-card font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-body text-ink-2">{body}</p>
              </Card>
              </motion.div>
            ))}
          </RevealGroup>
        </Container>
      </section>
    </>
  );
}
