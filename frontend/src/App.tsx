import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Dashboard } from "./pages/Dashboard";
import { EASE_OUT } from "./components/motion";
import { Container } from "./components/ui";
import Magnet from "./components/bits/Magnet";
import { useSmoothScroll } from "./lib/smooth";

function Logo({ dark }: { dark: boolean }) {
  const ink = dark ? "#ffffff" : "#282a33";
  return (
    <a href="/" className="group flex items-center gap-3" aria-label="RAQEEB home">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="transition-transform duration-300 ease-out group-hover:rotate-[-8deg]">
        <motion.circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke={dark ? "#d8b773" : "#92722a"}
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
        />
        <circle cx="20" cy="20" r="8" fill="none" stroke={ink} strokeWidth="2.5" className="transition-[stroke] duration-500" />
        <path d="m26 26 6.5 6.5" stroke={ink} strokeWidth="2.5" strokeLinecap="round" className="transition-[stroke] duration-500" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[20px] font-extrabold tracking-[0.06em] transition-colors duration-500 ${dark ? "text-white" : "text-ink"}`}>
          RAQEEB
        </span>
        <span className={`mt-1 text-[13px] font-medium transition-colors duration-500 ${dark ? "text-white/50" : "text-ink-3"}`} lang="ar">
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
  useSmoothScroll();
  // Header is dark glass over the dark hero, and turns into the white card once you scroll past it.
  const [overHero, setOverHero] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      // Dark header only when a [data-theme="dark"] section sits under the header's bottom edge.
      const probeY = window.innerWidth >= 640 ? 110 : 80;
      const under = document.elementsFromPoint(window.innerWidth / 2, probeY).find((el) => !el.closest("#site-header"));
      setOverHero(Boolean(under?.closest('[data-theme="dark"]')));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const dark = overHero;

  return (
    <div className="min-h-screen">
      <a href="#investigate" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-white">
        Skip to the investigation
      </a>

      {/* Top band */}
      <div className="relative z-30 bg-black text-small text-white/80">
        <Container className="flex h-7 items-center justify-between">
          <p className="truncate">RAQEEB · Student hackathon project, not a government service</p>
          <a href="#privacy" className="hidden hover:text-white sm:block">
            Privacy notice
          </a>
        </Container>
      </div>

      {/* Floating header */}
      <div id="site-header" className="sticky top-0 z-20 px-2 pt-3 sm:px-6 sm:pt-5">
        <header
          className={`mx-auto flex max-w-[1376px] items-center justify-between rounded-panel border px-4 backdrop-blur-xl transition-[height,background-color,border-color,box-shadow] duration-500 ease-out sm:px-5 ${
            scrolled ? "h-[64px] sm:h-[76px]" : "h-[72px] sm:h-24"
          } ${
            dark
              ? "border-white/10 bg-white/[0.04] shadow-none"
              : "border-line bg-surface/90 shadow-[0_14px_40px_-18px_rgba(27,29,36,0.28)]"
          }`}
        >
          <Logo dark={dark} />
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`relative py-2 text-body font-semibold transition-colors duration-300 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 ${
                  dark ? "text-white/80 after:bg-[#d8b773] hover:text-white" : "text-ink after:bg-accent hover:text-accent"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <Magnet padding={40} magnetStrength={4}>
            <a
              href="#investigate"
              className="inline-flex h-10 items-center rounded-control bg-accent px-4 text-small font-semibold text-white transition-[background-color,box-shadow] duration-200 hover:bg-accent-hover hover:shadow-[0_8px_24px_-8px_rgba(216,183,115,0.7)]"
            >
              Start
            </a>
          </Magnet>
        </header>
      </div>

      <main>
        <Dashboard />
      </main>

      <footer data-theme="dark" className="relative overflow-hidden bg-black text-white">
        <Container className="relative grid gap-10 pb-10 pt-20 sm:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="max-w-[480px] text-body text-white/60">
              Evidence-based investigation of suspicious links and messages. Built for the AD Police x 42AD
              Hackathon 2026.
            </p>
          </div>
          <div className="text-small text-white/50 sm:text-right">
            <p>RAQEEB is a student hackathon project and is not affiliated with any government entity.</p>
            <p className="mt-2">No investigation can guarantee something is safe.</p>
          </div>
        </Container>
        <div aria-hidden className="pointer-events-none select-none px-4 pb-6 text-center font-display text-[22vw] font-extrabold leading-[0.8] tracking-[-0.05em] text-gold-sheen opacity-90 sm:px-6">
          RAQEEB
        </div>
      </footer>
    </div>
  );
}
