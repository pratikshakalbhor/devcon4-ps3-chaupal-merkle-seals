export const ABI = [
  {
    type: "function",
    name: "setRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "root", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "rootOf",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "stewardOf",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isClaimed",
    stateMutability: "view",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "SealClaimed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "groupId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
    ],
  },
] as const;

export type SealedAbi = typeof ABI;