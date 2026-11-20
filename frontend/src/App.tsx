import { Dashboard } from "./pages/Dashboard";

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 text-white" aria-label="RAQEEB home">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect x="1" y="1" width="26" height="26" rx="7" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <circle cx="12.5" cy="12.5" r="5.5" fill="none" stroke="#c9a55a" strokeWidth="2.2" />
        <path d="M16.6 16.6 21 21" stroke="#c9a55a" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-extrabold tracking-[0.06em]">RAQEEB</span>
      <span className="text-[15px] font-medium text-white/50" lang="ar">
        رقيب
      </span>
    </a>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-shell-900">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between border-b border-white/10 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-[14px] font-medium text-white/70">
            <a href="#how" className="rounded-control px-3 py-2 hover:text-white">
              How it works
            </a>
            <a href="#privacy" className="rounded-control px-3 py-2 hover:text-white">
              Privacy
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Dashboard />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 text-[13px] text-ink-3 sm:flex-row sm:justify-between sm:px-6">
          <p>RAQEEB is a student hackathon project and is not affiliated with any government entity.</p>
          <p>No investigation can guarantee something is safe.</p>
        </div>
      </footer>
    </div>
  );
}
