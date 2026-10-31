import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type GenLayerClient, type GenLayerTransaction } from "genlayer-js/types";

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x49573Abea978E05c9AA2133c27cf1FB456b80792") as `0x${string}`;

export const RPC_URL = import.meta.env.VITE_RPC_URL || "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://genlayer-explorer.vercel.app";

const readClient = createClient({ chain: studionet });

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export function getProvider(): Eip1193Provider | null {
  const provider = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return provider ?? null;
}

export function writeClient(address: string): GenLayerClient<typeof studionet> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  }
  return createClient({
    chain: studionet,
    account: address as `0x${string}`,
    provider,
  });
}

export async function readContract<T>(
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  return (await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never[],
  })) as T;
}

export async function switchToStudionet() {
  const provider = getProvider();
  if (!provider) return;
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainId, 16) === studionet.id) return;
  await writeClient("0x0000000000000000000000000000000000000000").connect("studionet");
}

export function executionOk(receipt: GenLayerTransaction): boolean {
  return receipt.txExecutionResultName === "FINISHED_WITH_RETURN";
}

export function receiptFailure(receipt: GenLayerTransaction): string | null {
  const shaped = receipt as unknown as {
    consensus_data?: { leader_receipt?: { result?: { payload?: string } }[] };
  };
  const payload = shaped.consensus_data?.leader_receipt?.[0]?.result?.payload;
  if (!payload) return null;
  return payload.replace(/^\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]\s*/, "");
}

export interface WriteOptions {
  functionName: string;
  args?: unknown[];
  value?: bigint;
  wait?: boolean;
  onHash?: (hash: string) => void;
}

export async function sendTransaction(
  address: string,
  { functionName, args = [], value = 0n, wait = true, onHash }: WriteOptions,
): Promise<GenLayerTransaction | null> {
  await switchToStudionet();
  const client = writeClient(address);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never[],
    value,
  });
  onHash?.(hash);
  if (!wait) return null;
  return client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 4000,
    retries: 150,
  });
}

export async function waitForHash(hash: string): Promise<GenLayerTransaction> {
  return readClient.waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.ACCEPTED,
    interval: 4000,
    retries: 150,
  });
}

export function readableError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || "Transaction failed";
    if (/user rejected|denied transaction/i.test(message)) {
      return "You rejected the wallet request.";
    }
    if (/timed out/i.test(message)) {
      return "The network is still working on it. Refresh in a minute to see the result.";
    }
    if (/rate.?limit|too many requests|429/i.test(message)) {
      return "StudioNet is rate-limiting this browser. Give it a minute, then refresh.";
    }
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return "Could not reach StudioNet. Check the connection, then refresh.";
    }
    if (/unknown rpc error/i.test(message)) {
      return "StudioNet returned an unexpected response. Refresh in a moment.";
    }
    return message.length > 240 ? message.slice(0, 240) + "…" : message;
  }
  return "Something went wrong. Try again.";
}
