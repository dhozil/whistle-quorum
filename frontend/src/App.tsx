import { useEffect, useState } from "react";
import { TopBar, type Tab } from "./components/TopBar";
import { DeskView } from "./components/DeskView";
import { MatchesView } from "./components/MatchesView";
import { RulebooksView } from "./components/RulebooksView";
import { GuideView } from "./components/GuideView";
import {
  AddRulebookModal,
  AppealModal,
  CounterModal,
  CreateMatchModal,
  FileDisputeModal,
} from "./components/Forms";
import type { DeskAction } from "./components/DisputeDetail";
import { useAccountData, useDesk, useWallet } from "./hooks/useDesk";
import { executionOk, readableError, receiptFailure, sendTransaction, CONTRACT_ADDRESS } from "./lib/genlayer";
import type { Dispute, Match } from "./lib/types";

type ModalKind = "file" | "counter" | "appeal" | "match" | "rulebook" | null;

const TAB_IDS: Tab[] = ["desk", "matches", "rulebooks", "guide"];

function tabFromHash(fallback: Tab = "desk"): Tab {
  const value = window.location.hash.replace(/^#\/?/, "");
  return TAB_IDS.includes(value as Tab) ? (value as Tab) : fallback;
}

interface Toast {
  tone: "ok" | "error";
  message: string;
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(() => tabFromHash());
  const setTab = (next: Tab) => {
    setTabState(next);
    if (window.location.hash !== `#${next}`) {
      window.history.replaceState(null, "", `#${next}`);
    }
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [actionDispute, setActionDispute] = useState<Dispute | null>(null);
  const [initialMatch, setInitialMatch] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [version, setVersion] = useState(0);

  const desk = useDesk();
  const wallet = useWallet();
  const { claimable, reputation } = useAccountData(wallet.address, version + desk.lastLoaded);

  useEffect(() => {
    if (!selectedId && desk.disputes.length) setSelectedId(desk.disputes[0].dispute_id);
  }, [desk.disputes, selectedId]);

  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (wallet.error) setToast({ tone: "error", message: wallet.error });
  }, [wallet.error]);

  const runTx = async (
    busyKey: string,
    functionName: string,
    args: unknown[],
    value: bigint,
    success: string,
  ) => {
    if (!wallet.address) {
      const error = new Error("Connect a wallet first.");
      setToast({ tone: "error", message: error.message });
      throw error;
    }
    setBusy(busyKey);
    try {
      const receipt = await sendTransaction(wallet.address, { functionName, args, value });
      if (receipt && !executionOk(receipt)) {
        throw new Error(receiptFailure(receipt) ?? "The contract rejected this transaction.");
      }
      await desk.refresh();
      setVersion((current) => current + 1);
      setToast({ tone: "ok", message: success });
    } catch (cause) {
      setToast({ tone: "error", message: readableError(cause) });
      throw cause;
    } finally {
      setBusy(null);
    }
  };

  const handleAction = (action: DeskAction, dispute: Dispute) => {
    setActionDispute(dispute);
    if (action === "counter") {
      setModal("counter");
      return;
    }
    if (action === "appeal") {
      setModal("appeal");
      return;
    }
    if (action === "review") {
      void runTx("review", "review_dispute", [dispute.dispute_id], 0n, "Review written to the record.");
    }
    if (action === "reviewAppeal") {
      void runTx("reviewAppeal", "review_appeal", [dispute.dispute_id], 0n, "Appeal decided.");
    }
    if (action === "finalize") {
      void runTx("finalize", "finalize", [dispute.dispute_id], 0n, "Decision is final.");
    }
    if (action === "settle") {
      void runTx("settle", "settle", [dispute.dispute_id], 0n, "Bonds settled.");
    }
  };

  const openFile = (match?: Match) => {
    if (!wallet.address) {
      void wallet.connect();
      return;
    }
    setInitialMatch(match?.match_id);
    setModal("file");
  };

  const handleWithdraw = async () => {
    try {
      await runTx("withdraw", "withdraw", [], 0n, "Payout moved to your wallet.");
    } catch {
      // runTx already reported the failure.
    }
  };

  return (
    <div className="app">
      <TopBar
        tab={tab}
        onTab={setTab}
        address={wallet.address}
        connecting={wallet.connecting}
        claimable={claimable}
        onConnect={() => void wallet.connect()}
        onDisconnect={wallet.disconnect}
        onWithdraw={() => void handleWithdraw()}
        withdrawing={busy === "withdraw"}
      />

      <div className="shell">
        {tab === "desk" && (
          <DeskView
            stats={desk.stats}
            disputes={desk.disputes}
            matches={desk.matches}
            rulebooks={desk.rulebooks}
            address={wallet.address}
            loading={desk.loading}
            error={desk.error}
            lastLoaded={desk.lastLoaded}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={() => void desk.refresh()}
            onFile={() => openFile()}
            onCreateMatch={() => setModal("match")}
            busy={busy}
            onAction={handleAction}
          />
        )}

        {tab === "matches" && (
          <MatchesView
            matches={desk.matches}
            rulebooks={desk.rulebooks}
            disputes={desk.disputes}
            address={wallet.address}
            onOpenCreate={() => setModal("match")}
            onFile={(match) => openFile(match)}
            onOpenDispute={(dispute) => {
              setSelectedId(dispute.dispute_id);
              setTab("desk");
            }}
          />
        )}

        {tab === "rulebooks" && (
          <RulebooksView
            rulebooks={desk.rulebooks}
            onOpenCreate={() => setModal("rulebook")}
          />
        )}

        {tab === "guide" && <GuideView />}
      </div>

      <footer className="foot">
        <span>
          Whistle Quorum · an adjudication protocol on GenLayer · contract <code>{CONTRACT_ADDRESS.slice(0, 10)}…</code>
        </span>
        <span className="foot__links">
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            GenLayer docs
          </a>
          {reputation && (
            <span className="foot__rep">
              Reputation {reputation.wins}W · {reputation.losses}L
            </span>
          )}
        </span>
      </footer>

      {modal === "file" && wallet.address && (
        <FileDisputeModal
          matches={desk.matches}
          rulebooks={desk.rulebooks}
          address={wallet.address}
          initialMatchId={initialMatch}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await runTx(
              "file",
              "file_dispute",
              [payload.matchId, payload.incident, payload.minute, payload.claim, payload.urls],
              payload.value,
              "Dispute filed. The evidence packet is on the record.",
            );
            setTab("desk");
          }}
        />
      )}

      {modal === "counter" && actionDispute && (
        <CounterModal
          dispute={actionDispute}
          onClose={() => setModal(null)}
          onSubmit={async (urls, note) => {
            await runTx(
              "counter",
              "submit_counter_evidence",
              [actionDispute.dispute_id, urls, note],
              0n,
              "Counter-evidence recorded.",
            );
          }}
        />
      )}

      {modal === "appeal" && actionDispute && (
        <AppealModal
          dispute={actionDispute}
          rulebook={desk.rulebooks.find(
            (item) =>
              item.rulebook_id ===
              desk.matches.find((match) => match.match_id === actionDispute.match_id)?.rulebook_id,
          )}
          onClose={() => setModal(null)}
          onSubmit={async (urls, grounds, value) => {
            await runTx(
              "appeal",
              "appeal",
              [actionDispute.dispute_id, urls, grounds],
              value,
              "Appeal filed. The panel will review it with a higher burden.",
            );
          }}
        />
      )}

      {modal === "match" && wallet.address && (
        <CreateMatchModal
          rulebooks={desk.rulebooks}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await runTx(
              "match",
              "create_match",
              [
                payload.matchId,
                payload.rulebookId,
                payload.competition,
                payload.homeTeam,
                payload.awayTeam,
                payload.homeRep,
                payload.awayRep,
                payload.kickoff,
                payload.officialUrl,
              ],
              0n,
              "Fixture registered.",
            );
          }}
        />
      )}

      {modal === "rulebook" && wallet.address && (
        <AddRulebookModal
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await runTx(
              "rulebook",
              "add_rulebook",
              [
                payload.rulebookId,
                payload.sport,
                payload.title,
                payload.rulesText,
                payload.allowedDomains,
                payload.filingBond,
                payload.appealBond,
                payload.minConfidence,
                payload.minSources,
                payload.counterWindow,
                payload.appealWindow,
                payload.feeBps,
              ],
              0n,
              "Rulebook registered.",
            );
          }}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
          <span className="toast__mark" />
          {toast.message}
          <button className="toast__close" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
