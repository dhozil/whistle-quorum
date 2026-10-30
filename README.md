# Whistle Quorum

**An AI referee for disputed sports calls, settled on GenLayer.**

A federation registers a fixture and the written rulebook that governs it. The two team
representatives get one bond-backed channel to argue about a single officiating decision.
When the argument closes, anyone can open the review desk: every validator independently
fetches the same public evidence, analyses it, and must agree on the verdict before the
contract writes it. Bonds, an appeal, reputation and the payout all live on chain.

- Deployed contract (StudioNet): [`0x9867e509d2EbC8b8646CE6605DC550347FDedE02`](https://genlayer-explorer.vercel.app)
- Frontend: Vite + React + TypeScript, `genlayer-js` for reads and injected-wallet writes
- Contract: `contracts/whistle_quorum.py`, GenVM `py-genlayer` runner pinned in the header

> Why this needs a chain and a consensus protocol: the *fact* that decides the dispute
> (did the ball cross the line?) cannot be produced by a single server without trusting
> that server. Whistle Quorum makes the evidence public, makes every validator re-derive the
> call, and makes the money follow the recorded verdict.

---

## What the contract decides

| Field | Meaning |
| --- | --- |
| `outcome` | `CLAIM_UPHELD`, `CLAIM_REJECTED`, or `INCONCLUSIVE` |
| `incident_type` | `GOAL_LINE`, `OFFSIDE`, `HANDBALL`, `FOUL`, `PENALTY`, `OUT_OF_BOUNDS`, `CLOCK`, `OTHER` |
| `recommended_action` | `NO_CHANGE`, `AWARD_GOAL`, `DISALLOW_GOAL`, `AWARD_PENALTY`, `NO_PENALTY`, `SEND_OFF`, `NO_CARD`, `AWARD_FREE_KICK`, `NO_FREE_KICK`, `RESET_CLOCK`, `OTHER` |
| `confidence` | 0–100, produced by the panel and clamped by the contract |
| `evidence_quality` | `STRONG`, `MODERATE`, `WEAK`, `INSUFFICIENT` |

The free-text `findings` and `rules_cited` are stored for humans and **never compared**
between validators. Only the structured decision is consensus-critical. This keeps
disagreement tied to the call, not to wording.

## Lifecycle

```
FILED ──review_dispute──▶ DECIDED ──appeal──▶ APPEALED ──review_appeal──▶ FINAL
                              │                                            ▲
                              └────────finalize (window closed)────────────┘
                                                                           │
                                                                      settle
                                                                           ▼
                                                                       SETTLED
```

- **FILED** — a registered rep posts the bond, the claim and public HTTPS evidence.
  The opposing rep may answer once with counter-evidence.
- **DECIDED** — validators re-fetched the evidence and agreed. The verdict is stored with
  per-artifact SHA-256 fingerprints.
- **APPEALED** — one party puts up a higher bond and at least one **new** evidence URL.
  The panel re-runs under a *clear and convincing* standard, with the first decision
  presumed correct. An appeal that cannot meet the burden leaves the first decision standing.
- **FINAL** — either the appeal window expired with no appeal, or the appeal was decided.
- **SETTLED** — bonds are distributed deterministically.

### Money

- The filing bond is fixed by the rulebook and must be sent exactly.
- A decisive verdict pays `pot − fee` to the winning side; the fee (default 5%) goes to
  the treasury.
- `INCONCLUSIVE` is **no fault**: each party's own bond is refunded, nobody's reputation
  moves.
- Payouts are credited to `claimable` balances; the recipient calls `withdraw()` to move
  GEN out of the contract.

Reputation tracks `filed`, `won`, `lost`, `appeals`, `appeals_won`, `appeals_lost` per
address and is updated only in `settle`.

## Evidence model (short version)

GenVM cannot decode video, so "footage" is modelled as **frames and pages**:

- up to 6 evidence URLs per filing (4 per appeal), public `https` only,
- JPEG / PNG / WebP / GIF under 2 MB are attached to the multimodal prompt as image frames
  (max 4 frames per review),
- other URLs are fetched and clipped to 3,500 characters of text,
- every fetched artifact is hashed (SHA-256) and the hash list is stored on the verdict,
- the rulebook's `allowed_domains` allowlist gates what the panel may cite
  (empty = any public host), and a verdict can only cite sources that were actually
  fetched — a decisive verdict with no allowlisted, fetched source is downgraded
  to `INCONCLUSIVE`.

The contract downgrades to `INCONCLUSIVE` deterministically when evidence quality is
`INSUFFICIENT`, when distinct non-official source domains are below the rulebook's
`min_sources`, when confidence is below `min_confidence`, or when a decisive verdict has
no allowlisted source it can actually point at.

Full policy: [`docs/EVIDENCE-POLICY.md`](docs/EVIDENCE-POLICY.md).
Architecture and threat model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository

```
contracts/whistle_quorum.py      the intelligent contract (single file, no imports beyond GenVM)
tests/direct/                   34 fast direct-mode tests (pytest, mocked web + LLM)
tests/integration/              StudioNet smoke test (real consensus, real fetch)
web/                            React frontend (Vite)
docs/                           architecture and evidence policy
gltest.config.yaml              StudioNet network + env-var accounts for gltest
```

## Run it

### 1. Contract tests (no network)

```powershell
pip install -r requirements.txt
python -m pytest -q          # 34 passed
genvm-lint check contracts/whistle_quorum.py
```

The direct-mode tests mock `gl.nondet.web.get` and `gl.nondet.exec_prompt`, so they cover
consensus agreement, deterministic downgrades, appeal eligibility, finality and the exact
payout arithmetic in milliseconds.

### 2. Integration test (real validators)

```powershell
$env:PYTHONUTF8="1"
gltest tests/integration -v -s
```

This deploys a fresh instance to StudioNet, files a dispute with a single evidence domain
and a rulebook that requires two sources, and asserts that the panel returns a real
`INCONCLUSIVE` verdict through consensus. It takes a few minutes because it waits for
validators.

### 3. Frontend

```powershell
cd web
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type-check + production bundle
```

Reads need no wallet. Writes use an injected EIP-1193 wallet (MetaMask, Rabby, …) on
StudioNet (`chain 61999`); the app switches the chain for you. The contract address is
read from `VITE_CONTRACT_ADDRESS` and falls back to the deployed instance above.

## Demo walkthrough

1. **Match desk** — three case files on the live deployment, one per stage of the
   lifecycle:
   - `match-3#3` — **SETTLED** end-to-end: the quorum reviewed the handball packet, the
     verdict came back `INCONCLUSIVE`, and the finalize → settle flow closed the case
     (bonds refunded, no fault).
   - `match-1#2` — **SETTLED** via finalize → settle (the expedited appeal window had
     lapsed, so finality ran without an appeal round): the panel's decision — `INCONCLUSIVE`
     with a `NO_CHANGE` action after the deterministic evidence-quality downgrade — was
     finalized and the case closed with no fault.
   - `match-1#1` — **DECIDED** and still inside its appeal window (goal-line packet, minute 92):
     the quorum downgraded the packet to `INCONCLUSIVE` (confidence 30, evidence quality
     `INSUFFICIENT`) rather than issuing a binding call on thin evidence.
     Open any of them: the verdict card, the findings, the cited rulebook clauses, the final
     explanation in Bahasa Indonesia and the evidence fingerprints are all on chain.
2. **Fixtures** — three registered fixtures; only the two representative wallets can file
   or answer. Each fixture pins the rulebook, the official page and the representatives.
3. **Rulebooks** — the contract's source of truth: clauses, bond sizes, confidence and
   source thresholds, windows and the treasury fee.
4. **How it works** — the lifecycle, the trust boundaries and the deployed address.

A live review takes one to four minutes: the transaction stays `ACCEPTED` while validators
fetch the URLs and run the model, then the verdict appears after a refresh.

## Design notes and limits

- **No video.** Frames only. If the decisive moment is not in the packet, the honest verdict
  is `INCONCLUSIVE` — and the demo cases show exactly that when a Wikipedia page is filed
  instead of a frame.
- **Probabilistic model, deterministic settlement.** The model can misread a frame. Bonds,
  the appeal burden and the deterministic downgrades price that risk; they do not erase it.
- **Evidence is untrusted.** Pages that try to instruct the reviewer are flagged
  (`manipulation_suspected`) and treated as data. The prompt never grants evidence any
  authority.
- **StudioNet is a test network.** Bonds are test GEN. Do not move value you care about.
- The dispute id suffix is a global case counter (`match-1#2` is the second case ever
  filed), which keeps ids unique across fixtures.

## License

MIT.
