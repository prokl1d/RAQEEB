// Light/dark theme. The initial class is set by an inline script in index.html (no flash);
// this hook keeps React in sync and remembers the user's choice.
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "raqeeb-theme";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** True while <html> has the dark class; updates when the theme changes anywhere. */
export function useIsDark() {
  const [dark, setDark] = useState(() => current() === "dark");
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(current() === "dark"));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);

  // Follow the system setting until the user picks a theme themselves.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(KEY);
      } catch {
        /* storage blocked */
      }
      if (!saved) apply(mq.matches ? "dark" : "light", false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const apply = useCallback((t: Theme, save = true) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
    if (save) {
      try {
        localStorage.setItem(KEY, t);
      } catch {
        /* storage blocked: the choice just won't be remembered */
      }
    }
  }, []);

  const toggle = useCallback(() => apply(current() === "dark" ? "light" : "dark"), [apply]);
  return { theme, toggle };
}
