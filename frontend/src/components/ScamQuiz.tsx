// "Spot the scam": a one-minute awareness quiz (English + Arabic).
// Each message enters with a 3D turn; answering reveals the red flags highlighted in the text.
// "Check it with RAQEEB" runs the real engine on the same message. No WebGL (CSS 3D only).
import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Container } from "./ui";
import { EASE_OUT, Reveal } from "./motion";
import { QUIZ, type QuizSide } from "../lib/quizItems";
import { useI18n } from "../lib/i18n";

function highlight(side: QuizSide, on: boolean, reduce: boolean | null): ReactNode[] {
  if (!on) return [side.text];
  const spans: { s: number; e: number }[] = [];
  for (const m of side.marks) {
    const s = side.text.indexOf(m);
    if (s >= 0) spans.push({ s, e: s + m.length });
  }
  spans.sort((a, b) => a.s - b.s);
  const out: ReactNode[] = [];
  let i = 0;
  spans.forEach((sp, k) => {
    if (sp.s < i) return;
    out.push(side.text.slice(i, sp.s));
    out.push(
      <motion.mark
        key={k}
        initial={reduce ? false : { backgroundSize: "0% 100%" }}
        animate={{ backgroundSize: "100% 100%" }}
        transition={{ duration: 0.5, delay: 0.15 + k * 0.12, ease: EASE_OUT }}
        style={{ backgroundColor: "transparent", backgroundImage: "linear-gradient(rgba(217,183,110,0.42), rgba(217,183,110,0.42))", backgroundRepeat: "no-repeat", backgroundPosition: "0 0", color: "#fff4dd" }}
        className="rounded px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      >
        {side.text.slice(sp.s, sp.e)}
      </motion.mark>,
    );
    i = sp.e;
  });
  out.push(side.text.slice(i));
  return out;
}

export function ScamQuiz({ onCheck }: { onCheck: (text: string) => void }) {
  const { t, lang } = useI18n();
  const Q = t.tools.quiz;
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null); // true = said "scam"
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const item = QUIZ[idx];
  const side = lang === "ar" ? item.ar : item.en;
  const answered = answer !== null;
  const right = answered && answer === item.scam;
  const resultText = useMemo(() => {
    const r = score / QUIZ.length;
    return r >= 0.85 ? Q.result.top : r >= 0.5 ? Q.result.mid : Q.result.low;
  }, [score, Q]);

  function choose(saidScam: boolean) {
    if (answered) return;
    setAnswer(saidScam);
    if (saidScam === item.scam) setScore((s) => s + 1);
  }
  function next() {
    if (idx === QUIZ.length - 1) return setDone(true);
    setIdx((i) => i + 1);
    setAnswer(null);
  }
  function restart() {
    setIdx(0);
    setAnswer(null);
    setScore(0);
    setDone(false);
  }

  return (
    <section id="quiz" data-theme="dark" className="grain relative scroll-mt-28 overflow-hidden bg-shell-950 py-24 text-white sm:py-32">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_55%_at_15%_20%,rgba(217,183,110,0.16),transparent_70%),radial-gradient(40%_50%_at_90%_90%,rgba(217,183,110,0.10),transparent_70%)]" />
      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Reveal>
              <span className="inline-flex rounded-control bg-[#d9b76e]/10 px-1.5 py-0.5 text-small text-[#ecd6a3]">{Q.badge}</span>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 text-balance font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">{Q.title}</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-[520px] text-lead text-white/65">{Q.body}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex items-center gap-2" aria-hidden>
                {QUIZ.map((q, i) => (
                  <span
                    key={q.id}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < idx || done ? "w-6 bg-[#d9b76e]" : i === idx ? "w-10 bg-[#ecd6a3]" : "w-6 bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 text-small text-white/55" aria-live="polite">
                {done ? Q.score(score, QUIZ.length) : Q.progress(idx + 1, QUIZ.length)}
              </p>
              <p className="mt-6 text-[13px] text-white/40">{Q.note}</p>
            </Reveal>
          </div>

          <div className="[perspective:1400px]">
              {done ? (
                <motion.div
                  key="done"
                  initial={reduce ? false : { opacity: 0, rotateY: -18, y: 20 }}
                  animate={{ opacity: 1, rotateY: 0, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  className="rounded-[26px] border border-[#d9b76e]/30 bg-white/[0.04] p-8 text-center shadow-[0_50px_120px_-50px_rgba(217,183,110,0.5)] backdrop-blur-md sm:p-12"
                >
                  <p className="font-display text-[72px] font-extrabold leading-none text-[#d9b76e]" dir="ltr">
                    {score}<span className="text-[32px] text-white/40">/{QUIZ.length}</span>
                  </p>
                  <p className="mt-4 font-display text-[22px] font-semibold">{resultText}</p>
                  <button onClick={restart} className="mt-8 inline-flex h-11 cursor-pointer items-center rounded-control bg-[#d9b76e] px-5 font-semibold text-[#1a1408] transition-colors hover:bg-[#e8ca88]">
                    {Q.again}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={item.id + lang}
                  initial={reduce ? false : { opacity: 0, rotateY: lang === "ar" ? -24 : 24, x: lang === "ar" ? -40 : 40 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  transition={{ duration: 0.55, ease: EASE_OUT }}
                  className="rounded-[26px] bg-gradient-to-b from-[#d9b76e]/45 via-[#d9b76e]/10 to-transparent p-px shadow-[0_50px_120px_-50px_rgba(217,183,110,0.55)]"
                >
                  <div className="rounded-[25px] bg-[#0e0f13]/95 p-5 sm:p-7">
                    {/* Phone-style message */}
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-small font-bold text-white/80" aria-hidden>
                        {side.sender.replace(/[^A-Za-z+]/g, "").slice(0, 1) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p dir="ltr" className="truncate text-start font-semibold">{side.sender}</p>
                        <p className="text-[12px] text-white/45">SMS</p>
                      </div>
                    </div>
                    <p dir={lang === "ar" ? "rtl" : "ltr"} className="mt-5 rounded-[18px] rounded-ss-[6px] bg-white/[0.07] px-5 py-4 text-[17px] leading-8 text-white">
                      {highlight(side, answered, reduce)}
                    </p>

                    {!answered ? (
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <button onClick={() => choose(true)} className="h-12 cursor-pointer rounded-[14px] border border-[#ff8a80]/40 bg-[#ff8a80]/10 font-semibold text-[#ffb4ab] transition-[background-color,transform] duration-200 hover:bg-[#ff8a80]/20 active:scale-[0.98]">
                          {Q.scam}
                        </button>
                        <button onClick={() => choose(false)} className="h-12 cursor-pointer rounded-[14px] border border-[#6ee7b7]/40 bg-[#6ee7b7]/10 font-semibold text-[#a7f3d0] transition-[background-color,transform] duration-200 hover:bg-[#6ee7b7]/20 active:scale-[0.98]">
                          {Q.real}
                        </button>
                      </div>
                    ) : (
                      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }} className="mt-6" aria-live="polite">
                        <div className={`flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-3 ${right ? "bg-[#0f2e24] text-[#6ee7b7]" : "bg-[#3a1414] text-[#ff8a80]"}`}>
                          <span className="font-semibold">{right ? Q.correct : Q.wrong}</span>
                          <span className="text-white/80">{item.scam ? Q.wasScam : Q.wasReal}</span>
                        </div>
                        <ul className="mt-4 space-y-2">
                          {side.tips.map((tip, k) => (
                            <motion.li
                              key={tip}
                              initial={reduce ? false : { opacity: 0, x: lang === "ar" ? -10 : 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.35, delay: 0.2 + k * 0.08 }}
                              className="flex gap-2 text-small leading-6 text-white/75"
                            >
                              <span aria-hidden className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${item.scam ? "bg-[#ff8a80]" : "bg-[#6ee7b7]"}`} />
                              <span dir={lang === "ar" ? "rtl" : "ltr"}>{tip}</span>
                            </motion.li>
                          ))}
                        </ul>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                          <button onClick={() => onCheck(side.text)} className="h-11 cursor-pointer rounded-control border border-white/20 px-4 text-small font-semibold text-white/85 transition-colors hover:border-[#d9b76e] hover:text-[#ecd6a3]">
                            {Q.check}
                          </button>
                          <button onClick={next} className="group inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-[#d9b76e] px-5 font-semibold text-[#1a1408] transition-colors hover:bg-[#e8ca88]">
                            {idx === QUIZ.length - 1 ? Q.finish : Q.next}
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="transition-transform duration-200 rtl:-scale-x-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden>
                              <path d="M3.5 10h12m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
          </div>
        </div>
      </Container>
    </section>
  );
}
