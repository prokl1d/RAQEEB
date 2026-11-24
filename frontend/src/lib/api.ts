// Typed client for the RAQEEB backend (mirrors backend/app models).

export type EvidenceStatus =
  | "confirmed"
  | "suspicious"
  | "verified"
  | "unverified"
  | "contradictory"
  | "missing";

export type Category = "threat_intel" | "identity" | "url_domain" | "content" | "context";

export interface Evidence {
  id: string;
  category: Category;
  finding: string;
  why_it_matters: string;
  status: EvidenceStatus;
  source: string;
  raw: Record<string, unknown>;
}

export type RiskBand =
  | "Likely Safe"
  | "Low Risk"
  | "Inactive Link"
  | "Moderate Risk"
  | "High Risk"
  | "Unknown Risk";

export interface CategoryScore {
  category: Category;
  label: string;
  weight: number;
  applicable: boolean;
  covered: boolean;
  risk: number | null;
  contribution: number;
  reason: string;
}

export interface ScoreResult {
  score: number;
  band: RiskBand;
  coverage: number;
  low_confidence: boolean;
  categories: CategoryScore[];
  overrides: string[];
  contradictions: string[];
}

export type IdentityOutcome =
  | "Verified Match"
  | "Possible Impersonation"
  | "No Verified Relationship Found"
  | "Unable to Verify";

export interface InvestigationResult {
  type: "url" | "message" | "call" | "screenshot";
  check_mode: "live" | "fixture" | "disabled";
  urls: { url: string; host: string; registrable_domain: string; final_url: string | null }[];
  identity: {
    outcome: IdentityOutcome;
    summary: string;
    claimed: { id: string; name: string; category: string; official_domains: string[]; verified: boolean }[];
  };
  evidence: Evidence[];
  score: ScoreResult;
  ai: {
    provider: string;
    available: boolean;
    explanation: {
      summary: string;
      points: { evidence_id: string; explanation: string }[];
      recommended_actions: string[];
    } | null;
    error: string | null;
    masked_items: Record<string, number>;
    sent_to_external_ai: boolean;
  };
  disclosures: { service: string; received: string }[];
  pending: string[];
  call: CallInsight | null;
}

export interface OfficialContact {
  org_id: string;
  org_name: string;
  phones: string[];
  domains: string[];
  source: string | null;
}

export interface CallInsight {
  claimed: string[];
  asked_for: string[];
  pressure: string[];
  contacts: OfficialContact[];
}

export type InvestigateRequest =
  | { type: "message"; message: string }
  | { type: "call"; message: string }
  | { type: "url"; url: string };

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `The request failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const investigate = (req: InvestigateRequest) => request<InvestigationResult>("/api/investigate", req);

// ---------- Search Shield ----------

export type LinkVerdict = "official" | "listed" | "impersonation" | "caution" | "unknown" | "invalid";

export interface LinkCheck {
  input: string;
  domain: string | null;
  host: string | null;
  verdict: LinkVerdict;
  org_id: string | null;
  org_name: string | null;
  official_domain: string | null;
  match: string | null;
  detail: string | null;
  flags: string[];
  source: string | null;
}

export interface SearchDemo {
  sample: boolean;
  note: string;
  queries: {
    id: string;
    query: string;
    query_ar: string;
    results: { title: string; url: string; snippet: string; sponsored: boolean; check: LinkCheck }[];
  }[];
}

export const checkLinks = (links: string[]) => request<LinkCheck[]>("/api/check-links", { links });
export const getSearchDemo = () => request<SearchDemo>("/api/search-demo");

// ---------- Business listing check ----------

export type ListingBand = "likely_safe" | "low" | "moderate" | "high" | "needs_verification";

export interface ListingInput {
  name: string;
  phone?: string;
  website?: string;
  address?: string;
}

export interface ListingCheckItem {
  key: "name" | "website" | "phone" | "address";
  status: "ok" | "warn" | "bad" | "missing";
  params: Record<string, unknown>;
  source: string | null;
}

export interface ListingResult {
  score: number;
  band: ListingBand;
  coverage: number;
  claimed: string | null;
  claimed_id: string | null;
  official_phones: string[];
  official_domains: string[];
  phone_source: string | null;
  checks: ListingCheckItem[];
  website: LinkCheck | null;
  overrides: string[];
}

export interface DemoListing {
  id: string;
  label: string;
  label_ar: string;
  listing: ListingInput;
}

export const checkListing = (inp: ListingInput) => request<ListingResult>("/api/check-listing", inp);
export const getListingDemo = () => request<DemoListing[]>("/api/listing-demo");

// ---------- Early warning ----------

export type EarlyRisk = "high" | "watch" | "low" | "parked" | "defensive";

export interface EarlyCandidate {
  domain: string;
  sources: ("permutation" | "certificate")[];
  resolves: boolean | null;
  ips: string[];
  cert_first_seen: string | null;
  cert_days_ago: number | null;
  match: string;
  risk: EarlyRisk;
  redirects_to: string | null;
  reasons: string[];
}

export interface EarlyWarningResult {
  org_id: string;
  org_name: string;
  official_domains: string[];
  checked_permutations: number;
  certificate_search: string;
  candidates: EarlyCandidate[];
  fixture: boolean;
  generated_utc: string;
}

export const getEarlyWarning = (orgId: string) => request<EarlyWarningResult>(`/api/early-warning/${encodeURIComponent(orgId)}`);
