export type DisputeStatus = "FILED" | "DECIDED" | "APPEALED" | "FINAL" | "SETTLED";
export type Outcome = "CLAIM_UPHELD" | "CLAIM_REJECTED" | "INCONCLUSIVE" | "";

export interface Stats {
  rulebooks: number;
  matches: number;
  disputes: number;
  settled: number;
  volume_wei: string;
  admin: string;
  treasury: string;
}

export interface Rulebook {
  rulebook_id: string;
  sport: string;
  title: string;
  rules_text: string;
  allowed_domains: string;
  filing_bond: string;
  appeal_bond: string;
  min_confidence: number;
  min_sources: number;
  counter_window_seconds: number;
  appeal_window_seconds: number;
  fee_bps: number;
}

export interface Match {
  match_id: string;
  rulebook_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  home_rep: string;
  away_rep: string;
  kickoff_iso: string;
  official_url: string;
  created_at: number;
}

export interface EvidenceHash {
  url: string;
  sha256: string;
}

export interface Dispute {
  dispute_id: string;
  match_id: string;
  filed_by: string;
  respondent: string;
  incident_code: string;
  minute: number;
  claim: string;
  evidence_urls: string[];
  counter_evidence_urls: string[];
  counter_note: string;
  status: DisputeStatus;
  filing_bond: string;
  created_at: number;
  review_after: number;
  outcome: Outcome;
  incident_type: string;
  recommended_action: string;
  confidence: number;
  evidence_quality: string;
  findings: string[];
  rules_cited: string[];
  evidence_hashes: EvidenceHash[];
  manipulation_suspected: boolean;
  reviewed_at: number;
  appealed_by: string;
  appeal_grounds: string;
  appeal_evidence_urls: string[];
  appeal_bond: string;
  appealed_at: number;
  appeal_result: string;
  final_outcome: Outcome;
  final_action: string;
  finalized_at: number;
  winner: string;
  payout: string;
  settled: boolean;
}

export interface Reputation {
  account: string;
  disputes_filed: number;
  wins: number;
  losses: number;
  appeals_won: number;
  appeals_lost: number;
}
