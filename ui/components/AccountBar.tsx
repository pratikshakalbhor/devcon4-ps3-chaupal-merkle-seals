"use client";

import Link from "next/link";
import { useConnect } from "@/components/useConnect";

export function AccountBar() {
  const { account, error, connect } = useConnect();
  return (
    <nav className="bar">
      <Link href="/">Chaupal Seal</Link>
      <Link href="/steward">Steward</Link>
      <Link href="/claim">Claim</Link>
      <span className="spacer" />
      {error ? <span className="err">{error}</span> : null}
      {account ? (
        <span className="mono">{account}</span>
      ) : (
        <button onClick={connect}>Connect wallet</button>
      )}
    </nav>
  );
}