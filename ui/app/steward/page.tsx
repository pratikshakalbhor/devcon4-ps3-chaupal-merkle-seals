"use client";

import { useEffect, useState } from "react";
import { createWalletClient, custom, isAddress, type Address } from "viem";
import { useConnect } from "@/components/useConnect";
import { publicClient } from "@/lib/client";
import { SEAL_ADDRESS, CHAIN_ID, RPC_URL } from "@/lib/config";
import { localChain } from "@/lib/chain";
import { ABI } from "@/lib/contract";

interface GroupRow {
  id: number;
  name: string;
  steward: string;
  root: string;
}

export default function StewardPage() {
  const { account } = useConnect();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [customRoots, setCustomRoots] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => setStatus("failed to load groups"));
  }, []);

  const mine = groups.filter(
    (g) => g.steward.toLowerCase() === (account ?? "").toLowerCase(),
  );

  async function applyRoot(groupId: number, root: string) {
    if (!account) return setStatus("connect a wallet first");
    if (!isAddress(SEAL_ADDRESS)) return setStatus("no NEXT_PUBLIC_SEAL_ADDRESS configured");
    setBusy(groupId);
    setStatus("");
    try {
      const client = createWalletClient({
        chain: localChain(CHAIN_ID, RPC_URL),
        transport: custom(window.ethereum as never),
        account,
      });
      const hash = await client.writeContract({
        address: SEAL_ADDRESS as Address,
        abi: ABI,
        functionName: "setRoot",
        args: [BigInt(groupId), root as `0x${string}`],
      });
      await publicClient().waitForTransactionReceipt({ hash });
      const onChain = await publicClient().readContract({
        address: SEAL_ADDRESS as Address,
        abi: ABI,
        functionName: "rootOf",
        args: [BigInt(groupId)],
      });
      setGroups((gs) =>
        gs.map((g) => (g.id === groupId ? { ...g, root: onChain } : g)),
      );
      setStatus(`group ${groupId}: root set (tx ${hash.slice(0, 10)}…)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h2>Steward console</h2>
      <p>Your address stewards {mine.length} of the {groups.length} chaupals.</p>
      {status ? <p className="err">{status}</p> : null}
      <div className="grid">
        {groups.map((g) => {
          const isMine = g.steward.toLowerCase() === (account ?? "").toLowerCase();
          return (
            <div className="card" key={g.id}>
              <h3>
                {g.id} · {g.name} {isMine ? <span className="you">(you)</span> : null}
              </h3>
              <p className="mono">steward {g.steward}</p>
              <p className="mono" style={{ wordBreak: "break-all" }}>
                root {g.root}
              </p>
              {isMine ? (
                <>
                  <div className="row">
                    <button
                      disabled={busy === g.id}
                      onClick={() => applyRoot(g.id, g.root)}
                    >
                      Set committed root
                    </button>
                  </div>
                  <div className="row">
                    <input
                      placeholder="custom root (bytes32 hex)"
                      value={customRoots[g.id] ?? ""}
                      onChange={(e) =>
                        setCustomRoots((r) => ({ ...r, [g.id]: e.target.value }))
                      }
                    />
                    <button
                      disabled={busy === g.id || !customRoots[g.id]}
                      onClick={() => applyRoot(g.id, customRoots[g.id])}
                    >
                      Apply
                    </button>
                  </div>
                </>
              ) : (
                <p className="mono" style={{ color: "#777" }}>
                  you are not this chaupal&apos;s steward
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}