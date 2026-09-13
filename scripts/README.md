# Chaupal Seal — off-chain tree tooling

Support scripts for `src/ChaupalSeal.sol` (12 independent chaupal groups, one
soul-bound "seal" ERC-721 per member). Member lists stay **private off-chain**;
only a Merkle root per group is ever published on-chain.

## Files

| Script | Purpose |
|---|---|
| `generate-groups.mjs` | **Sample-data generator** — seeds `data/groups.json` with 12 groups for local/anvil testing. This is clearly sample/test data, **not real member data** (groups 0–9 use Foundry's public anvil accounts; groups 10–11 use sha256-derived placeholders). It **overwrites** the file, so run it only to (re)seed samples. |
| `build-tree.mjs` | Reads `data/groups.json`, builds one Merkle tree per group, writes roots + proofs + Forge fixtures. Run via `npm run trees`. Idempotent — same lists in, identical bytes out. |

## data/groups.json schema

```jsonc
{
  "chainId": 31337,
  "groups": [
    { "name": "Khed Chaupal", "steward": "0xf39F...", "members": ["0xf39F...", "0x7099..."] },
    { "name": "Pimpalgaon Chaupal", "steward": "0x7099...", "members": ["..."] }
    // ... groups[0..11]; groupId == array index
  ]
}
```

`groupId` is the **array index** (0–11), matching the contract's constructor
`address[12]` and every `setRoot`/`claim` call. The canonical member list for a
group is `groups[g].members`. The file contains **only member/steward addresses —
no private keys**. The local anvil signing key is never stored in the repo;
`scripts/live-smoke.sh` reads it at runtime from anvil's own startup output.

## Leaf covenant (why the exact formula matters)

Every leaf is derived from the **member address + groupId**, so a proof for one
chaupal can never verify against another. The formula is byte-locked to the
contract:

```txt
leaf = keccak256(keccak256(abi.encode(member, groupId)))     // off-chain (OZ tree lib)
     = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, groupId))))  // on-chain src/ChaupalSeal.sol:58
```

- This is **standard ABI encoding, double-hashed** — NOT
  `keccak256(abi.encodePacked(memberAddress, groupId))`. `abi.encodePacked`
  with a 20-byte address produces a different preimage and the contract's
  `MerkleProof.verify` would reject every genuine proof.
- `@openzeppelin/merkle-tree`'s `StandardMerkleTree.of(values, ["address","uint256"])`
  hard-codes `keccak256(keccak256(abi.encode(...)))` (see
  `node_modules/@openzeppelin/merkle-tree/dist/hashes.js`), and sorts sibling
  pairs before hashing — the same behaviour as OZ Solidity's
  `Hashes.commutativeKeccak256`, so proof ordering is handled on both sides.
- `build-tree.mjs` **asserts** `tree.leafHash([addr, g]) === manual double-keccak`
  for every member and fails the build on any drift.

## Outputs of `npm run trees`

| File | Contents |
|---|---|
| `data/roots.json` | `{ "0": root0, ..., "11": root11 }` — one root per group |
| `data/trees/group-\<g\>.json` | full OZ tree dump (for proof lookups / future use) |
| `data/proofs/group-\<g\>.json` | `{ "0xAddr...": [proof nodes], ... }` per member |
| `data/proofs/all.json` | `{ "<groupId>": { "0xAddr...": [nodes] } }` combined |
| `data/forge/group-\<g\>.json` | Forge-test fixtures (root + member proofs) |

## Steward workflow when membership changes

Membership is off-chain, so a change is: **edit the list → rebuild → push the
new root**. The script does the first two steps; the last one is a **signed
transaction**, done via the steward UI or a `setRoot` call, never by a script
that owns keys.

1. **A member joins / leaves**: edit that group's `members` array in
   `data/groups.json` only (add or remove the `0x...` address). If you want a
   fresh sample list instead of making a real change, `npm run groups` first.
2. **Regenerate** that group's tree + all proofs + roots:
   ```bash
   npm run trees
   ```
   → `data/roots.json` now holds the new root for your group; proofs for every
   current member are re-issued to `data/proofs/`. Members on other groups are
   untouched. Idempotent run: no list change ⇒ no byte change.
3. **Publish the root on-chain** (your group only):
   - Steward console (`/steward`): it shows the new local root with an
     **out of date** badge next to the on-chain root — press **Update root
     on-chain**.
   - or directly: `cast send $SEAL "setRoot(uint256,bytes32)" $G $NEW_ROOT --from $YOUR_STEWARD_ADDR ...`
   - Only the recorded steward of that group may do this (`onlySteward`). The
     push is now a **UI button / wallet-signed tx** — no terminal is required
     for the on-chain step itself.

> After a rotation, previously-issued proofs under the old root stop verifying
> (`NotInMerkleTree`); already-minted seals remain in their owners' wallets
> (they are soul-bound; there is no burn). See README §2.1 for the full
> bootstrap + membership lifecycle semantics.

## Example (local anvil)

```bash
npm install          # root: pulls @openzeppelin/merkle-tree + ethers
npm run groups       # (re)seed sample data/groups.json
npm run trees        # build trees/proofs/roots/forge fixtures
forge test           # contract tests run against data/forge fixtures
bash scripts/live-smoke.sh   # deploy on anvil + claim + revert checks
```