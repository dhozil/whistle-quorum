import { useMemo, useState } from "react";
import type { Dispute, Match, Rulebook } from "../lib/types";
import { formatGen, parseGen } from "../lib/format";
import { ErrorNote, Field, Modal, Select, TextArea, TextInput } from "./ui";

const INCIDENTS = [
  "GOAL_LINE",
  "OFFSIDE",
  "HANDBALL",
  "FOUL",
  "PENALTY",
  "OUT_OF_BOUNDS",
  "CLOCK",
  "OTHER",
];

function parseUrls(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function useSubmit(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}

interface FileProps {
  matches: Match[];
  rulebooks: Rulebook[];
  address: string;
  initialMatchId?: string;
  onClose: () => void;
  onSubmit: (payload: {
    matchId: string;
    incident: string;
    minute: number;
    claim: string;
    urls: string;
    value: bigint;
  }) => Promise<void>;
}

export function FileDisputeModal({ matches, rulebooks, address, initialMatchId, onClose, onSubmit }: FileProps) {
  const mine = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.home_rep.toLowerCase() === address.toLowerCase() ||
          match.away_rep.toLowerCase() === address.toLowerCase(),
      ),
    [matches, address],
  );
  const [matchId, setMatchId] = useState(
    initialMatchId && mine.some((item) => item.match_id === initialMatchId)
      ? initialMatchId
      : (mine[0]?.match_id ?? ""),
  );
  const match = mine.find((item) => item.match_id === matchId) ?? mine[0];
  const rulebook = rulebooks.find((item) => item.rulebook_id === match?.rulebook_id);
  const [incident, setIncident] = useState(INCIDENTS[0]);
  const [minute, setMinute] = useState("67");
  const [claim, setClaim] = useState("");
  const [urls, setUrls] = useState("");
  const { busy, error, run } = useSubmit(onClose);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(() =>
      onSubmit({
        matchId,
        incident,
        minute: Number(minute),
        claim,
        urls: parseUrls(urls).join(","),
        value: BigInt(rulebook?.filing_bond ?? "0"),
      }),
    );
  };

  return (
    <Modal
      kicker="New filing"
      title="File a disputed call"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="file-dispute" className="btn btn--primary" disabled={busy || !match}>
            {busy ? "Filing…" : `File · bond ${formatGen(rulebook?.filing_bond ?? "0")}`}
          </button>
        </>
      }
    >
      {mine.length === 0 ? (
        <ErrorNote>
          This wallet is not a registered representative in any fixture. Connect with a rep address, or ask the
          judge to create a fixture for you.
        </ErrorNote>
      ) : (
        <form id="file-dispute" className="form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Fixture" full>
            <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              {mine.map((item) => (
                <option key={item.match_id} value={item.match_id}>
                  {item.home_team} v {item.away_team} — {item.competition} ({item.match_id})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Incident">
            <Select value={incident} onChange={(e) => setIncident(e.target.value)}>
              {INCIDENTS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Minute / period">
            <TextInput
              type="number"
              min={0}
              max={300}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              required
            />
          </Field>
          <Field label="What should have been called?" full hint="10–800 characters. State the fact, not the outcome.">
            <TextArea
              rows={4}
              minLength={10}
              maxLength={800}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="The ball fully crossed the line before the clearance. The goal should have been awarded."
              required
            />
          </Field>
          <Field
            label="Evidence URLs"
            full
            hint="Up to 6 public HTTPS links. Images (JPEG/PNG/WebP/GIF) are read as frames; pages are read as text."
          >
            <TextArea rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://…" required />
          </Field>
          <p className="form__note">
            Filing locks {formatGen(rulebook?.filing_bond ?? "0")} until the case settles. The bond returns to the
            winning side; an inconclusive verdict refunds both parties.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
      )}
      {mine.length === 0 && error && <ErrorNote>{error}</ErrorNote>}
    </Modal>
  );
}

interface CounterProps {
  dispute: Dispute;
  onClose: () => void;
  onSubmit: (urls: string, note: string) => Promise<void>;
}

export function CounterModal({ dispute, onClose, onSubmit }: CounterProps) {
  const [urls, setUrls] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useSubmit(onClose);

  return (
    <Modal
      kicker={dispute.dispute_id}
      title="Answer with evidence"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="counter-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit evidence"}
          </button>
        </>
      }
    >
      <form
        id="counter-form"
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => onSubmit(parseUrls(urls).join(","), note));
        }}
      >
        <Field label="Evidence URLs" full hint="Up to 6 public HTTPS links that show the other angle.">
          <TextArea rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} required />
        </Field>
        <Field label="Your response" full hint="Optional. Explain what the filing party got wrong.">
          <TextArea
            rows={3}
            maxLength={600}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The camera is behind the post; the ball never fully crossed the line."
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Modal>
  );
}

interface AppealProps {
  dispute: Dispute;
  rulebook: Rulebook | undefined;
  onClose: () => void;
  onSubmit: (urls: string, grounds: string, value: bigint) => Promise<void>;
}

export function AppealModal({ dispute, rulebook, onClose, onSubmit }: AppealProps) {
  const [urls, setUrls] = useState("");
  const [grounds, setGrounds] = useState("");
  const bond = BigInt(rulebook?.appeal_bond ?? "0");
  const { busy, error, run } = useSubmit(onClose);

  return (
    <Modal
      kicker={`Appeal · ${dispute.dispute_id}`}
      title="Ask for a second review"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="appeal-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Appealing…" : `Appeal · bond ${formatGen(bond)}`}
          </button>
        </>
      }
    >
      <form
        id="appeal-form"
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => onSubmit(parseUrls(urls).join(","), grounds, bond));
        }}
      >
        <p className="form__note form__note--top">
          An appeal needs at least one new URL that was not part of the first review. The panel applies a{" "}
          <strong>clear and convincing</strong> standard: the first decision stands unless the new evidence
          clearly shows a material error.
        </p>
        <Field label="New evidence URLs" full hint="Up to 4 public HTTPS links.">
          <TextArea rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} required />
        </Field>
        <Field label="Grounds for appeal" full hint="10–600 characters.">
          <TextArea
            rows={3}
            minLength={10}
            maxLength={600}
            value={grounds}
            onChange={(e) => setGrounds(e.target.value)}
            required
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Modal>
  );
}

interface MatchProps {
  rulebooks: Rulebook[];
  onClose: () => void;
  onSubmit: (payload: {
    matchId: string;
    rulebookId: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeRep: string;
    awayRep: string;
    kickoff: string;
    officialUrl: string;
  }) => Promise<void>;
}

export function CreateMatchModal({ rulebooks, onClose, onSubmit }: MatchProps) {
  const [matchId, setMatchId] = useState("");
  const [rulebookId, setRulebookId] = useState(rulebooks[0]?.rulebook_id ?? "");
  const [competition, setCompetition] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeRep, setHomeRep] = useState("");
  const [awayRep, setAwayRep] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  const { busy, error, run } = useSubmit(onClose);

  return (
    <Modal
      kicker="Judge desk"
      title="Create a fixture"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="match-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Creating…" : "Create fixture"}
          </button>
        </>
      }
    >
      <form
        id="match-form"
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            onSubmit({
              matchId,
              rulebookId,
              competition,
              homeTeam,
              awayTeam,
              homeRep,
              awayRep,
              kickoff,
              officialUrl,
            }),
          );
        }}
      >
        <Field label="Fixture ID" hint="Lowercase, e.g. match-3">
          <TextInput value={matchId} onChange={(e) => setMatchId(e.target.value)} required placeholder="match-3" />
        </Field>
        <Field label="Rulebook">
          <Select value={rulebookId} onChange={(e) => setRulebookId(e.target.value)}>
            {rulebooks.map((item) => (
              <option key={item.rulebook_id} value={item.rulebook_id}>
                {item.title} ({item.rulebook_id})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Competition" full>
          <TextInput value={competition} onChange={(e) => setCompetition(e.target.value)} required />
        </Field>
        <Field label="Home team">
          <TextInput value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
        </Field>
        <Field label="Away team">
          <TextInput value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
        </Field>
        <Field label="Home representative" hint="Wallet address">
          <TextInput value={homeRep} onChange={(e) => setHomeRep(e.target.value)} required placeholder="0x…" />
        </Field>
        <Field label="Away representative" hint="Wallet address">
          <TextInput value={awayRep} onChange={(e) => setAwayRep(e.target.value)} required placeholder="0x…" />
        </Field>
        <Field label="Kickoff" hint="ISO timestamp">
          <TextInput value={kickoff} onChange={(e) => setKickoff(e.target.value)} placeholder="2026-10-24T18:00:00Z" />
        </Field>
        <Field label="Official page" hint="Optional public match page">
          <TextInput value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} placeholder="https://…" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Modal>
  );
}

interface RulebookProps {
  onClose: () => void;
  onSubmit: (payload: {
    rulebookId: string;
    sport: string;
    title: string;
    rulesText: string;
    allowedDomains: string;
    filingBond: bigint;
    appealBond: bigint;
    minConfidence: number;
    minSources: number;
    counterWindow: number;
    appealWindow: number;
    feeBps: number;
  }) => Promise<void>;
}

export function AddRulebookModal({ onClose, onSubmit }: RulebookProps) {
  const [rulebookId, setRulebookId] = useState("");
  const [sport, setSport] = useState("football");
  const [title, setTitle] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [filingBond, setFilingBond] = useState("1");
  const [appealBond, setAppealBond] = useState("2");
  const [minConfidence, setMinConfidence] = useState("70");
  const [minSources, setMinSources] = useState("1");
  const [counterWindow, setCounterWindow] = useState("0");
  const [appealWindow, setAppealWindow] = useState("72");
  const [feeBps, setFeeBps] = useState("500");
  const { busy, error, run } = useSubmit(onClose);

  return (
    <Modal
      kicker="Judge desk"
      title="Register a rulebook"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="rulebook-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Registering…" : "Register rulebook"}
          </button>
        </>
      }
    >
      <form
        id="rulebook-form"
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            onSubmit({
              rulebookId,
              sport,
              title,
              rulesText,
              allowedDomains,
              filingBond: parseGen(filingBond),
              appealBond: parseGen(appealBond),
              minConfidence: Number(minConfidence),
              minSources: Number(minSources),
              counterWindow: Math.round(Number(counterWindow) * 60),
              appealWindow: Math.round(Number(appealWindow) * 3600),
              feeBps: Number(feeBps),
            }),
          );
        }}
      >
        <Field label="Rulebook ID">
          <TextInput value={rulebookId} onChange={(e) => setRulebookId(e.target.value)} required placeholder="football_league_v2" />
        </Field>
        <Field label="Sport">
          <TextInput value={sport} onChange={(e) => setSport(e.target.value)} required />
        </Field>
        <Field label="Title" full>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Rules text" full hint="Plain-language clauses the panel must apply (20–8000 chars).">
          <TextArea rows={5} minLength={20} maxLength={8000} value={rulesText} onChange={(e) => setRulesText(e.target.value)} required />
        </Field>
        <Field label="Allowed evidence domains" full hint="Comma separated. Empty means any public HTTPS host.">
          <TextInput value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)} placeholder="fifa.com, uefa.com" />
        </Field>
        <Field label="Filing bond (GEN)">
          <TextInput value={filingBond} onChange={(e) => setFilingBond(e.target.value)} required />
        </Field>
        <Field label="Appeal bond (GEN)">
          <TextInput value={appealBond} onChange={(e) => setAppealBond(e.target.value)} required />
        </Field>
        <Field label="Minimum confidence" hint="0–100">
          <TextInput type="number" min={0} max={100} value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)} required />
        </Field>
        <Field label="Minimum distinct sources">
          <TextInput type="number" min={1} value={minSources} onChange={(e) => setMinSources(e.target.value)} required />
        </Field>
        <Field label="Counter-evidence window (minutes)">
          <TextInput type="number" min={0} value={counterWindow} onChange={(e) => setCounterWindow(e.target.value)} required />
        </Field>
        <Field label="Appeal window (hours)">
          <TextInput type="number" min={0} value={appealWindow} onChange={(e) => setAppealWindow(e.target.value)} required />
        </Field>
        <Field label="Treasury fee (bps)" hint="500 = 5% of the pot">
          <TextInput type="number" min={0} max={2000} value={feeBps} onChange={(e) => setFeeBps(e.target.value)} required />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Modal>
  );
}
