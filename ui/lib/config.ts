export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();

const chain = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
export const CHAIN_ID = chain ? Number(chain) : 31337;

const rpc = process.env.NEXT_PUBLIC_RPC_URL?.trim();
export const RPC_URL = rpc || "http://127.0.0.1:8545";

export const CHAUPAL_COUNT = 12;

export const ZERO_ROOT =
  "0x0000000000000000000000000000000000000000000000000000000000000000";