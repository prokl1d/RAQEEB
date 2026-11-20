import { InvestigationInput } from "../components/InvestigationInput";
import { Card, Eyebrow, Mono, RiskBadge } from "../components/ui";

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
  ["Extract", "Pull out links, the claimed organization and what the message asks you to do."],
  ["Verify", "Match the claim against official domains, not search results or social media."],
  ["Check", "Query threat intelligence and inspect the domain's technical signals."],
  ["Explain", "Score the evidence with fixed rules, then explain every finding in plain English."],
];

export function Dashboard() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[13px] text-white/75">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-bright" />
              Digital trust investigation for the UAE
            </p>
            <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[56px]">
              Verify the claim,
              <br />
              <span className="text-accent-bright">not just the link.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[600px] text-[17px] leading-7 text-white/70">
              Paste a suspicious message, link or screenshot. RAQEEB checks who it claims to be from,
              gathers evidence and shows you exactly why it reached its verdict.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-[720px] text-ink">
            <InvestigationInput />
          </div>
        </div>
      </section>

      {/* What RAQEEB checks */}
      <section id="how" className="mx-auto max-w-[1120px] px-4 py-20 sm:px-6">
        <Eyebrow>What RAQEEB checks</Eyebrow>
        <h2 className="mt-2 max-w-[640px] text-[30px] font-bold leading-tight tracking-[-0.01em] sm:text-[36px]">
          Five kinds of evidence, one transparent score
        </h2>
        <p className="mt-3 max-w-[640px] text-[16px] leading-7 text-ink-2">
          Each category adds a weighted share of the score. When too little evidence is available,
          RAQEEB says <strong className="font-semibold text-ink">Unknown Risk</strong> instead of guessing.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => (
            <Card key={c.title} className="p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[17px] font-semibold">{c.title}</h3>
                <span className="font-mono text-[13px] text-ink-3">{c.weight}%</span>
              </div>
              <p className="mt-2 text-[14.5px] leading-6 text-ink-2">{c.body}</p>
            </Card>
          ))}
          <Card className="flex flex-col justify-center gap-3 bg-canvas p-6">
            <p className="text-[13px] font-semibold text-ink-3">Every report ends in one of</p>
            <div className="flex flex-wrap gap-2">
              <RiskBadge level="low" />
              <RiskBadge level="moderate" />
              <RiskBadge level="high" />
              <RiskBadge level="unknown" />
            </div>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1120px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.01em] sm:text-[36px]">
              Evidence first, AI second
            </h2>
            <ol className="mt-8 space-y-6">
              {steps.map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[13px] text-ink-2">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold">{title}</h3>
                    <p className="mt-1 text-[14.5px] leading-6 text-ink-2">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Static sample report preview (illustrative, clearly labelled) */}
          <Card className="self-start p-6">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                Sample report · illustration
              </p>
              <RiskBadge level="high" />
            </div>
            <p className="mt-4 text-[15px] leading-6 text-ink">
              The message claims to be from <strong>Emirates NBD</strong>, but the link points to a
              domain that is not one of the bank's official domains.
            </p>
            <div className="mt-5 grid gap-2 rounded-control border border-line bg-canvas p-4 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-ink-3">Official domain</span>
                <Mono>emiratesnbd.com</Mono>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-ink-3">Link in message</span>
                <Mono>
                  emiratesnbd<span className="rounded bg-risk-high-bg px-0.5 text-risk-high">-secure</span>.co
                </Mono>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-ink-3">Verification</span>
                <span className="font-semibold text-risk-high">Possible Impersonation</span>
              </div>
            </div>
            <p className="mt-4 text-[12.5px] text-ink-3">
              Example domains for illustration only. Not a real investigation result.
            </p>
          </Card>
        </div>
      </section>

      {/* Privacy summary */}
      <section id="privacy" className="mx-auto max-w-[1120px] px-4 py-20 sm:px-6">
        <Eyebrow>Privacy</Eyebrow>
        <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.01em]">
          Nothing is stored. Here's what is shared.
        </h2>
        <ul className="mt-6 grid gap-3 text-[15px] leading-6 text-ink-2 sm:grid-cols-2">
          <li>• No accounts, no scan history, no analytics.</li>
          <li>• Screenshots are deleted as soon as text is extracted.</li>
          <li>• Links and domains are checked with Google Safe Browsing, VirusTotal and domain registries.</li>
          <li>
            • Message text, with phone numbers, emails and names masked, is sent to Google Gemini.
            On Gemini's free tier, Google may review it.
          </li>
        </ul>
      </section>
    </>
  );
}
