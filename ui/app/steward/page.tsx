"use client";

import { useEffect, useState } from "react";
import { createWalletClient, custom, isAddress, type Address } from "viem";
import { useConnect } from "@/components/useConnect";
import { publicClient } from "@/lib/client";
import {
  CHAUPAL_COUNT,
  CHAIN_ID,
  CONTRACT_ADDRESS,
  RPC_URL,
  ZERO_ROOT,
} from "@/lib/config";
import { localChain } from "@/lib/chain";
import { ABI } from "@/lib/contract";
import { explainRevert } from "@/lib/errors";

interface GroupRow {
  id: number;
  name: string;
  steward: string;
  root: string;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default function StewardPage() {
  const { account } = useConnect();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [roles, setRoles] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [onChainRoot, setOnChainRoot] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [customRoot, setCustomRoot] = useState("");
  const [status, setStatus] = useState("");
  const [configError, setConfigError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) throw new Error("bad response");
        setGroups(await res.json());
      } catch {
        setStatus("failed to load groups from server");
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!account) {
        setRoles({});
        setSelected(null);
        setOnChainRoot(null);
        setMembers([]);
        setConfigError("");
        return;
      }
      if (!isAddress(CONTRACT_ADDRESS)) {
        setConfigError(
          "No contract address configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in ui/.env.local.",
        );
        return;
      }
      try {
        const client = publicClient();
        const next: Record<number, string> = {};
        for (let i = 0; i < CHAUPAL_COUNT; i++) {
          const steward = await client.readContract({
            address: CONTRACT_ADDRESS as Address,
            abi: ABI,
            functionName: "stewardOf",
            args: [BigInt(i)],
          });
          next[i] = steward.toLowerCase();
        }
        setRoles(next);
        const acct = account.toLowerCase();
        const firstMine = Object.entries(next).find(([, steward]) => steward === acct)?.[0];
        setSelected(firstMine !== undefined ? Number(firstMine) : null);
        setConfigError("");
      } catch (e) {
        setConfigError(
          `Could not read stewardOf from the contract: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }, 0);
    return () => clearTimeout(t);
  }, [account]);

  const mine = groups.filter((g) => same(roles[g.id] ?? "", account ?? ""));

  useEffect(() => {
    if (selected === null) return;
    const t = setTimeout(async () => {
      setOnChainRoot(null);
      setMembers([]);
      if (isAddress(CONTRACT_ADDRESS)) {
        try {
          const root = await publicClient().readContract({
            address: CONTRACT_ADDRESS as Address,
            abi: ABI,
            functionName: "rootOf",
            args: [BigInt(selected)],
          });
          setOnChainRoot(String(root).toLowerCase());
        } catch {
          setOnChainRoot(null);
        }
      }
      try {
        const res = await fetch(`/api/members?groupId=${selected}`);
        if (res.ok) {
          const body = (await res.json()) as { members: string[] };
          setMembers(body.members);
        }
      } catch {
        setMembers([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [selected]);

  const selectedGroup = groups.find((g) => g.id === selected) ?? null;
  const localRoot = selectedGroup?.root ?? "";
  const synced = onChainRoot !== null && same(onChainRoot, localRoot);
  const unset = onChainRoot !== null && onChainRoot === ZERO_ROOT;

  async function pushRoot(root: string) {
    if (!account || selected === null) {
      setStatus("connect a wallet and pick a chaupal first");
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
      setStatus("root must be a 32-byte hex value (0x + 64 hex chars)");
      return;
    }
    if (!isAddress(CONTRACT_ADDRESS)) {
      setStatus("no contract address configured");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const wallet = createWalletClient({
        chain: localChain(CHAIN_ID, RPC_URL),
        transport: custom(window.ethereum as never),
        account,
      });
      const hash = await wallet.writeContract({
        address: CONTRACT_ADDRESS as Address,
        abi: ABI,
        functionName: "setRoot",
        args: [BigInt(selected), root as `0x${string}`],
      });
      setStatus("root pushed — waiting for confirmation...");
      await publicClient().waitForTransactionReceipt({ hash });
      const stored = await publicClient().readContract({
        address: CONTRACT_ADDRESS as Address,
        abi: ABI,
        functionName: "rootOf",
        args: [BigInt(selected)],
      });
      setOnChainRoot(String(stored).toLowerCase());
      setStatus(`group ${selected}: root updated on-chain (tx ${hash.slice(0, 10)}...)`);
    } catch (e) {
      setStatus(explainRevert(e));
    } finally {
      setBusy(false);
    }
  }

  function refreshLocal() {
    setStatus("");
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => setStatus("failed to refresh groups"));
  }

  return (
    <>
      <h2>Steward console</h2>
      {groups.length > 0 ? (
        <p>
          You steward {mine.length} of {groups.length} chaupals on this chain
          (read from <span className="mono">stewardOf</span>).
        </p>
      ) : null}
      {configError ? <p className="err">{configError}</p> : null}

      {!account ? (
        <p>Connect a wallet to see which chaupals you steward.</p>
      ) : configError ? null : Object.keys(roles).length === 0 ? (
        <p className="mono">reading steward roles from the contract...</p>
      ) : mine.length === 0 ? (
        <p className="err">
          No chaupal on this chain records your connected address as its
          steward.
        </p>
      ) : (
        <>
          <div className="row">
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {mine.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id} · {g.name}
                </option>
              ))}
            </select>
            <button onClick={refreshLocal}>Refresh local data</button>
          </div>

          {selectedGroup ? (
            <div className="card">
              <h3>
                Group {selectedGroup.id} · {selectedGroup.name}{" "}
                {unset ? (
                  <span className="badge badge-err">not set on-chain</span>
                ) : synced ? (
                  <span className="badge badge-ok">in sync</span>
                ) : (
                  <span className="badge badge-warn">out of date</span>
                )}
              </h3>

              <p className="mono" style={{ wordBreak: "break-all" }}>
                local tree root: {localRoot || "(not loaded)"}
              </p>
              <p className="mono" style={{ wordBreak: "break-all" }}>
                on-chain root: {onChainRoot ?? "(reading...)"}
              </p>

              <p>
                The local root comes from the regenerated trees in{" "}
                <span className="mono">data/trees/</span>. When the committed
                member list changes, this local root changes too — push it with
                the button below.
              </p>

              <div className="row">
                <button
                  disabled={busy || !localRoot || synced}
                  onClick={() => pushRoot(localRoot)}
                >
                  {synced
                    ? "On-chain root already in sync"
                    : "Update root on-chain to member-list root"}
                </button>
                <input
                  placeholder="or paste a custom root (0x + 64 hex)"
                  value={customRoot}
                  onChange={(e) => setCustomRoot(e.target.value)}
                />
                <button
                  disabled={busy || !customRoot}
                  onClick={() => pushRoot(customRoot.trim())}
                >
                  Apply custom root
                </button>
              </div>

              {status ? (
                <p className={status.startsWith("group") ? "you" : "err"}>
                  {status}
                </p>
              ) : null}

              <h3 style={{ marginTop: 16 }}>Member list ({members.length})</h3>
              {members.length ? (
                <ul className="members">
                  {members.map((m, i) => (
                    <li key={i} className="mono">
                      {i + 1}. {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mono">loading members...</p>
              )}
              <p className="note">
                Membership stays off-chain: add or remove an address under
                this chaupal in <span className="mono">data/groups.json</span>,
                then run <span className="mono">npm run trees</span> at the repo
                root to regenerate the trees. The new local root appears above —
                press &quot;Update root on-chain&quot; to publish it. That final push is a
                signed transaction from this browser, no terminal needed.
              </p>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}