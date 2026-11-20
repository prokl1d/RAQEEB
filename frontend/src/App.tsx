import { Dashboard } from "./pages/Dashboard";
import { Container } from "./components/ui";

function Logo() {
  return (
    <a href="/" className="flex items-center gap-3" aria-label="RAQEEB home">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r="20" fill="none" stroke="#92722a" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="8" fill="none" stroke="#282a33" strokeWidth="2.5" />
        <path d="m26 26 6.5 6.5" stroke="#282a33" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[20px] font-extrabold tracking-[0.04em] text-ink">RAQEEB</span>
        <span className="mt-1 text-[13px] font-medium text-ink-3" lang="ar">
          رقيب
        </span>
      </span>
    </a>
  );
}

const nav = [
  ["Investigate", "#investigate"],
  ["What we check", "#checks"],
  ["How it works", "#how"],
  ["Privacy", "#privacy"],
] as const;

export default function App() {
  return (
    <div className="min-h-screen">
      {/* Top band */}
      <div className="bg-shell-900 text-small text-white">
        <Container className="flex h-7 items-center justify-between">
          <p className="truncate">RAQEEB · Student hackathon project, not a government service</p>
          <a href="#privacy" className="hidden text-white/80 hover:text-white sm:block">
            Privacy notice
          </a>
        </Container>
      </div>

      {/* Floating header card */}
      <div className="sticky top-0 z-20 px-2 pt-3 sm:px-6 sm:pt-5">
        <header className="mx-auto flex h-[72px] max-w-[1376px] items-center justify-between rounded-panel border border-line bg-surface px-4 shadow-float sm:h-24 sm:px-5">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => (
              <a key={href} href={href} className="text-body font-semibold text-ink hover:text-accent">
                {label}
              </a>
            ))}
          </nav>
          <a
            href="#investigate"
            className="inline-flex h-10 items-center rounded-control bg-accent px-4 text-small font-semibold text-white hover:bg-accent-hover"
          >
            Start
          </a>
        </header>
      </div>

      <main>
        <Dashboard />
      </main>

      <footer className="bg-shell-900 text-white">
        <Container className="grid gap-8 py-14 sm:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="font-display text-[20px] font-extrabold tracking-[0.04em]">RAQEEB</p>
            <p className="mt-3 max-w-[480px] text-body text-white/70">
              Evidence-based investigation of suspicious links, messages and screenshots. Built for
              the AD Police x 42AD Hackathon 2026.
            </p>
          </div>
          <div className="text-small text-white/70 sm:text-right">
            <p>RAQEEB is a student hackathon project and is not affiliated with any government entity.</p>
            <p className="mt-2">No investigation can guarantee something is safe.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
