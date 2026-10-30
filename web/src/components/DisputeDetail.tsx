import { ExternalLink, FileText, ShieldAlert, Stamp, Gavel, ArrowUpRight } from "lucide-react";
import type { Dispute, Match, Rulebook } from "../lib/types";
import {
  domainOf,
  finalExplanation,
  formatGen,
  formatTimestamp,
  hoursLeft,
  label as titleCase,
  outcomeLabel,
  outcomeTone,
  shortAddress,
  timeAgo,
} from "../lib/format";
import { ConfidenceMeter, OutcomePill, StatusChip } from "./ui";

export type DeskAction =
  | "review"
  | "counter"
  | "appeal"
  | "reviewAppeal"
  | "finalize"
  | "settle";

interface Props {
  dispute: Dispute;
  match: Match | undefined;
  rulebook: Rulebook | undefined;
  address: string | null;
  admin: string | undefined;
  busy: string | null;
  onAction: (action: DeskAction, dispute: Dispute) => void;
}

function EvidenceList({ urls, evidenceHashes }: { urls: string[]; evidenceHashes?: { url: string; sha256: string }[] }) {
  if (!urls.length) return <p className="muted small">No artifacts submitted.</p>;
  return (
    <ul className="evidence">
      {urls.map((url, index) => {
        const hash = evidenceHashes?.find((item) => item.url === url)?.sha256;
        return (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              <span className="evidence__index">E{index + 1}</span>
              <span className="evidence__body">
                <span className="evidence__domain">{domainOf(url)}</span>
                <span className="evidence__url">{url}</span>
                {hash && <span className="evidence__hash mono">sha256 {hash.slice(0, 16)}…</span>}
              </span>
              <ExternalLink size={14} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function DisputeDetail({ dispute, match, rulebook, address, admin, busy, onAction }: Props) {
  const isFiler = address?.toLowerCase() === dispute.filed_by.toLowerCase();
  const isRespondent = address?.toLowerCase() === dispute.respondent.toLowerCase();
  const isParty = isFiler || isRespondent;
  const isAdmin = address?.toLowerCase() === admin?.toLowerCase();
  const now = Date.now() / 1000;
  const reviewReady = now >= dispute.review_after;
  const appealDeadline = dispute.reviewed_at + (rulebook?.appeal_window_seconds ?? 0);
  const appealOpen = dispute.status === "DECIDED" && now <= appealDeadline;
  const finalizeReady = dispute.status === "DECIDED" && now > appealDeadline;
  const outcome = dispute.final_outcome || dispute.outcome;
  const finalText = finalExplanation(dispute);
  const tone = outcomeTone(outcome);
  const stampText =
    dispute.reviewed_at === 0
      ? "Pending"
      : outcome === "CLAIM_UPHELD"
        ? "Upheld"
        : outcome === "CLAIM_REJECTED"
          ? "Rejected"
          : "No call";
  const pot = BigInt(dispute.filing_bond || "0") + BigInt(dispute.appeal_bond || "0");
  const fee =
    outcome === "INCONCLUSIVE" ? 0n : (pot * BigInt(rulebook?.fee_bps ?? 500)) / 10000n;

  const busyLabel = (action: DeskAction | null) => {
    if (!action || busy !== action) return null;
    if (action === "review" || action === "reviewAppeal") {
      return "Validators are independently re-running the review…";
    }
    return "Waiting for consensus…";
  };

  return (
    <div className="detail">
      <div className="detail__match">
        <div>
          <p className="kicker">
            {match?.competition || "Match"} · {dispute.dispute_id}
          </p>
          <h2 className="matchline">
            {match?.home_team || "Home"} <em>v</em> {match?.away_team || "Away"}
          </h2>
          <p className="detail__meta">
            Kickoff {match?.kickoff_iso || "—"} · incident {titleCase(dispute.incident_code)} ·{" "}
            {dispute.minute}′ · filed {timeAgo(dispute.created_at)}
          </p>
        </div>
        <div className="detail__status">
          <StatusChip status={dispute.status} />
          {match?.official_url && (
            <a className="mini-link" href={match.official_url} target="_blank" rel="noreferrer">
              Official page <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>

      <ol className="steps" aria-label="Case progress">
        <li className="is-done">
          <span>Filed</span>
          <small>{formatTimestamp(dispute.created_at)}</small>
        </li>
        <li className={dispute.reviewed_at ? "is-done" : ""}>
          <span>Reviewed</span>
          <small>{dispute.reviewed_at ? formatTimestamp(dispute.reviewed_at) : "pending"}</small>
        </li>
        {dispute.appealed_at > 0 && (
          <li className={dispute.finalized_at ? "is-done" : "is-current"}>
            <span>Appeal</span>
            <small>{dispute.appeal_result ? titleCase(dispute.appeal_result) : "under review"}</small>
          </li>
        )}
        <li className={dispute.finalized_at ? "is-done" : ""}>
          <span>Final</span>
          <small>{dispute.finalized_at ? formatTimestamp(dispute.finalized_at) : "not yet"}</small>
        </li>
        <li className={dispute.settled ? "is-done" : ""}>
          <span>Settled</span>
          <small>
            {dispute.settled
              ? BigInt(dispute.payout || "0") === 0n
                ? "refunded"
                : formatGen(dispute.payout)
              : "bonds held"}
          </small>
        </li>
      </ol>

      <section
        className="verdict-card"
        data-tone={tone}
      >
        <div className="verdict-card__bar">
          <span>
            <Stamp size={13} />{" "}
            {dispute.appeal_result
              ? "Decision on appeal"
              : dispute.reviewed_at === 0
                ? "Awaiting review"
                : "First-instance decision"}
          </span>
          <span className="mono">{dispute.dispute_id}</span>
        </div>

        {dispute.reviewed_at === 0 ? (
          <div className="verdict-card__empty">
            <p className="kicker">No decision yet</p>
            <h3>Waiting for the review desk</h3>
            <p>
              Once the counter-evidence window closes, anyone can trigger the review. Validators fetch the
              submitted artifacts, apply the rulebook, and must agree before the verdict is written.
            </p>
            {!reviewReady && (
              <p className="note">
                Review unlocks in {Math.max(0, Math.ceil((dispute.review_after - now) / 60))} minute(s).
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="verdict-card__main">
              <div className="verdict-card__find" data-stamp={stampText}>
                <p className="kicker">The panel finds</p>
                <h3 className="verdict-card__outcome">{outcomeLabel(outcome)}</h3>
                <p className="verdict-card__action">
                  Recommended action <strong>{titleCase(dispute.final_action || dispute.recommended_action)}</strong>
                </p>
              </div>
              <div className="verdict-card__stats">
                <div>
                  <span className="micro">Confidence</span>
                  <ConfidenceMeter value={dispute.confidence} />
                  <span className="mono small">{dispute.confidence}/100</span>
                </div>
                <div>
                  <span className="micro">Evidence</span>
                  <strong>{titleCase(dispute.evidence_quality || "—")}</strong>
                </div>
                <div>
                  <span className="micro">Incident</span>
                  <strong>{titleCase(dispute.incident_type || "—")}</strong>
                </div>
              </div>
            </div>

            {dispute.manipulation_suspected && (
              <p className="verdict-card__flag">
                <ShieldAlert size={15} /> Evidence contained text that tried to instruct the reviewer. It was
                treated as data, not as an instruction.
              </p>
            )}

            {dispute.appeal_result && (
              <p className="verdict-card__appeal" data-result={dispute.appeal_result.toLowerCase()}>
                <Gavel size={14} />
                <span>
                  Appeal <strong>{titleCase(dispute.appeal_result)}</strong>.{" "}
                  {dispute.appeal_result === "REVERSED"
                    ? "The new evidence met the clear-and-convincing standard and the first decision was overturned."
                    : "The first decision stands; the new evidence did not meet the clear-and-convincing standard."}
                </span>
              </p>
            )}

            <div className="verdict-card__cols">
              <div>
                <h4>
                  <FileText size={14} /> Findings {dispute.appealed_at > 0 && <span className="micro">first review</span>}
                </h4>
                {dispute.findings.length ? (
                  <ul className="findings">
                    {dispute.findings.map((finding, index) => (
                      <li key={index}>{finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No findings recorded.</p>
                )}
              </div>
              <div>
                <h4>
                  <Gavel size={14} /> Rulebook cited
                </h4>
                {dispute.rules_cited.length ? (
                  <ul className="cites">
                    {dispute.rules_cited.map((rule, index) => (
                      <li key={index}>“{rule}”</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No clauses cited.</p>
                )}
              </div>
            </div>

            {dispute.evidence_hashes.length > 0 && (
              <details className="hashes">
                <summary>
                  Evidence fingerprints <span className="mono">{dispute.evidence_hashes.length}</span>
                </summary>
                <ul>
                  {dispute.evidence_hashes.map((item) => (
                    <li key={item.sha256}>
                      <span className="mono">{item.sha256}</span>
                      <span className="muted">{domainOf(item.url)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <div className="detail__grid">
        <section className="block">
          <p className="kicker">The claim</p>
          <p className="claim-text">{dispute.claim}</p>
          <div className="parties">
            <div>
              <span className="micro">Filed by</span>
              <span className="mono">{shortAddress(dispute.filed_by, 6)}</span>
            </div>
            <div>
              <span className="micro">Respondent</span>
              <span className="mono">{shortAddress(dispute.respondent, 6)}</span>
            </div>
            <div>
              <span className="micro">Filing bond</span>
              <span className="mono">{formatGen(dispute.filing_bond)}</span>
            </div>
          </div>
        </section>

        <section className="block">
          <p className="kicker">Artifacts</p>
          <h4 className="block__sub">From the filing party</h4>
          <EvidenceList urls={dispute.evidence_urls} evidenceHashes={dispute.evidence_hashes} />
          <h4 className="block__sub">From the respondent</h4>
          <EvidenceList urls={dispute.counter_evidence_urls} evidenceHashes={dispute.evidence_hashes} />
          {dispute.counter_note && <p className="quote">“{dispute.counter_note}”</p>}
          {dispute.appeal_evidence_urls.length > 0 && (
            <>
              <h4 className="block__sub">New on appeal</h4>
              <EvidenceList urls={dispute.appeal_evidence_urls} evidenceHashes={dispute.evidence_hashes} />
              <p className="quote">“{dispute.appeal_grounds}”</p>
            </>
          )}
        </section>
      </div>

      {(dispute.finalized_at > 0 || dispute.settled) && (
        <section className="settlement">
          <div>
            <p className="kicker">Final outcome</p>
            {finalText && <p className="final-explanation">{finalText}</p>}
            <div className="settlement__row">
              <OutcomePill outcome={outcome} />
              {dispute.appeal_result && <span className="mono small">Appeal {dispute.appeal_result.toLowerCase()}</span>}
            </div>
          </div>
          <div className="settlement__money">
            <div>
              <span className="micro">Bond pot</span>
              <strong>{formatGen(pot)}</strong>
            </div>
            <div>
              <span className="micro">Winner</span>
              <strong className="mono">{dispute.winner === "0x0000000000000000000000000000000000000000" ? "no fault" : shortAddress(dispute.winner, 5)}</strong>
            </div>
            <div>
              <span className="micro">Payout</span>
              <strong>{dispute.payout === "0" ? "refunded" : formatGen(dispute.payout)}</strong>
            </div>
            <div>
              <span className="micro">Treasury fee</span>
              <strong>{fee === 0n ? "0" : formatGen(fee)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="actions">
        <div>
          <p className="kicker">Next move</p>
          <p className="muted small">
            {dispute.status === "FILED" && "Any account can trigger the review once the window closes."}
            {dispute.status === "DECIDED" &&
              (appealOpen
                ? `Either party may appeal until ${formatTimestamp(appealDeadline)} (${hoursLeft(appealDeadline)}h left).`
                : "The appeal window has closed. Finalize the decision, then settle the bonds.")}
            {dispute.status === "APPEALED" && "The appeal panel re-runs the review with new evidence and a higher burden."}
            {dispute.status === "FINAL" && "The decision is final. Settlement transfers the bonded pot."}
            {dispute.status === "SETTLED" && "Bonds have been distributed. Claim payouts from the wallet menu."}
          </p>
        </div>
        <div className="actions__buttons">
          {dispute.status === "FILED" && (
            <>
              {isRespondent && (
                <button className="btn btn--ghost" onClick={() => onAction("counter", dispute)} disabled={!!busy}>
                  Answer with evidence
                </button>
              )}
              <button
                className="btn btn--primary"
                onClick={() => onAction("review", dispute)}
                disabled={!reviewReady || !!busy || !address}
                title={!address ? "Connect a wallet to send transactions" : undefined}
              >
                {busy === "review" ? "Reviewing…" : "Run the review"}
              </button>
            </>
          )}
          {dispute.status === "DECIDED" && (
            <>
              {appealOpen && isParty && (
                <button className="btn btn--ghost" onClick={() => onAction("appeal", dispute)} disabled={!!busy}>
                  Appeal · {formatGen(rulebook?.appeal_bond ?? "0")}
                </button>
              )}
              {finalizeReady && (
                <button className="btn btn--primary" onClick={() => onAction("finalize", dispute)} disabled={!!busy}>
                  {busy === "finalize" ? "Finalizing…" : "Finalize decision"}
                </button>
              )}
              {!finalizeReady && !isParty && <span className="muted small">Waiting on the parties.</span>}
            </>
          )}
          {dispute.status === "APPEALED" && (
            <button className="btn btn--primary" onClick={() => onAction("reviewAppeal", dispute)} disabled={!!busy}>
              {busy === "reviewAppeal" ? "Reviewing appeal…" : "Review the appeal"}
            </button>
          )}
          {dispute.status === "FINAL" && (
            <button className="btn btn--primary" onClick={() => onAction("settle", dispute)} disabled={!!busy}>
              {busy === "settle" ? "Settling…" : "Settle bonds"}
            </button>
          )}
          {dispute.status === "SETTLED" && <span className="sealed">Bonds settled · case closed</span>}
          {isAdmin && dispute.status !== "SETTLED" && <span className="admin-tag">Judge</span>}
        </div>
        {busyLabel(busy as DeskAction | null) && <p className="busy-line">{busyLabel(busy as DeskAction | null)}</p>}
      </section>
    </div>
  );
}
