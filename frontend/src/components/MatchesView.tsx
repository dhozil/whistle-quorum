import { CalendarDays, ExternalLink, Plus, Scale } from "lucide-react";
import type { Dispute, Match, Rulebook } from "../lib/types";
import { shortAddress } from "../lib/format";
import { EmptyState } from "./ui";

interface Props {
  matches: Match[];
  rulebooks: Rulebook[];
  disputes: Dispute[];
  address: string | null;
  onOpenCreate: () => void;
  onFile: (match?: Match) => void;
  onOpenDispute: (dispute: Dispute) => void;
}

export function MatchesView({
  matches,
  rulebooks,
  disputes,
  address,
  onOpenCreate,
  onFile,
  onOpenDispute,
}: Props) {
  return (
    <section className="page">
      <div className="page__head">
        <div>
          <p className="kicker">Fixtures on the record</p>
          <h1>Registered fixtures</h1>
          <p className="lede">
            Every fixture pins a rulebook and two representative wallets. Only those wallets can file or answer a
            dispute for that match.
          </p>
        </div>
        <button className="btn btn--primary" onClick={onOpenCreate}>
          <Plus size={15} /> Create fixture
        </button>
      </div>

      {matches.length === 0 ? (
        <EmptyState
          title="No fixtures yet"
          body="Anyone can register a fixture; registered representatives then file disputes from it. Connect a wallet to create the first one."
        />
      ) : (
        <div className="fixtures">
          {matches.map((match) => {
            const rulebook = rulebooks.find((item) => item.rulebook_id === match.rulebook_id);
            const related = disputes.filter((item) => item.match_id === match.match_id);
            const isRep =
              address?.toLowerCase() === match.home_rep.toLowerCase() ||
              address?.toLowerCase() === match.away_rep.toLowerCase();
            return (
              <article key={match.match_id} className="fixture">
                <div className="fixture__top">
                  <span className="fixture__id mono">{match.match_id}</span>
                  <span className="fixture__comp">{match.competition}</span>
                  <span className="fixture__rule mono">{match.rulebook_id}</span>
                </div>
                <h3 className="fixture__teams">
                  {match.home_team} <em>v</em> {match.away_team}
                </h3>
                <div className="fixture__meta">
                  <span>
                    <CalendarDays size={13} /> {match.kickoff_iso || "kickoff not set"}
                  </span>
                  <span>
                    <Scale size={13} /> {rulebook?.title ?? "Unknown rulebook"}
                  </span>
                  {match.official_url && (
                    <a href={match.official_url} target="_blank" rel="noreferrer">
                      Official page <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="fixture__reps">
                  <span>
                    <span className="micro">Home rep</span>
                    <span className="mono">{shortAddress(match.home_rep, 5)}</span>
                  </span>
                  <span>
                    <span className="micro">Away rep</span>
                    <span className="mono">{shortAddress(match.away_rep, 5)}</span>
                  </span>
                </div>
                <div className="fixture__foot">
                  <div className="fixture__cases">
                    {related.length === 0 ? (
                      <span className="muted small">No disputes filed.</span>
                    ) : (
                      related.map((dispute) => (
                        <button key={dispute.dispute_id} className="case-link" onClick={() => onOpenDispute(dispute)}>
                          {dispute.dispute_id} · {dispute.minute}′ · {dispute.status.toLowerCase()}
                        </button>
                      ))
                    )}
                  </div>
                  {isRep && (
                    <button className="btn btn--ghost btn--sm" onClick={() => onFile(match)}>
                      File a dispute
                    </button>
                  )}
                  {!isRep && address && <span className="muted small">Rep wallets only</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
