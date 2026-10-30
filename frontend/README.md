# Whistle Quorum - frontend client

Vite + React + TypeScript front end for the `WhistleQuorum` contract on StudioNet.

```powershell
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_CONTRACT_ADDRESS` | `0x9867e509d2EbC8b8646CE6605DC550347FDedE02` | Deployed instance |
| `VITE_RPC_URL` | `https://studio.genlayer.com/api` | StudioNet JSON-RPC |
| `VITE_NETWORK` | `studionet` | Informational |

Put overrides in `frontend/.env.local`.

Reads need no wallet. Writes use an injected EIP-1193 wallet (MetaMask, Rabby, …) and the
app switches it to StudioNet (`chain 61999`) before sending.

## Structure

```
src/lib/genlayer.ts     clients, read/write helpers, receipt waiting, error text
src/lib/format.ts       GEN formatting, addresses, time, labels
src/hooks/useDesk.ts    desk state + wallet connection + claimable/reputation
src/components/         TopBar, DeskView, DisputeDetail, DisputeRow, MatchesView,
                        RulebooksView, GuideView, Forms, ui
src/styles.css          the whole design system (tokens, layout, responsive)
src/App.tsx             tab routing (#desk/#matches/#rulebooks/#guide), tx handlers, modals
```

Reviews are slow: `sendTransaction` waits for `ACCEPTED` with a 4 s interval and 150
retries, then the app refreshes the desk so the verdict appears.
