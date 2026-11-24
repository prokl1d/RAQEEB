# RAQEEB · Hackathon submission kit

Everything to paste or upload into the AD Police × 42AD submission form, plus the 1-minute video script.

---

## بطاقة المشروع (Project card)

### عنوان المشروع / اسمه (Project title)

**English:** RAQEEB: Verify the claim, not just the link

**العربية:** رقيب: تحقّق من الادعاء، لا من الرابط فقط

### وصف موجز (Short description, max 600 characters)

**English** (533 characters):
> Scammers in the UAE borrow trusted names: banks, Emirates Post, even Abu Dhabi Police. RAQEEB investigates who a message, link, call, search result or listing claims to be, compares it with official domains and phone numbers, and explains a transparent verdict with its evidence, in English or Arabic. Tested on 1,053 real links with no API keys: 0.3% false alarms. Early Warning finds lookalike domains before a campaign, a Chrome extension checks links on click, and any report becomes a takedown-ready evidence file for AD Police.

**العربية** (474 حرفًا):
> يستغل المحتالون في الإمارات أسماء جهات موثوقة مثل البنوك وبريد الإمارات وحتى شرطة أبوظبي. يتحقق رقيب من الجهة التي تدّعيها الرسالة أو الرابط أو المكالمة أو نتيجة البحث أو النشاط التجاري، ويقارنها بالنطاقات وأرقام الهاتف الرسمية، ويشرح حكمًا شفافًا مدعومًا بالأدلة. اختُبر على 1,053 رابطًا حقيقيًا دون أي مفتاح API بنسبة إنذارات خاطئة 0.3%. ويكشف الإنذار المبكر النطاقات المشابهة قبل الحملة، وتفحص إضافة كروم الروابط عند الضغط، ويتحول أي تقرير إلى ملف أدلة جاهز لطلب الإزالة.

### الأدوات المستخدمة (Tools used)

> Python, FastAPI, Pydantic, React, TypeScript, Tailwind CSS, Motion, GSAP, Three.js, tesseract.js (on-device OCR), jsQR, Chrome Extension (Manifest V3), PWA (Web Share Target), RDAP, Certificate Transparency (crt.sh), OpenPhish and Phishing.Database feeds, Tranco list, RapidFuzz, pytest, Playwright. Optional when keys are added: Google Gemini API, Google Safe Browsing API v5, VirusTotal API

---

## Links and files

| Field | What to enter |
|---|---|
| **Repository URL** | `https://github.com/prokl1d/RAQEEB` (branch `master`). The repository must be **public**, or the judges must be added as collaborators, before submitting. |
| **Presentation Link** (optional) | Upload `docs/RAQEEB_Pitch_Deck.pptx` to OneDrive or Google Slides and share it as "Anyone with the link can view". |
| **Upload Presentation File** | `docs/RAQEEB_Presentation.pdf` (1.4 MB, 28 slides). The `.pptx` (4.3 MB) is also accepted. |
| **Upload Document File** | `docs/RAQEEB_Project_Description.pdf` (4 pages: problem, solution, measured accuracy, features, architecture, model choices, privacy, security, trade-offs, pilot plan, how to run). |
| **Demo Video URL** | Upload to YouTube as **Unlisted**, or to Google Drive shared as "Anyone with the link", then paste the link. |

---

## The 1-minute demo video

Rules from the form: about one minute, a demonstration and discussion of the solution, **no AI-generated video**. Record your own screens and voices.

**Recording setup**
- Engine in demo mode (`OFFLINE_DEMO=true`), website open at full screen, dark theme.
- Record the screen (Windows: `Win + Alt + R` with Xbox Game Bar, or OBS), and record each person's voice clearly; a face camera in a corner is a nice touch.
- Each member speaks about 20 seconds (about 50 words). Practise once with a timer.

### English script

**Member 1: the problem (0:00 to 0:20)**
*Screen: the RAQEEB home page, the hero headline.*
> "Seven in ten UAE residents have met a scam, and only nine percent of victims get their money back. Scammers don't just send bad links: they borrow trusted names, like Emirates NBD or Abu Dhabi Police. So we built RAQEEB. It doesn't ask 'is this link bad?' It asks: is this really who it claims to be?"

**Member 2: the live demo (0:20 to 0:42)**
*Screen: click "Bank impersonation", Start investigation, the report with 83 / High Risk, then hover over the evidence.*
> "Here's a real-looking bank SMS. RAQEEB finds the claim, Emirates NBD, sees the link imitates the bank, was registered three days ago and asks for the OTP. High Risk, 83, and every reason has its source. Our Chrome extension does this automatically when you click a link in WhatsApp."

**Member 3: more protection and the close (0:42 to 1:00)**
*Screen: scroll through Search Shield badges, the call check, then click "Report to AD Police" and show the evidence sheet.*
> "RAQEEB also marks fake bank sites in search results, checks suspicious calls in Arabic or English, and reads screenshots on your device. Nothing is stored. And with one tap, any report becomes evidence for Abu Dhabi Police's Aman service. RAQEEB: verify the claim, not just the link."

### النص بالعربية

**العضو الأول: المشكلة (0:00 إلى 0:20)**
*الشاشة: الصفحة الرئيسية لرقيب.*
> "سبعة من كل عشرة أشخاص في الإمارات تعرّضوا لمحاولة احتيال، وتسعة بالمئة فقط من الضحايا استعادوا أموالهم. المحتال لا يرسل رابطًا سيئًا فقط، بل يستعير اسمًا نثق به، مثل البنك أو شرطة أبوظبي. لذلك صنعنا رقيب. هو لا يسأل: هل الرابط سيئ؟ بل يسأل: هل هذه الجهة فعلًا من تدّعي أنها هي؟"

**العضو الثاني: العرض المباشر (0:20 إلى 0:42)**
*الشاشة: اضغط «انتحال بنك»، ثم «ابدأ التحقيق»، ثم التقرير بدرجة 83.*
> "هذه رسالة تبدو من البنك. رقيب يكتشف أنها تدّعي أنها من بنك الإمارات دبي الوطني، وأن الرابط يقلّد موقع البنك، وسُجّل قبل ثلاثة أيام، ويطلب رمز التحقق. النتيجة: خطورة عالية، 83، وكل سبب مع مصدره. وإضافة كروم تفعل هذا تلقائيًا عند الضغط على أي رابط في واتساب."

**العضو الثالث: الحماية الإضافية والختام (0:42 إلى 1:00)**
*الشاشة: درع البحث، ثم فحص المكالمة، ثم «أبلغ شرطة أبوظبي» وورقة الأدلة.*
> "رقيب يكشف أيضًا مواقع البنوك المزيّفة في نتائج البحث، ويفحص المكالمات المشبوهة بالعربية والإنجليزية، ويقرأ لقطات الشاشة على جهازك دون تخزين أي شيء. وبضغطة واحدة يتحول أي تقرير إلى أدلة لخدمة أمان في شرطة أبوظبي. رقيب: تحقّق من الادعاء، لا من الرابط فقط."

**Tip:** pick one language for the whole video (Arabic will resonate with AD Police; English matches the deck), or let Member 1 speak Arabic and switch the website to Arabic at the start: it shows the full right-to-left interface at the same time.

---

## Before you press "Save submission"

- [ ] Real team names in the deck (slides 1 and the last slide) and in the description, if you want them instead of GitHub usernames.
- [ ] Repository is public, or the judges have access.
- [ ] Video is Unlisted (YouTube) or shared "Anyone with the link" (Drive), and plays in a private browser window.
- [ ] Presentation link (if used) opens without signing in.
