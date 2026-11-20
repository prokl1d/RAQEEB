import { InvestigationInput } from "../components/InvestigationInput";
import { Badge, Card, Container, LinkMore, Mono, RiskBadge } from "../components/ui";

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
    <div className="max-w-[720px]">
      <Badge>{badge}</Badge>
      <h2 className="mt-4 text-[32px] font-extrabold leading-[40px] tracking-[-0.8px] text-ink sm:text-section">
        {title}
      </h2>
      {lead && <p className="mt-4 text-lead text-ink-2">{lead}</p>}
    </div>
  );
}

export function Dashboard() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_50%_at_30%_35%,rgba(233,161,94,0.12),transparent_70%),radial-gradient(40%_45%_at_72%_40%,rgba(146,170,90,0.10),transparent_70%)]"
        />
        <Container className="relative pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-[860px] text-center">
            <Badge className="font-medium">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4v3.2l2 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              AD Police x 42AD Hackathon 2026
            </Badge>
            <h1 className="mt-6 text-[40px] font-extrabold leading-[46px] tracking-[-1px] text-ink sm:text-hero">
              Verify the <span className="text-accent">claim</span>,{" "}
              <br className="hidden sm:block" />
              not just the <span className="text-accent">link</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[607px] text-lead text-ink-2">
              Paste a suspicious message, link or screenshot. RAQEEB checks who it claims to be from,
              gathers evidence and shows you exactly why it reached its verdict.
            </p>
          </div>

          <div id="investigate" className="mx-auto mt-12 max-w-[800px] scroll-mt-32">
            <InvestigationInput />
          </div>
        </Container>
      </section>

      {/* What RAQEEB checks */}
      <section id="checks" className="scroll-mt-32 py-20 sm:py-28">
        <Container>
          <SectionHead
            badge="What we check"
            title="Five kinds of evidence, one transparent score"
            lead="Each category adds a weighted share of the score. When too little evidence is available, RAQEEB says Unknown Risk instead of guessing."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c, i) => (
              <Card key={c.title} highlight={i === 1} className="flex flex-col p-6">
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
            ))}
            <Card className="flex flex-col justify-between gap-4 p-6">
              <div>
                <h3 className="font-display text-card font-semibold text-ink">Every report ends in one of</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <RiskBadge level="low" />
                  <RiskBadge level="moderate" />
                  <RiskBadge level="high" />
                  <RiskBadge level="unknown" />
                </div>
              </div>
              <LinkMore href="#how">How the score works</LinkMore>
            </Card>
          </div>
        </Container>
      </section>

      {/* How it works: timeline */}
      <section id="how" className="scroll-mt-32 border-y border-line bg-surface py-20 sm:py-28">
        <Container>
          <SectionHead badge="How it works" title="Evidence first, AI second" />

          <ol className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
            <span aria-hidden className="absolute left-0 right-0 top-[7px] hidden h-px bg-line md:block" />
            {steps.map(([num, title, body], i) => (
              <li key={title} className="relative">
                <span
                  aria-hidden
                  className={`relative block h-3.5 w-3.5 rounded-full ${
                    i === 0 ? "bg-marker-active" : "bg-marker"
                  }`}
                />
                <div className="mt-6">
                  <span className="rounded-control bg-accent-soft px-1.5 py-0.5 font-mono text-badge text-accent-strong">
                    {num}
                  </span>
                  <h3 className="mt-3 font-display text-card font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-body text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Static sample report preview (illustrative, clearly labelled) */}
          <Card className="mt-16 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
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
        </Container>
      </section>

      {/* Privacy summary */}
      <section id="privacy" className="scroll-mt-32 py-20 sm:py-28">
        <Container>
          <SectionHead badge="Privacy" title="Nothing is stored. Here's what is shared." />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              ["Stored", "Nothing. No accounts, no scan history, no analytics. Screenshots are deleted as soon as text is extracted."],
              ["Domain checks", "Links and domains are checked with Google Safe Browsing, VirusTotal and public domain registries."],
              ["AI explanation", "Message text, with phone numbers, emails and names masked, is sent to Google Gemini. On Gemini's free tier, Google may review it."],
              ["Not shared", "Screenshots never leave the server. Text is read from them locally."],
            ].map(([title, body]) => (
              <Card key={title} className="p-6">
                <h3 className="font-display text-card font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-body text-ink-2">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
