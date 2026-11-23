import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { Dashboard } from "./pages/Dashboard";
import { EASE_OUT } from "./components/motion";
import { Container } from "./components/ui";
import Magnet from "./components/bits/Magnet";
import { useSmoothScroll } from "./lib/smooth";
import { useTheme } from "./lib/theme";
import { useI18n } from "./lib/i18n";

/** EN / العربية switch. Shows the *other* language, written in that language. */
function LangToggle({ onDark }: { onDark: boolean }) {
  const { lang, t, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={t.switchLabel}
      title={t.switchLabel}
      lang={lang === "ar" ? "en" : "ar"}
      className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-small font-semibold transition-colors duration-300 ${
        onDark ? "border-white/15 text-white/85 hover:border-champagne/60 hover:text-champagne" : "border-line text-ink-2 hover:border-accent hover:text-accent"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
      </svg>
      <span className={lang === "ar" ? "font-[Inter]" : "font-['Noto_Kufi_Arabic']"}>
        <span className="hidden sm:inline">{t.switchTo}</span>
        <span className="sm:hidden">{lang === "ar" ? "EN" : "ع"}</span>
      </span>
    </button>
  );
}

function ThemeToggle({ onDark }: { onDark: boolean }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const label = theme === "dark" ? t.theme.toLight : t.theme.toDark;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-colors duration-300 ${
        onDark ? "border-white/15 text-white/85 hover:border-champagne/60 hover:text-champagne" : "border-line text-ink-2 hover:border-accent hover:text-accent"
      }`}
    >
        <motion.svg
          key={theme}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {theme === "dark" ? (
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          )}
        </motion.svg>
    </button>
  );
}

function Logo({ dark }: { dark: boolean }) {
  const { t, lang } = useI18n();
  const reduce = useReducedMotion();
  return (
    <a href="/" className={`group flex items-center gap-2 transition-colors duration-500 sm:gap-3 ${dark ? "text-white" : "text-ink"}`} aria-label={t.brand.home}>
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="h-9 w-9 shrink-0 transition-transform duration-300 ease-out group-hover:rotate-[-8deg] sm:h-11 sm:w-11">
        <motion.circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke={dark ? "#d9b76e" : "var(--color-accent)"}
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
        />
        <circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="m26 26 6.5 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {/* One name only, in the site's language. It glides in when the language changes. */}
      <motion.span
        key={lang}
        lang={lang}
        initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className={
          lang === "ar"
            ? "font-['Noto_Kufi_Arabic'] text-[20px] font-bold leading-none sm:text-[24px]"
            : "font-display text-[17px] font-extrabold leading-none tracking-[0.05em] sm:text-[21px] sm:tracking-[0.06em]"
        }
      >
        {t.brand.name}
      </motion.span>
    </a>
  );
}

const NAV = ["investigate", "protect", "checks", "how", "privacy"] as const;

/** Thin gold line along the header's bottom edge: how far down the page you are. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const spring = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  return (
    <motion.span
      aria-hidden
      style={{ scaleX: reduce ? scrollYProgress : spring }}
      className="pointer-events-none absolute inset-x-5 -bottom-px h-px origin-left rounded-full bg-gradient-to-r from-transparent via-[#d9b76e] to-[#ecd6a3] rtl:origin-right rtl:bg-gradient-to-l"
    />
  );
}

export default function App() {
  useSmoothScroll();
  const { t, lang } = useI18n();
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
      <a href="#investigate" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        {t.skip}
      </a>

      {/* Floating header */}
      <div id="site-header" className="sticky top-0 z-20 px-2 pt-3 sm:px-6 sm:pt-5">
        <header
          className={`relative mx-auto flex max-w-[1376px] items-center justify-between rounded-panel border px-4 backdrop-blur-xl transition-[height,background-color,border-color,box-shadow] duration-500 ease-out sm:px-5 ${
            scrolled ? "h-[64px] sm:h-[76px]" : "h-[72px] sm:h-24"
          } ${
            dark
              ? "border-white/10 bg-white/[0.04] shadow-none"
              : "border-line bg-surface/90 shadow-[0_14px_40px_-18px_rgba(27,29,36,0.28)]"
          }`}
        >
          <ScrollProgress />
          <Logo dark={dark} />
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((k) => (
              <a
                key={k}
                href={`#${k}`}
                className={`relative py-2 text-body font-semibold transition-colors duration-300 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left rtl:after:origin-right after:scale-x-0 after:rounded-full after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 ${
                  dark ? "text-white/80 after:bg-champagne hover:text-white" : "text-ink after:bg-accent hover:text-accent"
                }`}
              >
                {t.nav[k]}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
          <LangToggle onDark={dark} />
          <ThemeToggle onDark={dark} />
          <Magnet padding={40} magnetStrength={4}>
            <a
              href="#investigate"
              className="inline-flex h-10 items-center rounded-control bg-accent px-4 text-small font-semibold text-on-accent transition-[background-color,box-shadow] duration-200 hover:bg-accent-hover hover:shadow-[0_8px_24px_-8px_rgba(216,183,115,0.7)]"
            >
              {t.nav.start}
            </a>
          </Magnet>
          </div>
        </header>
      </div>

      <main>
        <Dashboard />
      </main>

      <footer data-theme="dark" className="relative overflow-hidden bg-black text-white">
        <Container className="relative grid gap-10 pb-10 pt-20 sm:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="max-w-[480px] text-body text-white/60">{t.footer.blurb}</p>
          </div>
          <div className="text-small text-white/50 sm:text-end">
            <p>{t.footer.d1}</p>
            <p className="mt-2">{t.footer.d2}</p>
          </div>
        </Container>
        <div
          aria-hidden
          lang={lang}
          className={`pointer-events-none select-none px-4 pb-6 text-center text-gold-sheen opacity-90 sm:px-6 ${
            lang === "ar"
              ? "font-['Noto_Kufi_Arabic'] text-[24vw] font-extrabold leading-[1.05]"
              : "font-[Inter] text-[22vw] font-extrabold leading-[0.8] tracking-[-0.05em]"
          }`}
        >
          {t.brand.name}
        </div>
      </footer>
    </div>
  );
}
