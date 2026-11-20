// Language (English / Arabic) with right-to-left layout for Arabic.
// The initial lang/dir is set by an inline script in index.html before first paint.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ar, en, type Messages } from "./messages";

export type Lang = "en" | "ar";
const KEY = "raqeeb-lang";

const Ctx = createContext<{ lang: Lang; t: Messages; setLang: (l: Lang) => void }>({ lang: "en", t: en, setLang: () => {} });

function initial(): Lang {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage blocked */
    }
    setTimeout(() => ScrollTrigger.refresh(), 150); // layout flips, so scroll positions change
  }, []);
  return <Ctx.Provider value={{ lang, t: lang === "ar" ? ar : en, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
