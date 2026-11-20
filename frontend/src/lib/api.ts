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

export type RiskBand = "Low Risk" | "Moderate Risk" | "High Risk" | "Unknown Risk";

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
  type: "url" | "message" | "screenshot";
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
}

export type InvestigateRequest =
  | { type: "message"; message: string }
  | { type: "url"; url: string };

export async function investigate(req: InvestigateRequest): Promise<InvestigationResult> {
  const res = await fetch("/api/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = `The investigation failed (HTTP ${res.status}).`;
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
