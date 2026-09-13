import { createPublicClient, http } from "viem";
import { CHAIN_ID, RPC_URL } from "@/lib/config";
import { localChain } from "@/lib/chain";

export function publicClient() {
  return createPublicClient({
    chain: localChain(CHAIN_ID, RPC_URL),
    transport: http(),
  });
}