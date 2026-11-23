"""Steps 5-6 (rule-based part): suspicious requests and pressure tactics in message text.

Rules cover English and Arabic (UAE residents often describe scams in Arabic), plus the requests
typical of phone scams: remote-control apps, "safe account" transfers, gift cards, secrecy and
fake legal threats. Matching runs on Arabic-normalised text (see arabic.py), which keeps match
positions identical to the original so the website can highlight them.
The rules are deterministic and explainable. Suspicious language alone never proves fraud.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import Category, Evidence, EvidenceStatus
from app.pipeline.arabic import normalize


@dataclass(frozen=True)
class Rule:
    key: str
    label: str
    why: str
    patterns: tuple[re.Pattern, ...]


def _r(*ps: str) -> tuple[re.Pattern, ...]:
    return tuple(re.compile(p, re.IGNORECASE) for p in ps)


# Arabic patterns are written in normalised form: ا for أ/إ/آ, ه for ة, ي for ى.
RULES = [
    Rule("otp", "Asks for a one-time code (OTP / PIN)",
         "Banks and government services never ask you to share an OTP or PIN.",
         _r(r"\b(otp|one[-\s]?time\s+(pass(word|code)?|code)|verification\s+code|pin(\s+code)?)\b",
            r"(رمز|كود|الرمز|الكود)\s+(ال)?(تحقق|تفعيل|سري|المرور|اللي)|الرقم السري|كلمه المرور لمره واحده")),
    Rule("card", "Asks for card or bank details",
         "Requests for card numbers, CVV or expiry dates are a common way to steal money.",
         _r(r"\b(card\s+(number|details)|cvv|cvc|expiry\s+date|iban|account\s+number)\b",
            r"(رقم|بيانات|تفاصيل)\s+(ال)?(بطاقه|بطاقتك|حساب|حسابك)|ايبان|تاريخ (ال)?انتهاء")),
    Rule("credentials", "Asks for a password or login",
         "Real organizations don't ask for your password by message.",
         _r(r"\b(password|passcode|log\s?in\s+details|username\s+and\s+password|credentials)\b",
            r"كلمه (ال)?(مرور|سر)|اسم المستخدم")),
    Rule("fee", "Asks for a small payment or fee",
         "A small 'release', 'customs' or 'redelivery' fee is a classic delivery-scam pattern.",
         _r(r"\b(pay|payment|fee|charge|customs\s+duty|redeliver(y)?\s+fee)\b[^.\n]{0,40}?"
            r"\b(aed|dhs?|dirhams?|usd|\$)\s?\d+(?:\.\d+)?|\b(aed|dhs?)\s?\d+(\.\d+)?\b[^.\n]{0,40}\b(fee|pay|charge)",
            r"(رسوم|ادفع|دفع|سداد|تسديد)[^.\n]{0,40}?\d+(?:[.,]\d+)?\s*(درهم|دراهم)|"
            r"\d+(?:[.,]\d+)?\s*(درهم|دراهم)[^.\n]{0,40}(رسوم|ادفع|دفع|سداد)")),
    Rule("urgency", "Uses urgency or a deadline",
         "Pressure to act fast stops people from checking whether a message is real.",
         _r(r"\b(urgent(ly)?|immediately|within\s+\d+\s*(hours?|hrs?|minutes?|mins?)|today\s+only|"
            r"final\s+(notice|warning|reminder)|last\s+chance|act\s+now|expires?\s+(today|soon))\b",
            r"عاجل|فورا|حالا|خلال\s+\d+\s*(ساعه|ساعات|دقيقه|دقايق|دقائق)|خلال\s+(ساعه|يوم)|اليوم فقط|"
            r"اخر فرصه|اخر انذار|بسرعه")),
    Rule("threat", "Threatens a penalty or account block",
         "Threats of blocked accounts, fines or legal action are used to scare people into acting.",
         _r(r"\b(suspend(ed)?|block(ed)?|deactivat(ed|e)|frozen|legal\s+action|penalt(y|ies)|"
            r"fine(d)?|arrest|will\s+be\s+(closed|cancel+ed))\b",
            r"ايقاف|تجميد|حظر|تعليق (حسابك|الحساب|البطاقه|بطاقتك)|اغلاق (حسابك|الحساب)|"
            r"سيتم (اغلاق|الغاء|ايقاف|حظر|تجميد)|مخالفه|غرامه|القبض|اجراءات قانونيه|السجن")),
    Rule("reward", "Promises a prize, refund or reward",
         "Unexpected prizes or refunds are bait to collect payment or personal details.",
         _r(r"\b(congratulations|you\s+(have\s+)?won|winner|prize|reward|cash\s*back|refund\s+of)\b",
            r"مبروك|ربحت|فزت|جايزه|جائزه|استرداد مبلغ|استرجاع مبلغ")),
    Rule("click", "Pushes you to click a link to fix something",
         "Scam messages steer you to a link where details are collected.",
         _r(r"\b(click|tap|visit|open)\b[^.\n]{0,30}\b(link|here|below|to\s+(verify|update|confirm|pay|release))\b",
            r"(اضغط|انقر|افتح|ادخل)\s+(علي\s+)?(الرابط|هنا|اللينك)")),
    Rule("update-details", "Asks you to update or confirm personal details",
         "Requests to 'update' Emirates ID, KYC or account details are used to steal identities.",
         _r(r"\b(update|confirm|verify|re-?activate)\b[^.\n]{0,30}\b(details|information|account|"
            r"emirates\s+id|kyc|identity)\b",
            r"(تحديث|تاكيد|تفعيل)\s+(بياناتك|البيانات|معلوماتك|حسابك|الهويه)")),
    # ---- requests typical of phone scams (also apply to messages) ----
    Rule("remote-app", "Asks you to install a remote-control app",
         "With remote access a scammer can see your screen and approve payments. "
         "Abu Dhabi Police warned about this trick in 2026.",
         _r(r"\b(any\s?desk|team\s?viewer|quick\s?support|rust\s?desk|air\s?droid|"
            r"remote\s+(access|control|support|desktop)(\s+app)?|screen\s+shar(e|ing))\b",
            r"اني ?ديسك|تيم ?فيو(ي)?ر|مشاركه الشاشه|(تطبيق|برنامج) (تحكم|للتحكم)|التحكم عن بعد")),
    Rule("transfer", "Asks you to transfer money to another account",
         "No bank or police unit asks you to move money to a 'safe account'. That money goes to the scammer.",
         _r(r"\b(transfer|move|send)\b[^.\n]{0,25}\b(money|funds|balance|savings|amount)\b|"
            r"\b(transfer|send|wire)\b[^.\n]{0,15}?\b(aed|dhs?|dirhams?|usd|\$)\s?\d[\d,]*(\.\d+)?|"
            r"\b(transfer|send|wire)\b[^.\n]{0,15}?\b\d[\d,]*(\.\d+)?\s?(aed|dhs?|dirhams?)\b|"
            r"\b(safe|secure|protected|temporary)\s+account\b",
            r"(حوّ?ل|حولي|تحويل|انقل|نقل)\s+(ال)?(مبلغ|فلوس|اموال|رصيد|مبالغ)|"
            r"(حوّ?ل|تحويل)\s+(فلوسك|رصيدك|اموالك)|حساب (امن|مؤقت|محمي)|"
            r"(حوّ?ل|حولي|تحويل|ارسل|ارسلي|ابعث|ابعثي)[^.\n]{0,15}?\d[\d,.]*\s*(درهم|دراهم)")),
    Rule("new-number", "Claims to be someone you know, on a new number",
         "A 'new number' message from a family member or friend who then asks for money is a common scam. "
         "Call them on the number you already have.",
         _r(r"\b(this\s+is\s+my\s+new\s+number|my\s+new\s+number|i\s+(have|got)\s+a\s+new\s+number|"
            r"(lost|broke)\s+my\s+phone)\b",
            r"رقمي الجديد|هذا رقمي|رقم جديد|(ضاع|انكسر|تعطل|تعطّل) (هاتفي|جوالي|تلفوني)")),
    Rule("gift-card", "Asks for payment in gift cards",
         "Real organizations never take payment in gift cards; once the code is shared the money is gone.",
         _r(r"\b(gift\s*cards?|itunes\s+cards?|google\s+play\s+cards?|steam\s+cards?|voucher\s+codes?)\b",
            r"بطاق(ه|ات) (هدايا|هديه|ايتونز|جوجل بلاي|شحن)")),
    Rule("secrecy", "Tells you to keep it secret or stay on the line",
         "Scammers isolate victims so nobody can warn them. A real organization lets you hang up and call back.",
         _r(r"\b(don'?t|do\s+not|not\s+to)\s+(tell|inform)\b|\b(keep\s+(this|it)\s+(secret|confidential)|"
            r"stay\s+on\s+the\s+line|(don'?t|do\s+not|not\s+to)\s+hang\s+up)\b",
            r"لا (تخبر|تخبري|تبلغ|تبلغي)\b|لا (تقول|تقولي|تكلم|تكلمي)\s+(لاحد|احد|اي|حد)|"
            r"لا تغلق (الخط|المكالمه)|خليك (علي|ع) الخط|لا تسكر")),
    Rule("authority", "Uses a fake legal case or police threat",
         "Police and courts don't settle cases by phone, and never ask for payments or codes to close them.",
         _r(r"\b(money\s+laundering|arrest\s+warrant|court\s+case|case\s+(number|against\s+you)|"
            r"police\s+(case|report)\s+against|you\s+are\s+wanted)\b",
            r"غسيل (ال)?اموال|امر (قبض|اعتقال)|قضيه (ضدك|عليك|باسمك)|مطلوب (للشرطه|امنيا)|بلاغ (ضدك|عليك)")),
    Rule("personal-id", "Asks for your Emirates ID or passport details",
         "ID details let scammers open accounts or pass bank checks in your name.",
         _r(r"\b(emirates\s+id\s+(number|copy|photo|picture)|(photo|picture|copy)\s+of\s+(your|the)\s+"
            r"(emirates\s+id|card|passport)|passport\s+(number|copy))\b",
            r"(صوره|رقم|نسخه)\s+(ال)?(هويه|جواز|بطاقه)")),
]

# Requests that directly lead to money or account loss (used by scoring).
HIGH_IMPACT_RULES = {"otp", "card", "credentials", "fee", "remote-app", "transfer", "gift-card", "personal-id"}
PRESSURE_RULES = {"urgency", "threat", "secrecy", "authority", "new-number"}


def analyze_content(text: str) -> list[Evidence]:
    norm = normalize(text)
    ev: list[Evidence] = []
    for rule in RULES:
        m = None
        for p in rule.patterns:
            m = p.search(norm)
            if m:
                break
        if not m:
            continue
        snippet = text[m.start():m.end()][:80]  # quote the original text, not the normalised form
        ev.append(Evidence(
            id=f"content.{rule.key}",
            category=Category.content,
            finding=f"{rule.label}: “{snippet}”",
            why_it_matters=rule.why,
            status=EvidenceStatus.suspicious,
            source="RAQEEB message rules (deterministic)",
            raw={"rule": rule.key, "match": snippet, "start": m.start(), "end": m.end()},
        ))
    return ev
