import { Coins, LogOut, Wallet } from "lucide-react";
import { formatGen, shortAddress } from "../lib/format";

export type Tab = "desk" | "matches" | "rulebooks" | "guide";

const TABS: { id: Tab; label: string }[] = [
  { id: "desk", label: "Match desk" },
  { id: "matches", label: "Fixtures" },
  { id: "rulebooks", label: "Rulebooks" },
  { id: "guide", label: "How it works" },
];

interface Props {
  tab: Tab;
  onTab: (tab: Tab) => void;
  address: string | null;
  connecting: boolean;
  claimable: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onWithdraw: () => void;
  withdrawing: boolean;
}

export function TopBar({
  tab,
  onTab,
  address,
  connecting,
  claimable,
  onConnect,
  onDisconnect,
  onWithdraw,
  withdrawing,
}: Props) {
  const hasClaim = BigInt(claimable || "0") > 0n;

  return (
    <header className="topbar">
      <button className="brand" onClick={() => onTab("desk")} aria-label="Whistle Quorum home">
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M13.5 19.5 24 14.2V9.5h-6.8l-3.4 4.4"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <circle cx="11" cy="20" r="6.4" stroke="currentColor" strokeWidth="2.4" />
            <circle cx="11" cy="20" r="1.6" fill="currentColor" />
          </svg>
        </span>
        <span className="brand__type">
          WHISTLE<span>QUORUM</span>
        </span>
      </button>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`tab ${tab === item.id ? "is-active" : ""}`}
            onClick={() => onTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="wallet">
        <span className="net" title="StudioNet — chain 61999">
          <span className="net__dot" /> StudioNet
        </span>
        {address ? (
          <div className="wallet__box">
            {hasClaim && (
              <button className="wallet__claim" onClick={onWithdraw} disabled={withdrawing}>
                <Coins size={13} />
                {withdrawing ? "Withdrawing…" : `Collect ${formatGen(claimable)}`}
              </button>
            )}
            <span className="wallet__addr" title={address}>
              {shortAddress(address)}
            </span>
            <button className="icon-btn" onClick={onDisconnect} aria-label="Disconnect wallet">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button className="btn btn--connect" onClick={onConnect} disabled={connecting}>
            <Wallet size={14} />
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
