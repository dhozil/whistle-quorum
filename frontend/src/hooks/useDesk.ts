import { useCallback, useEffect, useRef, useState } from "react";
import { getProvider, readableError, readContract } from "../lib/genlayer";
import type { Dispute, Match, Reputation, Rulebook, Stats } from "../lib/types";

export interface DeskState {
  stats: Stats | null;
  disputes: Dispute[];
  matches: Match[];
  rulebooks: Rulebook[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastLoaded: number;
}

export function useDesk(): DeskState {
  const [stats, setStats] = useState<Stats | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [rulebooks, setRulebooks] = useState<Rulebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [nextStats, nextDisputes, nextMatches, nextRulebooks] = await Promise.all([
        readContract<Stats>("get_stats"),
        readContract<Dispute[]>("list_disputes", [0, 40]),
        readContract<Match[]>("list_matches", [0, 40]),
        readContract<Rulebook[]>("list_rulebooks"),
      ]);
      setStats(nextStats);
      setDisputes(nextDisputes);
      setMatches(nextMatches);
      setRulebooks(nextRulebooks);
      setError(null);
      setLastLoaded(Date.now());
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 45000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { stats, disputes, matches, rulebooks, loading, error, refresh, lastLoaded };
}

export function useAccountData(address: string | null, version: number) {
  const [claimable, setClaimable] = useState("0");
  const [reputation, setReputation] = useState<Reputation | null>(null);

  useEffect(() => {
    if (!address) {
      setClaimable("0");
      setReputation(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const [nextClaimable, nextReputation] = await Promise.all([
          readContract<string>("get_claimable", [address]),
          readContract<Reputation>("get_reputation", [address]),
        ]);
        if (alive) {
          setClaimable(nextClaimable);
          setReputation(nextReputation);
        }
      } catch {
        // A failed balance read is not worth interrupting the desk.
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, version]);

  return { claimable, reputation };
}

interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setAddress(accounts?.[0] ?? null);
    };
    provider.on("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No browser wallet found. Install MetaMask, Rabby, or another EVM wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) throw new Error("The wallet returned no accounts.");
      setAddress(accounts[0]);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  return { address, connecting, error, connect, disconnect };
}
