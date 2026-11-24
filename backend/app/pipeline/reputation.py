"""Key-free reputation signals for zero-day links (no API, no account, works offline).

Every signal here is explainable and comes from public, citable data:
  - risky TLDs: endings that abuse reports (Spamhaus, Interisle Phishing Landscape) rank as
    heavily used for phishing because they are cheap or free
  - free hosting / tunnels / IPFS gateways: anyone can publish a page there in seconds
  - established sites: the Tranco top-100k list (Le Pochat et al., NDSS 2019, tranco-list.eu),
    used only to AVOID false alarms on long-standing sites, never to clear a confirmed threat
  - global brands: lookalikes of brands scammers imitate worldwide (PayPal, Microsoft, ...)
  - page facts: a password/card/OTP form on a page titled with a brand it doesn't belong to
"""

from __future__ import annotations

import gzip
import re
from functools import lru_cache
from pathlib import Path

from app.models import Category, Evidence, EvidenceStatus
from app.net.page import PageFacts
from app.pipeline.domains import LURE_WORDS, SHORTENERS, skeleton
from app.pipeline.extract import ParsedUrl

DATA = Path(__file__).resolve().parent.parent / "data"

RISKY_TLDS = {
    "top", "xyz", "icu", "cyou", "sbs", "cfd", "click", "buzz", "rest", "monster", "lol", "quest",
    "bond", "beauty", "hair", "mom", "tk", "ml", "ga", "cf", "gq", "zip", "mov", "support", "win",
    "bid", "loan", "work", "fit", "cam", "pw", "live", "online", "site", "shop", "store", "vip",
    "info", "life", "today", "pro", "cc", "su", "ru", "cn", "best", "fun", "space", "website",
    "digital", "link", "help", "center", "services", "app", "dev", "run",
}
# The strongest of the above: almost no established sites, heavy abuse.
VERY_RISKY_TLDS = {"top", "xyz", "icu", "cyou", "sbs", "cfd", "click", "buzz", "rest", "monster", "lol",
                   "quest", "bond", "tk", "ml", "ga", "cf", "gq", "zip", "mov", "pw", "su", "cam"}

# Registrable domains where anyone can publish a page for free (the PSL "private" section is
# not applied by RAQEEB's parser, so foo.pages.dev -> registrable "pages.dev").
FREE_HOSTS = {
    "pages.dev", "workers.dev", "r2.dev", "vercel.app", "netlify.app", "github.io", "gitlab.io",
    "firebaseapp.com", "web.app", "appspot.com", "glitch.me", "repl.co", "replit.dev", "replit.app",
    "herokuapp.com", "onrender.com", "fly.dev", "railway.app", "surge.sh", "ngrok.io", "ngrok-free.app",
    "ngrok.app", "trycloudflare.com", "loca.lt", "serveo.net", "weebly.com", "weeblysite.com",
    "wixsite.com", "wix.com", "webflow.io", "blogspot.com", "000webhostapp.com", "godaddysites.com",
    "square.site", "mystrikingly.com", "jimdosite.com", "carrd.co", "gitbook.io", "notion.site",
    "framer.app", "framer.website", "typedream.app", "azurewebsites.net", "windows.net",
    "amazonaws.com", "cloudfront.net", "googleapis.com", "firebasestorage.app", "sharepoint.com",
    "ipfs.io", "cf-ipfs.com", "dweb.link", "w3s.link", "nftstorage.link", "fleek.co", "4everland.app",
    "on-fleek.app", "translate.goog", "wordpress.com", "tilda.ws", "yolasite.com", "site123.me",
    "webnode.page", "ukit.me", "bit.ly", "linktr.ee", "forms.gle", "qualtrics.com", "jotform.com",
    "formstack.com", "typeform.com", "zohopublic.com", "hubspotpagebuilder.com", "mailchimpsites.com",
    "canva.site", "my.canva.site", "codepen.io", "codesandbox.io", "csb.app", "stackblitz.io",
    "pantheonsite.io", "duckdns.org", "no-ip.com", "ddns.net", "hopto.org", "zapto.org", "servehttp.com",
}
IPFS_HOSTS = {"ipfs.io", "cf-ipfs.com", "dweb.link", "w3s.link", "nftstorage.link", "fleek.co", "4everland.app"}

# Global brands scammers imitate. label -> official registrable domains.
# Short or common-word names are only matched as whole tokens (never by edit distance).
GLOBAL_BRANDS: dict[str, tuple[str, ...]] = {
    "paypal": ("paypal.com", "paypal.me", "paypalobjects.com"),
    "microsoft": ("microsoft.com", "microsoftonline.com", "live.com", "office.com", "outlook.com", "azure.com",
                  "windows.com", "msn.com", "office365.com", "sharepoint.com", "onedrive.com", "microsoft365.com"),
    "office365": ("office.com", "office365.com", "microsoft.com"),
    "microsoft365": ("microsoft365.com", "microsoft.com"),
    "onedrive": ("onedrive.com", "live.com", "microsoft.com"),
    "sharepoint": ("sharepoint.com", "microsoft.com"),
    "outlook": ("outlook.com", "live.com", "office.com", "microsoft.com"),
    "apple": ("apple.com", "icloud.com", "me.com", "apple.news"),
    "icloud": ("icloud.com", "apple.com"),
    "appleid": ("apple.com",),
    "netflix": ("netflix.com", "netflix.net", "nflxext.com"),
    "amazon": ("amazon.com", "amazon.ae", "amazon.sa", "amazon.co.uk", "amazon.de", "amazon.in", "amazon.fr",
               "amazon.co.jp", "amazon.ca", "amazonaws.com", "amazon.jobs", "aws.amazon.com", "primevideo.com"),
    "facebook": ("facebook.com", "fb.com", "meta.com", "facebook.net", "fbcdn.net"),
    "instagram": ("instagram.com",),
    "whatsapp": ("whatsapp.com", "whatsapp.net", "wa.me"),
    "google": ("google.com", "google.ae", "gmail.com", "youtube.com", "googleusercontent.com", "gstatic.com",
               "googleapis.com", "goo.gl", "g.co", "withgoogle.com", "google.co.uk"),
    "gmail": ("gmail.com", "google.com"),
    "linkedin": ("linkedin.com", "lnkd.in"),
    "dropbox": ("dropbox.com", "dropboxusercontent.com", "db.tt"),
    "docusign": ("docusign.com", "docusign.net"),
    "adobe": ("adobe.com", "adobe.io", "adobelogin.com"),
    "coinbase": ("coinbase.com",),
    "binance": ("binance.com", "binance.us", "binance.info"),
    "metamask": ("metamask.io",),
    "trustwallet": ("trustwallet.com",),
    "ledger": ("ledger.com",),
    "wellsfargo": ("wellsfargo.com",),
    "bankofamerica": ("bankofamerica.com", "bofa.com"),
    "citibank": ("citibank.com", "citi.com"),
    "hsbc": ("hsbc.com", "hsbc.ae", "hsbc.co.uk"),
    "americanexpress": ("americanexpress.com", "amex.com"),
    "amex": ("americanexpress.com", "amex.com"),
    "mastercard": ("mastercard.com", "mastercard.ae"),
    "steamcommunity": ("steamcommunity.com", "steampowered.com"),
    "steampowered": ("steampowered.com", "steamcommunity.com"),
    "roblox": ("roblox.com",),
    "telegram": ("telegram.org", "t.me", "telegram.me"),
    "tiktok": ("tiktok.com",),
    "yahoo": ("yahoo.com",),
    "spotify": ("spotify.com",),
    "airbnb": ("airbnb.com", "airbnb.ae"),
    "ebay": ("ebay.com", "ebay.co.uk"),
    "walmart": ("walmart.com",),
    "shein": ("shein.com",),
    "aliexpress": ("aliexpress.com",),
    "usps": ("usps.com",),
    "fedex": ("fedex.com",),
    "dhl": ("dhl.com", "dhl.de"),
    "ups": ("ups.com",),
    "chase": ("chase.com",),
    "att": ("att.com",),
    "discord": ("discord.com", "discord.gg", "discordapp.com"),
    "xfinity": ("xfinity.com", "comcast.net", "comcast.com"),
    "comcast": ("comcast.net", "comcast.com", "xfinity.com"),
    "robinhood": ("robinhood.com",),
    "verizon": ("verizon.com", "verizonwireless.com"),
    "tmobile": ("t-mobile.com",),
    "sbcglobal": ("att.com", "sbcglobal.net"),
    "midasbuy": ("midasbuy.com",),
    "epicgames": ("epicgames.com",),
    "garena": ("garena.com",),
    "opensea": ("opensea.io",),
    "kraken": ("kraken.com",),
    "bybit": ("bybit.com",),
    "okx": ("okx.com",),
    "meta": ("meta.com", "facebook.com", "fb.com"),
    "zoom": ("zoom.us", "zoom.com"),
    "crypto": (),  # generic lure word in hosts like crypto-wallet-verify.xyz
    "webmail": (),  # generic lure, no owner: never "official" anywhere
    "roundcube": (),
    "zimbra": (),
}
# Display names, for evidence text.
BRAND_NAMES = {"paypal": "PayPal", "microsoft": "Microsoft", "office365": "Microsoft 365", "microsoft365": "Microsoft 365",
               "onedrive": "OneDrive", "sharepoint": "SharePoint", "outlook": "Outlook", "apple": "Apple",
               "icloud": "iCloud", "appleid": "Apple ID", "netflix": "Netflix", "amazon": "Amazon",
               "facebook": "Facebook", "instagram": "Instagram", "whatsapp": "WhatsApp", "google": "Google",
               "gmail": "Gmail", "linkedin": "LinkedIn", "dropbox": "Dropbox", "docusign": "DocuSign",
               "adobe": "Adobe", "coinbase": "Coinbase", "binance": "Binance", "metamask": "MetaMask",
               "trustwallet": "Trust Wallet", "ledger": "Ledger", "wellsfargo": "Wells Fargo",
               "bankofamerica": "Bank of America", "citibank": "Citibank", "hsbc": "HSBC",
               "americanexpress": "American Express", "amex": "American Express", "mastercard": "Mastercard",
               "steamcommunity": "Steam", "steampowered": "Steam", "roblox": "Roblox", "telegram": "Telegram",
               "tiktok": "TikTok", "yahoo": "Yahoo", "spotify": "Spotify", "airbnb": "Airbnb", "ebay": "eBay",
               "walmart": "Walmart", "shein": "SHEIN", "aliexpress": "AliExpress", "usps": "USPS", "fedex": "FedEx",
               "dhl": "DHL", "ups": "UPS", "chase": "Chase", "att": "AT&T", "webmail": "webmail",
               "roundcube": "Roundcube webmail", "zimbra": "Zimbra webmail", "discord": "Discord",
               "xfinity": "Xfinity", "comcast": "Comcast", "robinhood": "Robinhood", "verizon": "Verizon",
               "tmobile": "T-Mobile", "sbcglobal": "AT&T (SBCGlobal)", "midasbuy": "Midasbuy",
               "epicgames": "Epic Games", "garena": "Garena", "opensea": "OpenSea", "kraken": "Kraken",
               "bybit": "Bybit", "okx": "OKX", "crypto": "crypto", "meta": "Meta", "zoom": "Zoom"}
# Names that are also everyday words or very short: whole-token matches only, never fuzzy.
TOKEN_ONLY = {"apple", "chase", "outlook", "ledger", "dhl", "ups", "att", "amex", "hsbc", "ebay", "shein",
              "usps", "yahoo", "adobe", "google", "gmail", "amazon", "webmail", "roundcube", "zimbra", "okx", "kraken",
              "crypto", "comcast", "meta", "zoom"}
# Phrases in a page title that name a brand (title check is stricter than the URL check).
TITLE_BRANDS = {k: v for k, v in GLOBAL_BRANDS.items() if v and k not in {"att", "ups", "chase", "ledger", "apple", "meta", "zoom"}}
TITLE_BRANDS.update({"apple id": GLOBAL_BRANDS["apple"], "sign in with apple": GLOBAL_BRANDS["apple"],
                     "zoom client": GLOBAL_BRANDS["zoom"], "zoom meeting": GLOBAL_BRANDS["zoom"],
                     "meta business": GLOBAL_BRANDS["meta"], "meta for business": GLOBAL_BRANDS["meta"]})
# Words in a page title that show it is a sign-in / account page.
LOGIN_TITLE = re.compile(r"\b(log ?in|sign ?in|sign-in|log-in|logon|account|verify|verification|wallet|secure|"
                         r"update|web ?mail|password|authenticat\w*|unlock|suspend\w*|billing|payment)\b", re.I)
_DATE_STAMP = re.compile(r"\d{2}-\d{2}-20\d{2}")


def machine_name(sub: str) -> bool:
    """A hostname that looks generated by a phishing kit rather than chosen by a person."""
    s = sub.lower()
    if not s:
        return False
    parts = [p for p in re.split(r"[-.]", s) if p]
    digits = sum(ch.isdigit() for ch in s)
    return bool(_DATE_STAMP.search(s) or len(parts) >= 5 or (len(parts) >= 4 and digits >= 1)
                or (len(s) >= 25 and digits / len(s) >= 0.2) or digits >= 10)


@lru_cache
def established() -> frozenset[str]:
    """Tranco top-100k registrable domains, minus free-hosting and shortener platforms."""
    f = DATA / "tranco_top100k.txt.gz"
    if not f.exists():
        return frozenset()
    with gzip.open(f, "rt", encoding="utf-8") as fh:
        doms = {line.strip() for line in fh if line.strip()}
    return frozenset(doms - FREE_HOSTS - SHORTENERS)


def is_established(domain: str) -> bool:
    return bool(domain) and domain in established()


def _tokens(s: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]


def brand_owner(domain: str) -> set[str]:
    """Global brand labels that officially own this registrable domain."""
    return {b for b, doms in GLOBAL_BRANDS.items() if domain in doms}


def global_lookalike(u: ParsedUrl) -> tuple[str, str] | None:
    """(brand, how) if the URL's host imitates a global brand it doesn't belong to."""
    reg = u.registrable_domain.lower()
    if not reg or brand_owner(reg):
        return None
    label = (u.domain_label or "").lower()
    label_tokens = _tokens(label)
    sub_tokens = _tokens(u.subdomain or "")
    est = is_established(reg)
    for brand, doms in GLOBAL_BRANDS.items():
        if not doms:
            continue
        if label == brand:
            if u.suffix in RISKY_TLDS or not est:
                return brand, f"'{brand}' with a different ending (.{u.suffix})"
            continue
        if est:
            continue  # a long-standing site whose name merely contains the word
        if brand in label_tokens and len(label_tokens) > 1:
            return brand, f"'{brand}' combined with other words"
        if brand not in TOKEN_ONLY:
            if len(brand) >= 6 and brand in label and label != brand:
                rest = label.replace(brand, "")
                if any(w.replace("-", "") in rest for w in LURE_WORDS) or len(rest) <= 4:
                    return brand, f"'{brand}' joined with '{rest}'"
            if len(brand) >= 6 and skeleton(label) == skeleton(brand):
                return brand, "look-alike characters"
            if len(brand) >= 7 and len(label) >= 6 and _dist1(label, brand):
                return brand, f"one character different from '{brand}'"
        in_sub = brand in sub_tokens or (len(brand) >= 6 and reg in FREE_HOSTS and brand in (u.subdomain or "").lower())
        if in_sub and (reg in FREE_HOSTS or u.suffix in RISKY_TLDS or not est):
            return brand, f"'{brand}' appears only in the subdomain; the real domain is {reg}"
    return None


def _dist1(a: str, b: str) -> bool:
    if abs(len(a) - len(b)) > 1 or a == b:
        return False
    if len(a) == len(b):
        diff = [i for i in range(len(a)) if a[i] != b[i]]
        return len(diff) == 1 or (len(diff) == 2 and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]])
    s, l = (a, b) if len(a) < len(b) else (b, a)
    return any(l[:i] + l[i + 1:] == s for i in range(len(l)))


def brand_in_path(u: ParsedUrl) -> str | None:
    """A brand name in the path or query of an unrelated site, next to login-type words."""
    reg = u.registrable_domain.lower()
    toks = set(_tokens(u.path + " " + u.query))
    lures = {w for w in LURE_WORDS if w.replace("-", "") in toks} | (toks & {"signin", "logon", "webscr", "auth", "wp-admin"})
    if not lures:
        return None
    for brand, doms in GLOBAL_BRANDS.items():
        if brand in toks and reg not in doms and len(brand) >= 4:
            return brand
    return None


def brand_owner_any(phrase: str) -> tuple[str, ...]:
    return TITLE_BRANDS.get(phrase, ())


def page_brand(page: PageFacts) -> str | None:
    t = page.title.lower()
    if not t:
        return None
    for phrase in sorted(TITLE_BRANDS, key=len, reverse=True):
        if re.search(rf"(?<![a-z]){re.escape(phrase)}(?![a-z])", t):
            return phrase
    return None


def reputation_evidence(u: ParsedUrl, idx: int, *, page: PageFacts | None, final: ParsedUrl | None,
                        age_days: int | None, dns_exists: bool | None) -> list[Evidence]:
    """URL-domain evidence from the key-free signals. Each is explained; none is proof alone."""
    ev: list[Evidence] = []
    reg = u.registrable_domain.lower()
    shown = reg or u.host

    def add(key: str, finding: str, why: str, status: EvidenceStatus, raw: dict | None = None,
            cat: Category = Category.url_domain, source: str = "RAQEEB reputation signals (offline)"):
        ev.append(Evidence(id=f"url{idx}.{key}", category=cat, finding=finding, why_it_matters=why, status=status,
                           source=source, raw={"url": u.url, **(raw or {})}))

    est = is_established(reg)
    lure = any(w in (u.host + u.path + u.query).lower() for w in LURE_WORDS)
    brand_hit = global_lookalike(u)
    path_brand = brand_in_path(u)
    on_free_host = reg in FREE_HOSTS
    young = age_days is not None and age_days < 180

    if est and not on_free_host:
        add("established", f"{shown} is a long-established, widely visited site (Tranco top 100,000).",
            "Large, long-running sites are rarely set up for scams. A page on one can still be misused, so other checks still count.",
            EvidenceStatus.unverified, {"established": True}, source="Tranco list (tranco-list.eu)")

    if u.suffix in RISKY_TLDS and not est and not on_free_host:
        strong = u.suffix in VERY_RISKY_TLDS or lure or brand_hit or path_brand
        add("risky-tld", f"The domain ends in .{u.suffix}, an ending heavily used in phishing.",
            "Cheap or free endings attract scammers who register many throwaway domains. Plenty of real sites use them too.",
            EvidenceStatus.suspicious if strong else EvidenceStatus.unverified, {"tld": u.suffix})

    if on_free_host:
        ipfs = reg in IPFS_HOSTS
        add("free-host",
            f"The page is hosted on {reg}" + (" (a public IPFS gateway)" if ipfs else ", a free hosting or tunnelling platform") +
            f", not on a domain of its own ({u.host}).",
            "Anyone can publish a page there in seconds without registering a domain, which is why scam pages use them.",
            EvidenceStatus.suspicious if (ipfs or lure or brand_hit or path_brand or (page and page.has_password))
            else EvidenceStatus.unverified, {"platform": reg})

    if on_free_host and machine_name(u.subdomain or ""):
        add("machine-name", f"The address {u.host} looks machine-generated (random parts, numbers or a date stamp).",
            "Phishing kits create throwaway pages on free platforms with generated names, then rotate them daily.",
            EvidenceStatus.suspicious, {"subdomain": u.subdomain, "weight": 2})

    if brand_hit:
        brand, how = brand_hit
        add(f"brand.{brand}", f"{u.host} imitates {BRAND_NAMES.get(brand, brand)} ({how}).",
            f"{BRAND_NAMES.get(brand, brand)}'s real sites are " + ", ".join(GLOBAL_BRANDS[brand][:3]) +
            ". Scammers register look-alike names to borrow a brand's trust.",
            EvidenceStatus.suspicious, {"brand": brand, "official": list(GLOBAL_BRANDS[brand])}, cat=Category.identity)
    elif path_brand:
        add(f"brand-path.{path_brand}", f"The link's path names {BRAND_NAMES.get(path_brand, path_brand)} on an unrelated site ({shown}).",
            "Phishing pages often live in a folder named after the brand they copy, on a hacked or throwaway site.",
            EvidenceStatus.suspicious, {"brand": path_brand, "weight": 2})

    if young and age_days is not None and age_days >= 30:
        add("young", f"{shown} was registered {age_days} days ago (less than 6 months).",
            "Most established organizations have had their domain for years. Young domains deserve extra care.",
            EvidenceStatus.unverified, {"age_days": age_days})

    if page:
        fin = final or u
        freg = fin.registrable_domain.lower()
        pb = page_brand(page)
        owners = TITLE_BRANDS.get(pb, ()) if pb else ()
        asks = [w for w, on in (("a password", page.has_password), ("card details", page.asks_card),
                                ("a one-time code", page.asks_otp)) if on]
        if pb and asks and freg not in owners and not is_established(freg):
            add("page-brand", f"The page is titled \"{page.title[:80]}\" and asks for {', '.join(asks)}, "
                f"but {freg} is not a {BRAND_NAMES.get(pb.split()[0], pb)} domain.",
                "A sign-in or payment form that copies a brand on someone else's domain is how credential theft works.",
                EvidenceStatus.suspicious, {"title": page.title, "brand": pb, "asks": asks}, cat=Category.identity,
                source="RAQEEB page check (static HTML, capped, never executed)")
        elif pb and freg not in owners and not is_established(freg) and freg not in brand_owner_any(pb) and                 (LOGIN_TITLE.search(page.title) or on_free_host or young or u.suffix in RISKY_TLDS):
            add("page-title-brand", f"The page calls itself \"{page.title[:80]}\", but {freg} is not a "
                f"{BRAND_NAMES.get(pb.split()[0], pb)} domain.",
                "Copying a brand's name onto a sign-in page on someone else's site is the core of phishing. "
                "(The form itself is often drawn by a script, so RAQEEB reads the page title.)",
                EvidenceStatus.suspicious, {"title": page.title, "brand": pb, "weight": 2},
                source="RAQEEB page check (static HTML, capped, never executed)")
        elif page.has_password and not is_established(freg) and                 (young or on_free_host or u.suffix in RISKY_TLDS or lure or LOGIN_TITLE.search(page.title)):
            add("page-login", f"The page asks for a password on {freg}, which shows other warning signs.",
                "Password forms on new, free-hosted or oddly named sites are a common phishing pattern.",
                EvidenceStatus.suspicious, {"title": page.title}, source="RAQEEB page check (static HTML, capped, never executed)")
        if page.external_form_hosts and (page.has_password or page.asks_card) and not is_established(freg):
            add("form-offsite", f"The page's form sends what you type to another site ({page.external_form_hosts[0]}).",
                "Phishing kits often post stolen details straight to a different server.",
                EvidenceStatus.suspicious, {"hosts": page.external_form_hosts})
        if page.client_redirect:
            try:
                from app.pipeline.extract import parse_url
                tgt = parse_url(page.client_redirect)
                if tgt.registrable_domain and tgt.registrable_domain != freg and not is_established(freg):
                    add("client-redirect", f"The page immediately forwards the browser to {tgt.registrable_domain} with a script or meta refresh.",
                        "Hidden forwarding is used to slip past link scanners and reach the real scam page.",
                        EvidenceStatus.suspicious, {"target": page.client_redirect}, cat=Category.context)
            except Exception:  # noqa: BLE001
                pass

    if dns_exists is False and (brand_hit or path_brand or (lure and u.suffix in RISKY_TLDS)):
        add("dead-scam-shaped", f"{shown} is offline now, but its name follows a scam pattern.",
            "Scam domains are taken down or rotated quickly. An offline link that imitates a brand is still a red flag.",
            EvidenceStatus.suspicious, {"dns_exists": False})
    return ev
