import { ArrowUpRight, Check, Copy, Link2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "../lib/genlayer";

const STEPS = [
  {
    title: "The judge registers the fixture",
    body: "A fixture pins the rulebook, the competition, and two representative wallets. Only those wallets can file or answer for that match. Anyone can read the fixture.",
  },
  {
    title: "A representative files, with skin in the game",
    body: "The filing party posts the rulebook's bond and submits the claim plus public HTTPS evidence: image frames, an official report page, or a public data URL. The claim and every artifact are stored on chain.",
  },
  {
    title: "The other side answers",
    body: "The respondent can add counter-evidence and a short note during the answer window. Both packets go to the panel together — no side gets the last word before review.",
  },
  {
    title: "Validators review independently",
    body: "The contract fetches the evidence itself, hashes every artifact, and asks an LLM to apply the rulebook. Every validator re-fetches the same URLs and re-runs the analysis. They must agree on the outcome, the incident type, and the recommended action.",
  },
  {
    title: "Either party can appeal — once, with something new",
    body: "An appeal requires at least one URL that was not in the first record and a higher bond. The panel applies a clear-and-convincing standard: the first decision stands unless the new evidence shows a material error.",
  },
  {
    title: "Finality, then settlement",
    body: "If nobody appeals before the window closes, anyone can finalize. Settlement pays the pot to the winning side, takes the treasury fee, updates reputation, and credits a claimable balance that the winner withdraws.",
  },
];

export function GuideView() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="page guide">
      <div className="page__head">
        <div>
          <p className="kicker">How the desk works</p>
          <h1>A replay, not a rubber stamp</h1>
          <p className="lede">
            Whistle Quorum is an adjudication protocol for disputed officiating calls. The decision, the reasoning,
            the evidence fingerprints, and the money all live in one contract.
          </p>
        </div>
      </div>

      <div className="guide__grid">
        <ol className="guide__steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="guide__num">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <aside className="guide__side">
          <div className="panel">
            <h3>
              <ShieldCheck size={16} /> What the panel actually sees
            </h3>
            <ul className="ticks">
              <li>
                <Check size={13} /> Up to 4 image frames (JPEG, PNG, WebP, GIF; 2 MB each)
              </li>
              <li>
                <Check size={13} /> Text from public report or data pages, capped at 3,500 characters each
              </li>
              <li>
                <Check size={13} /> The rulebook, the claim, the response, and the standard of review
              </li>
              <li>
                <Check size={13} /> A SHA-256 fingerprint of every artifact it read
              </li>
            </ul>
            <p className="panel__note">
              Video is not decoded on chain. A dispute is only as good as the frames and pages submitted. If the
              decisive moment is not in the packet, the correct verdict is INCONCLUSIVE.
            </p>
          </div>

          <div className="panel">
            <h3>
              <Link2 size={16} /> Trust boundaries
            </h3>
            <ul className="ticks">
              <li>
                <Check size={13} /> Evidence is untrusted data; embedded instructions are flagged and ignored
              </li>
              <li>
                <Check size={13} /> Low confidence, too few sources, or weak evidence downgrades to INCONCLUSIVE
                deterministically
              </li>
              <li>
                <Check size={13} /> Settlement is deterministic: no model output touches the payout arithmetic
              </li>
              <li>
                <Check size={13} /> A model can still misread a frame. Bonds and appeals price that risk; they do not
                erase it.
              </li>
            </ul>
          </div>

          <div className="panel panel--contract">
            <p className="kicker">Deployed contract</p>
            <code>{CONTRACT_ADDRESS}</code>
            <div className="panel__actions">
              <button className="btn btn--ghost btn--sm" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy address"}
              </button>
              <a
                className="btn btn--ghost btn--sm"
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                Explorer <ArrowUpRight size={13} />
              </a>
            </div>
            <p className="panel__note">
              StudioNet · chain 61999. Reads are public. Writes need a browser wallet; the contract holds bonds, so
              use test funds only.
            </p>
          </div>
        </aside>
      </div>

      <section className="guide__faq">
        <h2>Questions judges ask</h2>
        <div className="faq">
          <details>
            <summary>Why not just let a single AI decide?</summary>
            <p>
              A single model is a single point of failure. GenLayer’s equivalence principle asks validators to
              independently reproduce the same decision; only structured fields are compared, so different wording
              does not break consensus. If they cannot agree, the transaction does not settle.
            </p>
          </details>
          <details>
            <summary>What stops a team from spamming disputes?</summary>
            <p>
              Every filing posts a bond. A rejected claim forfeits the pot to the other side, minus the treasury fee.
              An inconclusive verdict refunds both parties, so weak evidence does not become a weapon.
            </p>
          </details>
          <details>
            <summary>Can a federation use its own rules?</summary>
            <p>
              Yes. The judge registers a rulebook with its clauses, evidence hosts, bonds, windows, and fee. The panel
              must cite that rulebook, and the contract enforces its thresholds.
            </p>
          </details>
          <details>
            <summary>Is this a VAR replacement?</summary>
            <p>
              No. It is a public, auditable second opinion with money and reputation attached. A federation can adopt
              the verdict, publish it, or ignore it — but the record stays open.
            </p>
          </details>
        </div>
      </section>
    </section>
  );
}
