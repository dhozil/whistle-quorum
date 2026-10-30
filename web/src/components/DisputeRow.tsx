import type { Dispute, Match } from "../lib/types";
import { shortAddress, statusTone, voteLine, outcomeTone } from "../lib/format";
import { StatusChip } from "./ui";

interface Props {
  dispute: Dispute;
  match: Match | undefined;
  selected: boolean;
  onSelect: () => void;
}

export function DisputeRow({ dispute, match, selected, onSelect }: Props) {
  const outcome = dispute.final_outcome || dispute.outcome;

  return (
    <button
      className={`case ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="case__minute">
        {dispute.minute}′
        <small>{dispute.dispute_id.split("#")[1] ? `#${dispute.dispute_id.split("#")[1]}` : ""}</small>
      </span>
      <span className="case__main">
        <span className="case__meta">
          {match?.competition || dispute.match_id} · {dispute.incident_code.replace(/_/g, " ")}
        </span>
        <span className="case__teams">
          {match?.home_team || "Home"} <em>v</em> {match?.away_team || "Away"}
        </span>
        <span className="case__claim">{dispute.claim}</span>
        <span className="case__foot">
          <span className={`dot dot--${statusTone(dispute.status)}`} />
          {voteLine(dispute)}
          <span className="case__sep">·</span>
          filed by {shortAddress(dispute.filed_by)}
        </span>
      </span>
      <span className="case__side">
        <StatusChip status={dispute.status} />
        {outcome && (
          <span className={`case__outcome case__outcome--${outcomeTone(outcome)}`}>
            {outcome === "CLAIM_UPHELD"
              ? "Upheld"
              : outcome === "CLAIM_REJECTED"
                ? "Rejected"
                : "Inconclusive"}
          </span>
        )}
      </span>
    </button>
  );
}
