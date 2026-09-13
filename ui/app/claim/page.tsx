"use client";

import { useEffect, useState } from "react";
import {
  createWalletClient,
  custom,
  isAddress,
  parseEventLogs,
  type Address,
} from "viem";
import { useConnect } from "@/components/useConnect";
import { publicClient } from "@/lib/client";
import { CHAIN_ID, CONTRACT_ADDRESS, RPC_URL } from "@/lib/config";
import { localChain } from "@/lib/chain";
import { ABI } from "@/lib/contract";
import { explainRevert } from "@/lib/errors";

interface GroupRow {
  id: number;
  name: string;
  steward: string;
  root: string;
}

interface ProofPayload {
  proof: string[];
  root: string;
}

type ProofStatus = "idle" | "loading" | "found" | "missing";

export default function ClaimPage() {
  const { account } = useConnect();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState<number>(0);
  const [proofStatus, setProofStatus] = useState<ProofStatus>("idle");
  const [proof, setProof] = useState<ProofPayload | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
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
        setProofStatus("idle");
        setProof(null);
        setClaimed(false);
        setTokenId(null);
        setBalance(null);
        setStatus("");
        return;
      }
      if (!isAddress(CONTRACT_ADDRESS)) {
        setConfigError(
          "No contract address configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in ui/.env.local.",
        );
        return;
      }
      setProofStatus("loading");
      setProof(null);
      setTokenId(null);

      try {
        const res = await fetch(
          `/api/proof?groupId=${groupId}&address=${account}`,
        );
        if (res.ok) {
          setProof((await res.json()) as ProofPayload);
          setProofStatus("found");
        } else {
          setProofStatus("missing");
        }
      } catch {
        setProofStatus("missing");
      }

      const client = publicClient();
      try {
        const c = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ABI,
          functionName: "isClaimed",
          args: [BigInt(groupId), account],
        });
        setClaimed(Boolean(c));
      } catch {
        setClaimed(false);
      }
      try {
        const b = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ABI,
          functionName: "balanceOf",
          args: [account],
        });
        setBalance(b as bigint);
      } catch {
        setBalance(null);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [account, groupId]);

  async function claim() {
    if (!account || !proof) {
      setStatus("no proof loaded — are you on this chaupal's member list?");
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
        functionName: "claim",
        args: [BigInt(groupId), proof.proof as readonly `0x${string}`[]],
      });
      setStatus("seal minting — waiting for confirmation...");
      const receipt = await publicClient().waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({
        abi: ABI,
        logs: receipt.logs,
        eventName: "SealClaimed",
      });
      const token = logs[0]?.args.tokenId;
      setTokenId(token ?? null);
      setClaimed(true);
      try {
        const b = await publicClient().readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ABI,
          functionName: "balanceOf",
          args: [account],
        });
        setBalance(b as bigint);
      } catch {
        /* balance read is best-effort */
      }
      setStatus(`seal claimed (tx ${hash.slice(0, 10)}...)`);
    } catch (e) {
      setStatus(explainRevert(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedGroup = groups.find((g) => g.id === groupId) ?? null;

  return (
    <>
      <h2>Member portal</h2>
      <p>
        Pick the chaupal you belong to. If your connected address is on that
        chaupal&apos;s member list, you can mint your one soul-bound seal — it can
        never be transferred.
      </p>
      {configError ? <p className="err">{configError}</p> : null}

      <div className="row">
        <select
          value={groupId}
          onChange={(e) => setGroupId(Number(e.target.value))}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id} · {g.name}
            </option>
          ))}
        </select>
      </div>

      {selectedGroup ? (
        <p className="mono">
          {selectedGroup.id} · {selectedGroup.name} — local member-list root{" "}
          {selectedGroup.root.slice(0, 12)}...
        </p>
      ) : null}

      {account ? (
        <div className="card">
          <h3>Membership check — chaupal {groupId}</h3>

          {proofStatus === "loading" ? (
            <p className="mono">checking membership...</p>
          ) : proofStatus === "missing" ? (
            <p className="err">
              Your address is not on this chaupal&apos;s member list — pick the
              chaupal you actually belong to.
            </p>
          ) : claimed ? (
            <p className="you">
              Already claimed
              {tokenId !== null ? ` · seal token #${tokenId.toString()}` : ""}{" "}
              — one seal per member.
            </p>
          ) : proof ? (
            <>
              <p>
                You are on this chaupal&apos;s member list. Proof ready (
                {proof.proof.length} nodes) — mint your seal.
              </p>
              <pre>{JSON.stringify(proof.proof, null, 1)}</pre>
              <button disabled={busy} onClick={claim}>
                {busy ? "Claiming..." : "Claim my seal"}
              </button>
            </>
          ) : (
            <p className="mono">loading...</p>
          )}

          {balance !== null && balance > BigInt(0) ? (
            <p className="you">
              Seal balance: {balance.toString()} token
              {balance === BigInt(1) ? "" : "s"} (soul-bound, non-transferable)
            </p>
          ) : null}

          {status ? (
            <p className={status.startsWith("seal claimed") ? "you" : "err"}>
              {status}
            </p>
          ) : null}
        </div>
      ) : (
        <p>Connect a wallet to check membership.</p>
      )}
    </>
  );
}