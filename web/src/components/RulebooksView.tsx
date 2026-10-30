import { Plus, Scale } from "lucide-react";
import type { Rulebook } from "../lib/types";
import { feeLabel, formatGen } from "../lib/format";
import { EmptyState } from "./ui";

interface Props {
  rulebooks: Rulebook[];
  address: string | null;
  admin: string | undefined;
  onOpenCreate: () => void;
}

export function RulebooksView({ rulebooks, address, admin, onOpenCreate }: Props) {
  const isAdmin = address?.toLowerCase() === admin?.toLowerCase();

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <p className="kicker">The law on chain</p>
          <h1>Rulebooks</h1>
          <p className="lede">
            A rulebook is the contract’s source of truth: the clauses, the evidence standards, the bonds, and the
            windows. Federations can register their own; the panel may not invent rules outside it.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn--primary" onClick={onOpenCreate}>
            <Plus size={15} /> Register rulebook
          </button>
        )}
      </div>

      {rulebooks.length === 0 ? (
        <EmptyState title="No rulebooks" body="Register the first rulebook to open the desk." />
      ) : (
        <div className="rules-grid">
          {rulebooks.map((rulebook) => (
            <article key={rulebook.rulebook_id} className="rule-card">
              <div className="rule-card__head">
                <span className="rule-card__sport">{rulebook.sport}</span>
                <span className="mono small">{rulebook.rulebook_id}</span>
              </div>
              <h3>{rulebook.title}</h3>
              <p className="rule-card__text">{rulebook.rules_text}</p>

              <dl className="rule-card__specs">
                <div>
                  <dt>Filing bond</dt>
                  <dd>{formatGen(rulebook.filing_bond)}</dd>
                </div>
                <div>
                  <dt>Appeal bond</dt>
                  <dd>{formatGen(rulebook.appeal_bond)}</dd>
                </div>
                <div>
                  <dt>Min confidence</dt>
                  <dd>{rulebook.min_confidence}/100</dd>
                </div>
                <div>
                  <dt>Distinct sources</dt>
                  <dd>{rulebook.min_sources}</dd>
                </div>
                <div>
                  <dt>Answer window</dt>
                  <dd>{Math.round(rulebook.counter_window_seconds / 60)} min</dd>
                </div>
                <div>
                  <dt>Appeal window</dt>
                  <dd>{Math.round(rulebook.appeal_window_seconds / 3600)} h</dd>
                </div>
                <div>
                  <dt>Treasury fee</dt>
                  <dd>{feeLabel(rulebook.fee_bps)}</dd>
                </div>
                <div>
                  <dt>Evidence hosts</dt>
                  <dd className="mono">{rulebook.allowed_domains || "any public https"}</dd>
                </div>
              </dl>

              <p className="rule-card__note">
                <Scale size={14} /> A verdict below the confidence or source threshold is downgraded to INCONCLUSIVE
                by the contract, not by the model.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
