import type { Dispute, Outcome } from "./types";

export const GEN = 10n ** 18n;

export function shortAddress(value: string, size = 4): string {
  if (!value || value.length < 12) return value || "—";
  if (/^0x0{40}$/i.test(value)) return "none";
  return `${value.slice(0, 2 + size)}…${value.slice(-size)}`;
}

export function formatGen(wei: string | bigint, digits = 3): string {
  const value = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = value / GEN;
  const fraction = value % GEN;
  if (fraction === 0n) return `${whole} GEN`;
  const padded = fraction.toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return padded ? `${whole}.${padded} GEN` : `${whole} GEN`;
}

export function parseGen(value: string): bigint {
  const clean = value.trim().replace(/,/g, ".");
  if (!/^\d+(\.\d{0,18})?$/.test(clean)) {
    throw new Error("Enter an amount like 1 or 0.25");
  }
  const [whole, fraction = ""] = clean.split(".");
  return BigInt(whole) * GEN + BigInt(fraction.padEnd(18, "0"));
}

export function formatTimestamp(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(seconds: number): string {
  if (!seconds) return "—";
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export function hoursLeft(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now() / 1000) / 3600));
}

export function label(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function outcomeLabel(outcome: Outcome | string): string {
  if (outcome === "CLAIM_UPHELD") return "Claim upheld";
  if (outcome === "CLAIM_REJECTED") return "Claim rejected";
  if (outcome === "INCONCLUSIVE") return "Inconclusive";
  return "Awaiting review";
}

export function outcomeTone(outcome: Outcome | string): "upheld" | "rejected" | "open" {
  if (outcome === "CLAIM_UPHELD") return "upheld";
  if (outcome === "CLAIM_REJECTED") return "rejected";
  return "open";
}

export function statusTone(status: Dispute["status"]): string {
  return status.toLowerCase();
}

export function voteLine(dispute: Dispute): string {
  if (dispute.status === "FILED") return "Waiting for review";
  if (dispute.status === "APPEALED") return "Appeal under review";
  if (dispute.final_outcome) return outcomeLabel(dispute.final_outcome);
  return outcomeLabel(dispute.outcome);
}

export function feeLabel(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/**
 * Final, user-facing explanation of the settled verdict, in Bahasa Indonesia.
 * Rendered once the dispute reaches FINAL (or stays FINAL through an appeal)
 * and whenever the case is SETTLED.
 */
export function finalExplanation(dispute: Dispute): string {
  const outcome = dispute.final_outcome || dispute.outcome;
  if (dispute.status === "SETTLED") {
    if (outcome === "INCONCLUSIVE") {
      return "Final explanation: the panel assessed the submitted evidence as insufficient to determine whether the incident occurred. Because no fault could be proven from that evidence, both parties refunded their bonds and the case was closed with no winner.";
    }
    const upheld = outcome === "CLAIM_UPHELD";
    const action = dispute.final_action || dispute.recommended_action;
    return `Final explanation: based on the evidence validated by the panel, the final decision concluded that the claim was ${upheld ? "upheld" : "rejected"}. The applied action was ${action}. After settlement, the potential prize bond was disbursed according to the final result.`;
  }
  if (dispute.status === "FINAL") {
    if (outcome === "INCONCLUSIVE") {
      return "Final explanation: the final decision after the appeal review stated that the available evidence was insufficient to determine which party was right. No party won; both bonds were returned to the party that filed the claim.";
    }
    const stance = outcome === "CLAIM_UPHELD" ? "upheld" : "rejected";
    const action = dispute.final_action || dispute.recommended_action;
    return `Final explanation: the final decision after the appeal review concluded that the original claim was ${stance}. The final action that applied was ${action}.`;
  }
  return "";
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
