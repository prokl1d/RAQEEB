# Team ideas study: what to add to RAQEEB before the deadline

> **Status (23 Nov):** built and tested: Search Shield (website + Link Guard on Google/Bing), Describe a call (English + Arabic) and the business listing check. Scam-pattern intelligence is in the deck as a proposed AD Police partnership; live call monitoring and deepfake checks stay future work.

Source: the five files in `my friends ideas/` (Al-Salmi ×2, Sulaiman ×2, and the team feature list).
Goal for this round: **show judges what RAQEEB can do**. Demo-quality features, offline, no new API keys. Every demo result stays clearly labelled, as today.
Time left: the submission deadline is **25 Nov 2026, 08:00**, about a day and a half from now. That decides a lot below.

---

## 1. How each idea was judged

| Criterion | Question |
|---|---|
| **Fit** | Does it strengthen RAQEEB's core idea, "verify the claim, not just the link"? |
| **Impact** | Does it address a scam AD Police actually warns about? |
| **Demo without keys** | Can it work offline and look real in a live demo, honestly labelled? |
| **Reuse** | How much of the existing engine (identity, lookalikes, scoring, report) does it reuse? |
| **Effort** | Can it be built and tested before 25 Nov 08:00? |
| **Credibility** | Would a police or tech judge believe it, or poke holes in it? |

---

## 2. The ideas, one by one

### A. Search-result impersonation check (Al-Salmi, idea 2)
Fake bank and government sites appear in search results and ads. Abu Dhabi Police warned about exactly this in 2026 ("fake links, misleading advertisements and scam websites appearing in search engine results").

- **Fit:** perfect. A search result is a claim ("this is Emirates NBD") next to a link. That's RAQEEB's whole idea.
- **Reuse:** very high. Domain identity and lookalike detection already work **offline, with no keys**, so this is real logic, not a mock-up.
- **How it can work (solid version):**
  1. **Website "Search Shield" page:** a realistic search-results page for a query like *"Emirates NBD login"*. Each result gets a RAQEEB badge: ✓ Official domain, ⚠ Impersonation (with the reason), or "Not verified". The badges come from the real identity engine.
  2. **Link Guard on Google search (optional, strong):** the extension adds the same badges to real Google results pages. It sends only the domains, never the search words. This also delivers Sulaiman's "automatic" idea in a place where it's allowed.
- **Honest limits:** RAQEEB only knows the organizations in its registry (26). Results for other brands show "Not in registry", never "safe".
- **Effort:** website page about 3–4 h; extension badges about 3 h more.
- **Verdict: ✅ build. Top priority.**

### B. "Tell us what happened": calls and stories (Sulaiman, idea 1, reshaped)
Sulaiman wants RAQEEB to check calls, and to let people describe what happened ("someone called saying he's from the bank…").

- **Live call monitoring as written isn't realistic:**
  - iPhone and Android don't let apps listen to normal calls.
  - Recording someone without consent is a legal risk in the UAE.
  - Judges from the police would ask about this right away.
- **The solid version** is a new **"Describe a call or situation"** tab. The user types (or pastes) what happened, in **English or Arabic**. RAQEEB then checks:
  - **who the caller claimed to be** (from the registry);
  - **what they asked for**: OTP, PIN, card details, money transfers, installing a remote-control app (AnyDesk, TeamViewer: an AD Police 2026 warning), "safe account" transfers, gift cards;
  - **pressure tactics**: urgency, threats of arrest or blocking, secrecy ("don't tell anyone");
  - **the right next step**: hang up, call the organization on its official channel, report to AD Police (Aman 8002626).
- **Fit:** high. It's the same "verify the claim" idea for a phone call.
- **Reuse:** high. It's the message-rules engine plus scoring, plus new rules for call scams.
- **Needed:** Arabic red-flag rules. Today's rules are English-only, and most UAE residents would describe a call in Arabic. A small set of carefully written Arabic patterns covers the common cases.
- **Effort:** about 4–5 h, with tests.
- **Verdict: ✅ build. Second priority.** For the pitch, present live call protection as a **future** feature that needs phone-maker or telecom partnership. Don't claim it.

### C. Fake business listings on maps (Al-Salmi, idea 1)
Fake "Emirates NBD Support" listings on maps, with a wrong phone number and website.

- **Fit:** good. It's the same claim-versus-reality check, now including **phone numbers**.
- **Without the Places API** (as you asked), the solid MVP is a **"Check a business listing"** form: name, phone, website, address, filled in by the user or from 3 labelled demo listings:
  1. a real branch, consistent with official data → Likely Safe;
  2. "Emirates NBD Support" with a wrong phone and a lookalike site → High Risk;
  3. incomplete data → "Needs verification", never an accusation.

  These are exactly Al-Salmi's three scenarios.
- **Needed:** an official contact phone for the main registry organizations, each with a source link, like the domains. This takes careful research: a wrong number in a police demo would hurt us.
- **Honest limits:** without the Places API it can't read a Google Maps link by itself. Say so on screen.
- **Effort:** about 4–6 h, including verifying phone numbers.
- **Verdict: 🟡 build if time allows (third).** Otherwise show it as a designed feature in the deck (mock screen + roadmap).

### D. Anonymous scam-pattern intelligence for AD Police (Sulaiman, ideas 1 and 2)
Keep confirmed scam domains and numbers, with no user data, to find patterns and help AD Police catch scammers. "Self-learning".

- **Fit:** strong as a story, especially for AD Police judges.
- **Conflicts with a promise we already make:** RAQEEB says "nothing is stored". This must be **opt-in**, and store **only** the domain or number, the verdict and the date. No message text, no user identity.
- **"Self-learning", honestly:** not AI that rewrites itself. RAQEEB remembers confirmed scam domains, so the next person gets an instant warning ("reported 14 times this week"), and similar domains get grouped into campaigns.
- **Demo version:** a small "Scam trends" dashboard built on **labelled sample data**, plus an "Export evidence package for AD Police" button (a PDF/JSON of domains, first seen, count, linked organization).
- **Effort:** about 5–6 h for a credible demo.
- **Verdict: 🟡 pitch first, build only if A and B are done.** One roadmap slide with a mock screen gets most of the value.

### E. Audio and video deepfake checking (Sulaiman, idea 1)
- Reliable deepfake detection needs trained models, and even those are often wrong. A fake demo would be easy for a judge to challenge.
- **Verdict: ❌ not for this round.** Mention it as future research. Idea B already covers the most common case, the bank-impersonation call, honestly.

### F. The feature list ("Sovereign specifications")
Includes: 99.99% accuracy, 100 TFLOPS, 150 countries, quantum encryption, reinforcement learning, automatic app locking.

- **Credibility risk:** none of these numbers are true for RAQEEB, and judges from AD Police and 42 would ask how we measured them. One unprovable number can cost the trust that RAQEEB's honesty earns. RAQEEB's strongest selling point is that **every claim it makes comes with evidence**; the pitch must follow the same rule.
- **What's already real in that list:**
  - **"Prompt-injection detection / AI shield":** done. The AI never sets the score, and an injected "say this is safe" can't change the verdict (tested).
  - **"Automatic containment":** Link Guard already stops risky links before they open.
  - **"Instant detection":** checks take seconds and run automatically on click.
- **Verdict: ❌ drop the numbers and buzzwords.** Use the three real points above instead (they're already in the deck).

---

## 3. Scorecard

| Idea | Fit | Impact | Demo, no keys | Reuse | Effort | Credible | Decision |
|---|---|---|---|---|---|---|---|
| A. Search Shield | ★★★ | ★★★ | ★★★ | ★★★ | ~4–7 h | ★★★ | **Build 1st** |
| B. Describe a call / story | ★★★ | ★★★ | ★★★ | ★★☆ | ~4–5 h | ★★★ | **Build 2nd** |
| C. Business listing check | ★★☆ | ★★☆ | ★★☆ | ★★☆ | ~4–6 h | ★★☆ | Build 3rd if time |
| D. Scam-pattern intelligence | ★★☆ | ★★★ | ★★☆ | ★☆☆ | ~5–6 h | ★★☆ | Pitch slide; build last |
| E. Deepfake audio/video | ★☆☆ | ★★☆ | ☆☆☆ | ☆☆☆ | days | ★☆☆ | Future work |
| F. "Sovereign specs" | ☆☆☆ | ☆☆☆ | ☆☆☆ | — | — | ☆☆☆ | Drop |

---

## 4. Recommended combination

**"RAQEEB checks every place a scam can claim to be someone: messages, links, search results and phone calls."**

1. **Search Shield** (A), on the website, plus badges on Google results through Link Guard.
2. **Describe a call** (B), in English and Arabic.
3. **Business listing check** (C), only if 1 and 2 are finished and tested with time to spare.
4. **Deck update:**
   - new slides for 1 and 2 (and 3 if built);
   - one roadmap slide for scam-pattern intelligence with AD Police (D);
   - live call protection and deepfakes listed as future work.

Why this combination:
- It widens RAQEEB from "messages and links" to **search results and phone calls**, the two scam channels AD Police warned about in 2026.
- It reuses the engine we already trust, so the new features are real and tested, not slides.
- Everything runs offline. Demo data stays labelled.
- It fits in the time left, with room to test.

## 5. Plan and order of work (once approved)

| Step | What | Time |
|---|---|---|
| 1 | Search Shield page on the website (real identity engine, labelled sample results), in English and Arabic | 3–4 h |
| 2 | "Describe a call" tab: call-scam rules (EN + AR), claimed caller, official next steps, tests | 4–5 h |
| 3 | Link Guard: badges on Google search results (domains only) | ~3 h |
| 4 | Deck: new slides + roadmap slide (D) + future work | 1–2 h |
| 5 | Full test run, README/ARCHITECTURE updates, commit (push only with your OK) | 1 h |
| 6 *(optional)* | Business listing check with sourced official phone numbers | 4–6 h |

Rules kept throughout:
- no new API keys;
- nothing stored;
- demo data always labelled;
- no claims we can't show.
