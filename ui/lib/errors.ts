const MESSAGES: Record<string, string> = {
  AlreadyClaimed:
    "You have already claimed a seal for this chaupal. One seal per member.",
  NotInMerkleTree:
    "The proof does not verify: this address is not on the chaupal's current member list, or the on-chain root is out of date relative to the member list. Ask the steward to press Update root if the list changed.",
  RootNotSet:
    "This chaupal's steward has not published a Merkle root yet. Ask them to open the steward console and press Update root.",
  GroupNotRegistered:
    "This chaupal is not registered. Check that you selected the right chaupal.",
  Soulbound: "Chaupal seals are soul-bound and cannot be transferred.",
};

export function explainRevert(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|request rejected/i.test(msg)) {
    return "Transaction rejected in your wallet.";
  }
  const named = msg.match(/Custom error name: "([A-Za-z0-9_]+)"/)?.[1];
  const key = named ?? Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (key && MESSAGES[key]) return MESSAGES[key];
  return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
}