"use client";

import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, getAddress, type Address } from "viem";
import { CHAIN_ID, RPC_URL } from "@/lib/config";
import { localChain } from "@/lib/chain";

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export function useConnect() {
  const [account, setAccount] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setError("No injected wallet found (e.g. MetaMask)");
        return;
      }
      const client = createWalletClient({
        chain: localChain(CHAIN_ID, RPC_URL),
        transport: custom(window.ethereum as never),
      });
      const [address] = await client.requestAddresses();
      setAccount(getAddress(address));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void connect(), 0);
    if (window.ethereum) {
      const handle = (accounts: unknown[]) => {
        setAccount(
          accounts.length ? getAddress(String(accounts[0])) : null,
        );
      };
      const remove = () => {
        (window.ethereum as { off: (e: string, f: unknown) => void }).off(
          "accountsChanged",
          handle,
        );
      };
      (window.ethereum as { on: (e: string, f: unknown) => void }).on(
        "accountsChanged",
        handle,
      );
      return () => {
        clearTimeout(timer);
        remove();
      };
    }
    return () => clearTimeout(timer);
  }, [connect]);

  return { account, error, connect };
}