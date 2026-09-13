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
import { SEAL_ADDRESS, CHAIN_ID, RPC_URL } from "@/lib/config";
import { localChain } from "@/lib/chain";
import { ABI } from "@/lib/contract";

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

export default function MemberPage() {
  const { account } = useConnect();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState<number>(0);
  const [proof, setProof] = useState<ProofPayload | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => setStatus("failed to load groups"));
  }, []);

  useEffect(() => {
    if (!account) {
      const t = setTimeout(() => {
        setProof(null);
        setClaimed(false);
        setStatus("");
      }, 0);
      return () => clearTimeout(t);
    }
    fetch(`/api/proof?groupId=${groupId}&address=${account}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      })
      .then(setProof)
      .catch(() => setProof(null));
    if (isAddress(SEAL_ADDRESS)) {
      publicClient()
        .readContract({
          address: SEAL_ADDRESS as Address,
          abi: ABI,
          functionName: "isClaimed",
          args: [BigInt(groupId), account],
        })
        .then((v) => setClaimed(Boolean(v)))
        .catch(() => setClaimed(false));
    }
  }, [account, groupId]);

  async function claim() {
    if (!account || !proof) return setStatus("no proof loaded — are you a member?");
    setBusy(true);
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
        functionName: "claim",
        args: [BigInt(groupId), proof.proof as readonly `0x${string}`[]],
      });
      const receipt = await publicClient().waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: ABI, logs: receipt.logs, eventName: "SealClaimed" });
      const token = logs[0]?.args.tokenId;
      setTokenId(String(token ?? "?"));
      setClaimed(true);
      setStatus(`seal claimed (tx ${hash.slice(0, 10)}…)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Member portal</h2>
      <p>
        Choose your chaupal. If your connected address is on that chaupal&apos;s
        member list, your Merkle proof is loaded here and you can mint your one
        soul-bound seal.
      </p>
      <div className="row">
        <select value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id} · {g.name}
            </option>
          ))}
        </select>
      </div>
      <p className="mono">
        root: {groups.find((g) => g.id === groupId)?.root}
      </p>
      {account ? (
        <>
          <div className="card">
            <h3>Membership check</h3>
            {claimed ? (
              <p className="you">
                Already claimed{tokenId ? ` · token #${tokenId}` : ""} — one seal
                per member.
              </p>
            ) : proof ? (
              <>
                <p>You are on this chaupal&apos;s member list. Proof ready:</p>
                <pre>{JSON.stringify(proof.proof, null, 1)}</pre>
                <button disabled={busy} onClick={claim}>
                  Claim my seal
                </button>
              </>
            ) : (
              <p className="err">
                Your address is not on this chaupal&apos;s member list (or the
                group file is missing).
              </p>
            )}
          </div>
          {status ? <p className="err">{status}</p> : null}
        </>
      ) : (
        <p>Connect a wallet to check membership.</p>
      )}
    </>
  );
}