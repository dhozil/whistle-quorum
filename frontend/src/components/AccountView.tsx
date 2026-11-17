import { Coins, ExternalLink, User, Wallet } from "lucide-react";
import type { Dispute, Match, Reputation } from "../lib/types";
import { formatGen, label, shortAddress } from "../lib/format";
import { EmptyState, OutcomePill, StatusChip } from "./ui";

interface Props {
  address: string | null;
  claimable: string;
  reputation: Reputation | null;
  disputes: Dispute[];
  matches: Match[];
  onConnect: () => void;
  onWithdraw: () => void;
  withdrawing: boolean;
  onOpenDispute: (dispute: Dispute) => void;
}

export function AccountView({
  address,
  claimable,
  reputation,
  disputes,
  matches,
  onConnect,
  onWithdraw,
  withdrawing,
  onOpenDispute,
}: Props) {
  if (!address) {
    return (
      <section className="page">
        <div className="page__head">
          <div>
            <p className="kicker">Participant dashboard</p>
            <h1>My account</h1>
            <p className="lede">Connect a wallet to see your on-chain reputation, claimable payouts, and cases you are involved in.</p>
          </div>
        </div>
        <EmptyState
          title="No wallet connected"
          body="Connect a wallet to view your bonded activity and withdraw any claimable balance."
          action={
            <button className="btn btn--primary" onClick={onConnect}>
              <Wallet size={15} /> Connect wallet
            </button>
          }
        />
      </section>
    );
  }

  const addr = address.toLowerCase();
  const mine = disputes.filter(
    (d) => d.filed_by.toLowerCase() === addr || d.respondent.toLowerCase() === addr || d.appealed_by.toLowerCase() === addr,
  );
  const claim = BigInt(claimable || "0");

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <p className="kicker">Participant dashboard</p>
          <h1>My account</h1>
          <p className="lede">
            On-chain reputation and bonded outcomes for <span className="mono">{shortAddress(address, 6)}</span>.
          </p>
        </div>
      </div>

      <div className="account-grid">
        <section className="panel">
          <h3><User size={15} /> Reputation</h3>
          <div className="account-stats">
            <div>
              <span className="micro">Filed</span>
              <strong>{reputation?.disputes_filed ?? 0}</strong>
            </div>
            <div>
              <span className="micro">Wins</span>
              <strong>{reputation?.wins ?? 0}</strong>
            </div>
            <div>
              <span className="micro">Losses</span>
              <strong>{reputation?.losses ?? 0}</strong>
            </div>
            <div>
              <span className="micro">Appeals won</span>
              <strong>{reputation?.appeals_won ?? 0}</strong>
            </div>
            <div>
              <span className="micro">Appeals lost</span>
              <strong>{reputation?.appeals_lost ?? 0}</strong>
            </div>
          </div>
          <p className="panel__note">Reputation is recorded on-chain from dispute outcomes and appeal results.</p>
        </section>

        <section className="panel panel--claim">
          <h3><Coins size={15} /> Claimable balance</h3>
          <p className="claim-amount">{formatGen(claimable)}</p>
          <p className="muted small">Settled payouts and refunded bonds credited to this wallet.</p>
          <button className="btn btn--primary" onClick={onWithdraw} disabled={withdrawing || claim === 0n}>
            {withdrawing ? "Withdrawing…" : "Withdraw to wallet"}
          </button>
          {claim === 0n && <p className="panel__note">Nothing to withdraw right now.</p>}
        </section>
      </div>

      <section className="block" style={{ marginTop: 18 }}>
        <p className="kicker">My cases</p>
        <h3 style={{ margin: "6px 0 12px", fontFamily: "var(--display)", fontSize: 28, textTransform: "uppercase" }}>
          Cases involving this wallet <span className="mono">{mine.length}</span>
        </h3>
        {mine.length === 0 ? (
          <p className="muted">No disputes filed by or against this wallet yet.</p>
        ) : (
          <div className="account-cases">
            {mine.map((dispute) => {
              const match = matches.find((m) => m.match_id === dispute.match_id);
              const role = dispute.filed_by.toLowerCase() === addr ? "Filer" : dispute.respondent.toLowerCase() === addr ? "Respondent" : "Appellant";
              const outcome = dispute.final_outcome || dispute.outcome;
              return (
                <button key={dispute.dispute_id} className="account-case" onClick={() => onOpenDispute(dispute)}>
                  <div className="account-case__top">
                    <span className="mono small">{dispute.dispute_id}</span>
                    <StatusChip status={dispute.status} />
                  </div>
                  <div className="account-case__main">
                    <strong>{match ? `${match.home_team} v ${match.away_team}` : dispute.match_id}</strong>
                    <span className="muted small">{label(dispute.incident_code)} · {dispute.minute}′ · Role: {role}</span>
                  </div>
                  <div className="account-case__foot">
                    {outcome ? <OutcomePill outcome={outcome} /> : <span className="muted small">Awaiting verdict</span>}
                    <span className="mini-link">Open <ExternalLink size={12} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
