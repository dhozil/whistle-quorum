import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, RefreshCw } from "lucide-react";
import type { Dispute, Match, Rulebook, Stats } from "../lib/types";
import { formatGen, timeAgo } from "../lib/format";
import { DisputeRow } from "./DisputeRow";
import { DisputeDetail, type DeskAction } from "./DisputeDetail";
import { EmptyState, ErrorNote, Spinner } from "./ui";

interface Props {
  stats: Stats | null;
  disputes: Dispute[];
  matches: Match[];
  rulebooks: Rulebook[];
  address: string | null;
  loading: boolean;
  error: string | null;
  lastLoaded: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onFile: () => void;
  onCreateMatch: () => void;
  busy: string | null;
  onAction: (action: DeskAction, dispute: Dispute) => void;
}

type FilterKey = "all" | "open" | "decided" | "final";

function DeskClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="mono">{now.toISOString().slice(11, 19)} UTC</span>;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "decided", label: "Decided" },
  { key: "final", label: "Final" },
];

export function DeskView({
  stats,
  disputes,
  matches,
  rulebooks,
  address,
  loading,
  error,
  lastLoaded,
  selectedId,
  onSelect,
  onRefresh,
  onFile,
  onCreateMatch,
  busy,
  onAction,
}: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "open") return disputes.filter((d) => d.status === "FILED" || d.status === "APPEALED");
    if (filter === "decided") return disputes.filter((d) => d.status === "DECIDED");
    if (filter === "final") return disputes.filter((d) => d.status === "FINAL" || d.status === "SETTLED");
    return disputes;
  }, [disputes, filter]);

  const selected =
    disputes.find((item) => item.dispute_id === selectedId) ?? disputes[0] ?? null;
  const selectedMatch = selected ? matches.find((match) => match.match_id === selected.match_id) : undefined;
  const selectedRulebook = selectedMatch
    ? rulebooks.find((rulebook) => rulebook.rulebook_id === selectedMatch.rulebook_id)
    : undefined;

  const open = disputes.filter((d) => d.status === "FILED" || d.status === "APPEALED").length;
  const reviewed = disputes.filter((d) => d.status !== "FILED").length;
  const isAdmin = address?.toLowerCase() === stats?.admin.toLowerCase();
  const isRep = matches.some(
    (match) =>
      match.home_rep.toLowerCase() === address?.toLowerCase() ||
      match.away_rep.toLowerCase() === address?.toLowerCase(),
  );

  return (
    <section className="desk">
      <div className="desk__head">
        <div className="desk__copy">
          <p className="kicker">
            <span className="live-dot" /> On-chain match review · StudioNet
          </p>
          <h1>
            Every disputed call
            <br />
            gets a <em>replay.</em>
          </h1>
          <p className="lede">
            Independent validators fetch the public evidence, apply a written rulebook, and settle bonded disputes.
            The verdict, the reasoning, and the money are all on the record.
          </p>
          <div className="desk__cta">
            <button className="btn btn--primary" onClick={onFile} disabled={!address}>
              <Plus size={15} /> File a dispute
            </button>
            {isAdmin && (
              <button className="btn btn--ghost" onClick={onCreateMatch}>
                Create fixture
              </button>
            )}
            <span className="desk__hint">
              {address
                ? isRep
                  ? "This wallet is a registered representative."
                  : "This wallet can review and settle, but not file."
                : "Connect a wallet to file, review, or settle."}
            </span>
          </div>
        </div>

        <div className="scoreboard">
          <div className="scoreboard__head">
            <span>Match desk</span>
            <DeskClock />
          </div>
          <div className="scoreboard__grid">
            <div className="score">
              <span className="score__value">{open}</span>
              <span className="score__label">Open cases</span>
            </div>
            <div className="score">
              <span className="score__value">{reviewed}</span>
              <span className="score__label">Verdicts written</span>
            </div>
            <div className="score">
              <span className="score__value">{stats?.settled ?? 0}</span>
              <span className="score__label">Settled</span>
            </div>
            <div className="score">
              <span className="score__value score__value--sm">
                {formatGen(stats?.volume_wei ?? "0", 2).replace(" GEN", "")}
              </span>
              <span className="score__label">GEN bonded</span>
            </div>
          </div>
          <div className="scoreboard__foot">
            <span>{stats?.disputes ?? 0} cases on chain</span>
            <span className="mono">{stats ? `${stats.matches} fixtures` : "—"}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="banner">
          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn--ghost btn--sm" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      <div className="desk__body">
        <aside className="list-pane">
          <header className="list-pane__head">
            <div>
              <p className="kicker">Case files</p>
              <h2>
                Disputes <span className="mono">{disputes.length}</span>
              </h2>
            </div>
            <button
              className="icon-btn"
              onClick={onRefresh}
              aria-label="Refresh cases"
              title={`Updated ${lastLoaded ? timeAgo(lastLoaded / 1000) : "—"}`}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          </header>

          <div className="filters" role="tablist" aria-label="Filter cases">
            <Filter size={12} />
            {FILTERS.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={filter === item.key}
                className={filter === item.key ? "is-active" : ""}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="case-list">
            {loading && disputes.length === 0 && (
              <div className="loading">
                <Spinner /> Reading the record…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <EmptyState
                title={disputes.length ? "No cases in this view" : "The desk is quiet"}
                body={
                  disputes.length
                    ? "Switch the filter to see the rest of the record."
                    : "A fixture is registered by the judge, then a team representative files the first dispute with a bond and public evidence."
                }
                action={
                  !disputes.length ? (
                    <button className="btn btn--ghost btn--sm" onClick={onFile} disabled={!address}>
                      File the first dispute
                    </button>
                  ) : undefined
                }
              />
            )}
            {filtered.map((dispute) => (
              <DisputeRow
                key={dispute.dispute_id}
                dispute={dispute}
                match={matches.find((match) => match.match_id === dispute.match_id)}
                selected={selected?.dispute_id === dispute.dispute_id}
                onSelect={() => onSelect(dispute.dispute_id)}
              />
            ))}
          </div>
        </aside>

        <main className="detail-pane">
          {selected ? (
            <DisputeDetail
              dispute={selected}
              match={selectedMatch}
              rulebook={selectedRulebook}
              address={address}
              admin={stats?.admin}
              busy={busy}
              onAction={onAction}
            />
          ) : (
            <EmptyState
              title="Pick a case file"
              body="Select a dispute to see the evidence packet, the panel’s findings, and the next move."
            />
          )}
        </main>
      </div>
    </section>
  );
}
