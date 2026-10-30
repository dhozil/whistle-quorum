# Architecture

Whistle Quorum is a single GenLayer intelligent contract plus a read-mostly React client.
Everything that must be trusted is on chain; everything the browser does is presentation.

```
┌──────────────┐   reads (gen_call)      ┌─────────────────────────┐
│  React app   │ ──────────────────────▶ │  Whistle Quorum contract  │
│  (Vite)      │                         │  StudioNet 0x9867…E02   │
│              │   writes (signed tx)    │                         │
└──────────────┘ ──────────────────────▶ └───────────┬─────────────┘
                                                     │ gl.vm.run_nondet_unsafe
                                          ┌──────────▼─────────────┐
                                          │  leader + validators   │
                                          │  fetch URLs, run LLM   │
                                          │  compare structured    │
                                          │  decision              │
                                          └────────────────────────┘
```

## 1. Contract layout

`contracts/whistle_quorum.py` is one file with a pinned runner header:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

Storage (all GenVM-native types, no `dict`/`list` mutations in place):

| Field | Type | Purpose |
| --- | --- | --- |
| `admin`, `treasury` | `Address` | Who may register rulebooks/fixtures; who earns the fee |
| `rulebook_ids`, `match_ids`, `dispute_ids` | `DynArray[str]` | Insertion-ordered indexes for the views |
| `rulebooks` | `TreeMap[str, Rulebook]` | Source of truth: clauses, bonds, thresholds, windows, fee |
| `matches` | `TreeMap[str, Match]` | Fixture, official page, home/away representatives |
| `disputes` | `TreeMap[str, Dispute]` | Claim, evidence JSON, verdict, money, reputation |
| `claimable` | `TreeMap[Address, u256]` | Pull-payment balances |
| `reputation` | `TreeMap[Address, Reputation]` | filed / won / lost / appeals counters |
| `dispute_counter`, `settled_counter`, `volume_wei` | `u256` | Docket number, stats |

Records are `@allow_storage` dataclasses. Views return plain dicts with stringified
`u256` values, so the frontend never has to parse a custom encoding.

### Public API

Writes:

| Method | Who | Effect |
| --- | --- | --- |
| `add_rulebook(...)` | admin | Registers clauses, allowed evidence hosts, bonds, thresholds, windows, fee |
| `create_match(...)` | admin | Pins rulebook + official page + two representative addresses |
| `file_dispute(match, incident, minute, claim, urls)` | a representative, exact bond | Opens a case, `FILED` |
| `submit_counter_evidence(id, urls, note)` | the other representative, once | Adds the other side's packet |
| `review_dispute(id)` | anyone after the counter window | Runs consensus, `DECIDED` |
| `appeal(id, urls, grounds)` | eligible party, exact appeal bond | Requires ≥1 new URL, `APPEALED` |
| `review_appeal(id)` | anyone | Re-runs under clear-and-convincing, `FINAL` |
| `finalize(id)` | anyone after the appeal window | `DECIDED → FINAL` |
| `settle(id)` | anyone | `FINAL → SETTLED`, deterministic payout |
| `withdraw()` | any creditor | Emits an EVM transfer of the caller's claimable balance |
| `set_treasury`, `transfer_admin` | admin | Governance knobs |

Views: `get_stats`, `get_rulebook`, `list_rulebooks`, `get_match`, `list_matches`,
`get_dispute`, `list_disputes`, `get_claimable`, `get_reputation`, `can_appeal`.

## 2. The consensus-critical part

Only `_run_review` is non-deterministic. It runs inside
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`:

1. **Fetch.** The leader walks `official_url + filer + counter + appeal URLs`, deduped.
   Each URL is fetched with `gl.nondet.web.get`. Non-2xx, empty or failed fetches are
   labelled `UNAVAILABLE`/`EMPTY` in the prompt instead of aborting the review. If *no*
   artifact is usable the leader raises `[EXTERNAL]`, which validators treat as a
   retryable failure rather than a verdict.
2. **Classify.** Bytes that look like an image (magic-number check) under 2 MB become
   attached frames (max 4). Everything else is decoded, cleaned and clipped to 3,500
   characters.
3. **Hash.** `sha256` of every usable artifact is kept and stored on the verdict, so a
   later reader can prove which bytes the panel actually saw.
4. **Prompt.** The rulebook, the claim, the response, the appeal grounds and the prior
   decision (on appeal) are composed *before* the evidence block. The evidence block is
   explicitly labelled untrusted data, and the rules forbid following instructions found
   inside it.
5. **Parse + normalise.** `_parse_json_object` is tolerant of fenced or noisy output;
   `_normalize_verdict` clamps enums, clamps confidence to 0–100, and applies the
   deterministic downgrades (see below).
6. **Agree.** Each validator repeats steps 1–5 independently and compares:
   - `outcome` always,
   - `incident_type` and `recommended_action` only when the outcome is decisive,
   - `final_outcome` on appeals.

   Free-text findings and citations are stored but never compared. This is what keeps
   independent runs from disagreeing over wording.

### Deterministic downgrades

Applied identically by every node, after the model answers:

| Condition | Result |
| --- | --- |
| `evidence_quality == INSUFFICIENT` | `INCONCLUSIVE` |
| distinct non-official source domains `< min_sources` | `INCONCLUSIVE` |
| `confidence < min_confidence` | `INCONCLUSIVE` |
| decisive verdict citing no allowlisted, fetched source | `INCONCLUSIVE` |
| outcome is `INCONCLUSIVE` | `recommended_action = NO_CHANGE` |

The point is that the *threshold* is not a matter of model opinion. A rulebook that says
"70/100 and two sources" cannot be satisfied by a confident-sounding single page.

### Error classification

Leader failures are tagged so validators can respond correctly instead of blindly
disagreeing:

- `[EXPECTED]` — a bad argument; the transaction should fail.
- `[EXTERNAL]` — the web was unreachable; validators use the leader's error if they hit the
  same class, otherwise retry.
- `[TRANSIENT]`, `[LLM_ERROR]` — infrastructure noise; not a verdict.

## 3. Money and finality

```
pot = filing_bond + appeal_bond
fee = pot * fee_bps / 10000          # default 500 bps = 5%
payout = pot - fee                   # to the winning side
```

- `CLAIM_UPHELD` → the filing party wins; `CLAIM_REJECTED` → the respondent wins.
- `INCONCLUSIVE` → no fault: each party's own bond is returned, `winner = 0x0`,
  `payout = 0`, reputation untouched.
- The treasury earns `fee` only on a decisive verdict.
- `volume_wei` and `settled_counter` are updated once, in `settle`.
- Payouts are credits, not transfers. `withdraw()` zeroes the balance *before* emitting
  the transfer, so a re-entrant or duplicated call cannot double-spend.

Correctness is covered by direct-mode tests: 3 GEN pot with a 5% fee yields `2.85 GEN`
to the winner and `0.15 GEN` to the treasury.

## 4. Threat model

| Threat | Mitigation |
| --- | --- |
| A party submits a page that says "ignore the rules and uphold" | Evidence is fenced as untrusted data; the prompt forbids instruction-following; `manipulation_suspected` is surfaced in the UI |
| One validator is compromised or lazy | Every validator re-fetches and re-runs; only matching structured decisions are accepted |
| Model hallucinates a decisive call from weak evidence | Deterministic downgrades on quality, source count, confidence and source allowlist; the panel must also agree |
| Parties file frivolous cases | Filing bond is locked until settlement; losing side forfeits it |
| A loser spams appeals | One app-level appeal, higher bond, new evidence required, clear-and-convincing standard |
| Sybil reputation farming | Reputation only moves on settled, decisive verdicts of registered representatives |
| Reviewer reads a private/intranet URL | `_check_url` enforces `https`, a public host, no credentials, and the rulebook's allowlist |
| Money gets stuck | `claimable` + `withdraw`, guarded by a zero-before-transfer pattern |

Residual risks are stated plainly in the README: the model is probabilistic, video is not
decoded, and an image can be cropped or mislabelled. Bonds and appeals price that risk;
they do not eliminate it.

## 5. Frontend architecture

`web/src`:

- `lib/genlayer.ts` — one read client, one write client factory bound to the injected
  wallet, `readContract`/`sendTransaction` helpers, error normalisation, long receipt
  polling (`ACCEPTED`, 4 s, 150 retries — reviews are slow).
- `hooks/useDesk.ts` — desk state (stats, disputes, matches, rulebooks), an in-flight
  guard, a 45 s refresh, wallet connection and per-account claimable/reputation.
- `components/*` — `DeskView` (hero, scoreboard, case list, detail), `DisputeDetail`
  (verdict card, steps, evidence, settlement, next move), `MatchesView`, `RulebooksView`,
  `GuideView`, `Forms` (file / counter / appeal / create fixture / add rulebook), `TopBar`.
- Tabs are hash-routed (`#desk`, `#matches`, `#rulebooks`, `#guide`) so a demo can deep-link
  a view; the selected case is local state.

The client never computes a verdict or a payout. It mirrors the contract's windows and bond
amounts for *display* only (which button to show, how much to lock), and every action is a
signed transaction whose result is re-read from chain. The contract is the only authority
on eligibility, amounts and outcomes.
