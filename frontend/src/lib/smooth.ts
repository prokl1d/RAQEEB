// Smooth scrolling (Lenis) driven by GSAP's ticker, so ScrollTrigger animations stay in sync.
// Disabled entirely for users who prefer reduced motion (native scrolling is used instead).
import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function scrollToTarget(target: string | HTMLElement, offset = -96) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ block: "start" });
  }
}

export function useSmoothScroll() {
  // Pinned and scrubbed sections store their scroll positions when they are created. Content that
  // arrives later (sample search results, listings, reports, lazy 3D scenes) makes the page taller,
  // which would leave a pinned section (How it works) fixed in the wrong place on top of others.
  // Whenever the page height really changes, recalculate every ScrollTrigger.
  useEffect(() => {
    let last = document.documentElement.scrollHeight;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const h = document.documentElement.scrollHeight;
        if (Math.abs(h - last) < 2) return;
        ScrollTrigger.refresh();
        last = document.documentElement.scrollHeight; // after refresh (pin spacers included)
      }, 150);
    });
    ro.observe(document.body);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add("lenis");

    // In-page links (#checks, #how, ...) glide instead of jumping.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      scrollToTarget(el as HTMLElement);
      history.replaceState(null, "", id);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
      document.documentElement.classList.remove("lenis");
    };
  }, []);
}
