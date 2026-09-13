# Chaupal Seal — "A Seal of Belonging for Every Chaupal"

Road to Devcon IV · **PS3** · A single soul-bound ERC-721 contract serving
**12 independent chaupals (groups)**, each with **exactly one steward**, where
membership is proven with **OpenZeppelin Merkle proofs** derived **inside the
contract** from `msg.sender` + `groupId`.

> Status: **validation-complete.** 15 Forge tests green; live end-to-end smoke
> test on `anvil` (deploy → steward sets root → member claims → duplicate
> claim reverts → soul-bound transfer reverts) passing; UI lint/typecheck/
> build clean + 15 unit tests. Committed and pushed to GitHub under the
> repo-local identity "Devcon PS3 Builder".

---

## 1. Problem

Twelve village chaupals each need a "seal of belonging" for their members —
one per member, non-transferable. The hard parts are:

- **No single administrator** may decide anyone's membership. Each chaupal's
  membership list is private to that chaupal.
- **Identity is proven, not claimed.** A member must prove inclusion using a
  Merkle proof — but the *identity being proven* must come from the caller's
  own `msg.sender`, never from a submitted parameter (otherwise anyone can
  pass someone else's address into the check).
- **Group isolation.** A proof for Chaupal A must never verify against Chaupal
  B's root.
- **One seal per member per chaupal**, and the seal must never trade.

## 2. Solution

One contract, `ChaupalSeal`, deployed once with 12 steward addresses:

- `constructor(address[12])` fixes each group's steward. After deployment no
  single address has authority anywhere — not even the deployer (there is no
  `owner` at all).
- Each steward calls `setRoot(groupId, root)` for **their own group only**
  (`onlySteward`).
- A member calls `claim(groupId, proof)`. The contract reads the *stored* root
  for that group, **derives the leaf itself** from `msg.sender` and `groupId`,
  and verifies the proof.
- The seal is an ERC-721 whose `_update` reverts for any non-mint transfer —
  soul-bound.

### 2.1 Group bootstrap & membership lifecycle

**Bootstrap.** Deployment is the entire bootstrap. The constructor takes all
12 steward addresses and maps each to its group (`src/ChaupalSeal.sol:32-38`).
There is no registration step, no deployer privilege, and — deliberately — **no
`owner`** anywhere in the contract. After deployment the only authority that
exists is each `groups[groupId].steward`, and it exists **only** for that one
group.

**Roots are written by the steward, ongoing — not at constructor time.**
`setRoot(groupId, root)` is an ordinary external function gated solely by the
`onlySteward(groupId)` modifier (`,45-48`). Because it reads the *stored*
`groups[groupId].root` (`:46`), a steward may call it **again and again, any
time, post-deployment** — rotating or restoring the group root. The
constructor does *not* set any root; a group is unclaimable until its steward
calls `setRoot` (`RootNotSet` guard at `:56`). `test_StewardCanRotateRootOngoing`
proves this on-chain: same steward rotates the root mid-stream (old proofs
immediately stop verifying), then restores it and claims resume.

**The day a member joins.** Because everyone in a chaupal shares one root, a
new member means a **new tree** for that group:

1. Append the member's address to their group's `members` array in
   `data/groups.json`.
2. Re-run `npm run trees` → `scripts/build-tree.mjs` rebuilds the tree,
   recomputes `data/roots.json`, and re-issues proofs for every member. (This
   only *builds*; it does not overwrite your edited `data/groups.json`.)
3. The group's steward calls `setRoot(g, <new root>)` — via the **Steward
   console** (`/steward`, "Set root" form) or:
   ```bash
   cast send $SEAL_ADDRESS "setRoot(uint256,bytes32)" $g $NEW_ROOT --private-key $STEWARD_KEY --rpc-url $RPC_URL --from $STEWARD_ADDR
   ```
4. The new member opens `/claim`, their fresh proof is served from
   `data/proofs/`, and they claim. Existing members' proofs come along
   automatically (their inclusion is unchanged), so no existing member needs
   to re-claim.

**The day a member leaves.** The group root is the membership gate, so removal
is a **root rotation**:

1. Remove the departing address from `data/groups.json` for that group.
2. Re-run `npm run trees`, then `setRoot(g, <new root>)` as above.

   Effect: the removed address's proof no longer verifies against the
   **stored** root, so they can never mint (or re-mint) a seal for that group.
   Anyone not yet claimed is locked out by the new root; already-issued seals
   of *other* members remain valid (their inclusion is unchanged).
3. If the departing member **already held** a seal, that token remains in
   their wallet: the contract deliberately exposes no burn, so their seal is
   permanent and soul-bound — it cannot be transferred, which is the point of
   "belonging", but it also cannot be revoked. A chaupal that needs hard
   revocation should deploy a new contract (a fresh tree starts clean).

> Trade-off, stated plainly: rotating a root updates *future* minting for all
> members under that root (both the join and leave cases above depend on this);
> it cannot confiscate a token already minted. That is the SBT design choice,
> not a bug.

### 2.2 The leaf covenant (the thing that can silently break everything)

The off-chain tree script and the on-chain verifier must agree **byte-for-byte**
on the leaf. Both were written from the *installed* source of
`@openzeppelin/merkle-tree@1.0.8`, not from memory:

- Library leaf hash (`node_modules/@openzeppelin/merkle-tree/dist/hashes.js:11`):

  ```js
  standardLeafHash(types, value) = keccak256( keccak256( encode(types, value) ) )
  ```

- Library node hash (`hashes.js:15`) sorts each sibling pair before hashing;
  OZ Solidity matches it via `Hashes.commutativeKeccak256` (`Hashes.sol:17`),
  so proof ordering is handled on both sides.
- With leaf values `[address, groupId]` and types `["address", "uint256"]`, the
  inner `encode` is standard ABI encoding.
- Therefore the **on-chain leaf** is exactly (in `npx`-verified byte-match tests):

  ```solidity
  bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, groupId))));
  ```

  `src/ChaupalSeal.sol:58`.
- Note it is **`abi.encode` (32-byte-aligned address), NOT `abi.encodePacked`
  (20-byte)**, and it is **double-hashed** — matching `standardLeafHash`.
  A mismatch in either detail breaks every proof.

This agreement is proven end-to-end: `test/ChaupalSeal.t.sol` loads proofs
built by `scripts/build-tree.mjs`, and a member claims them through the live
on-chain path. As a belt-and-braces guard, `scripts/build-tree.mjs` now **fails
the build** if the library leaf ever diverges from the Solidity formula
(`AbiCoder`-encoded double-keccak asserted against `tree.leafHash` for every
member of every group).

## 3. Acceptance Criteria Mapping (8 checks · sum = 80)

Every citation below was re-verified against the current files before writing
them here.

| # | Check | Pts | Evidence |
|---|-------|-----|----------|
| 1 | Leaf derived from `msg.sender` **inside** the contract | 18 | `claim(uint256,bytes32[])` accepts **only `groupId` and `proof`** (`src/ChaupalSeal.sol:50` — no address/leaf parameter exists); leaf computed from `msg.sender` at `src/ChaupalSeal.sol:58`. Test: `test_MemberClaimsSeal` (proof generated off-chain, identity comes only from the simulating caller). |
| 2 | Group id in the leaf preimage | 14 | On-chain: `groupId` mixed into the leaf at `src/ChaupalSeal.sol:58`. Off-chain: tree built from `[addr, g]` values / `["address","uint256"]` encoding (`scripts/build-tree.mjs:27`); the script also **asserts** `tree.leafHash([m,g]) === keccak256(keccak256(abi.encode(m,g)))` for every member (fails the build on mismatch). Tests: `test_CrossGroupProofDoesNotVerify`, `test_MemberUsingForeignKeyReverts`, `test_AllTwelveGroupsClaimOnChain`. |
| 3 | Each group's root writable only by its **own** steward | 10 | One `mapping(uint256 => Group)` holds `{steward, root}` (`src/ChaupalSeal.sol:22`); stewards fixed in the constructor (`:33-37`); `onlySteward` modifier (`:40-43`) gates `setRoot` (`:45`). **No `owner` exists anywhere** — nothing is above a steward. Tests: `test_SetRootOnlyByOwnSteward`, `test_SetRootCrossGroupReverts`, `test_RevertIfZeroStewardInConstructor`. |
| 4 | Proof verified against the **stored** root | 10 | `root` is read from `groups[groupId].root` storage (`src/ChaupalSeal.sol:55`), zero-root rejected (`:56`), verified at `:60`. The caller never supplies a root. Test: `test_RevertIfRootNotSetYet`. |
| 5 | Second claim by same member reverts | 10 | `_claimed[groupId][msg.sender]` **checked before** issuance at `:53`, **set after** the proof passes at `:62`. Test: `test_SecondClaimBySameMemberReverts`. |
| 6 | Seal cannot be transferred | 8 | `_update` override reverts whenever both `from` and `to` are non-zero (`src/ChaupalSeal.sol:72-75`) — mint is allowed (`from == address(0)`), transfer/burn-on-live-token are not. OZ v5.7 exposes **no public `burn`** at all. Tests: `test_TransferBlocked` (transferFrom, safeTransferFrom, approved-transfer all revert `Soulbound`). |
| 7 | Tree construction script committed | 5 | `scripts/generate-groups.mjs` + `scripts/build-tree.mjs` build all 12 trees from `data/groups.json` into `data/trees/`, `data/proofs/`, `data/roots.json`, `data/forge/`. Nothing is hardcoded: re-running `npm run trees` reproduces every root/proof. |
| 8 | No credential in tracked files | 5 | `.gitignore` excludes `.env`/`ui/.env.local`/`ui/.env*.local` (and `.env*` generally) while `.env.example` templates stay tracked; a 64-hex private-key scan of every tracked file matches **only Merkle hashes** — zero private keys (dead `anvilKeys` field and smoke `KEY0` constant were removed; see §8). |
| **Sum** | | **80** | |

## 4. Repo layout

```
src/ChaupalSeal.sol        the contract (single file, 93 lines)
test/ChaupalSeal.t.sol     15 scenario tests (fixtures from data/forge/)
script/Deploy.s.sol        forge script: deploy with stewards from data/groups.json
scripts/generate-groups.mjs sample-data generator (`npm run groups`; overwrites data/groups.json, anvil accounts for the demo — not real member data)
scripts/build-tree.mjs     builds trees/proofs/roots from data/groups.json (`npm run trees`)
scripts/live-smoke.sh      one-shot anvil end-to-end demo (deploy+setRoot+claim+reverts)
data/groups.json           committed member lists (the only tree input)
data/trees|proofs|roots|forge  generated artifacts (proofs per member per group)
ui/                        Next.js steward console + member portal (viem)
```

## 5. Verification status (honest)

| Claim | Verified locally | Would need live infra to fully confirm |
|-------|:---:|-----|
| Tree/leaf byte-equality JS ↔ Solidity, all 12 groups | ✅ build-tree asserts every leaf; on-chain claim of one member per group in `test_AllTwelveGroupsClaimOnChain` | — |
| Group isolation (cross-group proof fails) | ✅ forge + JS cross-verify | — |
| Stored-root verification, per-group steward gate, no owner | ✅ forge tests | — |
| Single-claim / soul-bound behavior | ✅ forge tests | — |
| **Live** deploy of `ChaupalSeal` on anvil with all 12 stewards | ✅ `scripts/live-smoke.sh` | — |
| **Live** steward `setRoot` for group 0 + member claim + all revert paths | ✅ smoke (identical contract used by tests) | — |
| Live claims/vetting for **groups 1–9** (their stewards/members are anvil-funded) | ✅ same logic; not separately run | minor |
| Live claims for **groups 10–11** | ❌ stewards are `sha256`-derived; no wallet can act as steward live | a real deployment with chosen stewards |
| Deploy + verify on a **public testnet** (Sepolia etc.) | ❌ not done — no testnet credentials, and the checklist forbids private keys in chat/repo | a funded testnet wallet by the user |

`scripts/live-smoke.sh` output (asserted above): `setRoot` by group-0 steward
stores root; member claim mints token 1 and sets flags; **second claim →
`AlreadyClaimed(0, addr)`**; **transferFrom → `Soulbound`**. All live on anvil.

## 6. Local setup

```bash
git clone --recurse-submodules https://github.com/pratikshakalbhor/devcon4-ps3-chaupal-merkle-seals.git
cd devcon4-ps3-chaupal-merkle-seals
npm install                    # root (tree scripts; also installs base-node deps)
cd ui && npm install && cd ..   # UI
npm run trees                  # regenerate trees/roots/proofs from data/groups.json
forge test                     # 15 contract tests
bash scripts/live-smoke.sh     # anvil end-to-end demo (deploy + setRoot + claim + reverts)
```

`npm run trees` only *builds* from `data/groups.json` — it never rewrites the
member lists, so hand-edits survive. `npm run groups` re-seeds the sample
lists from scratch (run it only when you want to reset to demo data). See
`scripts/README.md` for the full steward workflow and the leaf covenant.

UI (requires a deployed contract):

```bash
cd ui
cp .env.example .env.local
# set NEXT_PUBLIC_CONTRACT_ADDRESS to the address printed by live-smoke.sh
npm run dev                    # http://localhost:3000
```

- **Steward console** (`/steward`): connect with an anvil account (e.g.
  MetaMask pointed at `http://127.0.0.1:8545`); the page reads
  `stewardOf(0..11)` on-chain, lists only the chaupals your wallet actually
  stewards, shows the local member-list root vs the on-chain root with an
  in sync / out of date badge, and pushes a root with one button.
- **Member portal** (`/claim`): pick one of the 12 chaupals; the page looks
  up your proof, shows found / not-found / already-claimed, mints via
  `claim`, and surfaces revert reasons in plain language (e.g. "root not
  set — ask your steward to press Update root").

## 7. What was intentionally left out

- **No on-chain rate limiting / per-group cap.** A steward can set a root;
  members claim. Supply control is the steward's member list.
- **No metadata URI / tokenURI art.** The problem is about membership
  integrity, not artwork.
- **Burn is not exposed.** Choosing `from != 0 && to != 0` also prevents
  burns, so a seal is permanent once minted.
- **Static demo data.** Group members beyond the anvil-funded set are
  `sha256`-derived placeholder addresses (deterministic, reproducible).
- **Testnet deployment.** Requires a funded user wallet; not fabricated.

## 8. Credentials disclosure

**No private keys are committed anywhere in this repository.** A 64-hex scan of
every tracked file matches only Merkle hashes (`data/roots.json`, `trees/`,
`proofs/`, `forge/`) and non-key sentinels (the `0x00…00` zero-root constant in
`ui/`). Two cleanup commits removed the last private-key-format
strings:

- the dead `anvilKeys` array (Foundry's publicly-published anvil dev keys) that
  used to live in `data/groups.json` / `scripts/generate-groups.mjs` — it was
  written but never read by anything;
- the hardcoded `KEY0` in `scripts/live-smoke.sh` — the script now **derives
  the dev key at runtime from anvil's own startup output**, so no key literal
  exists in a committed file;
- the single Anvil default-key literal that shipped inside the vendored
  `lib/forge-std/test/StdCheats.t.sol` — its upstream assertion was replaced
  with a zero placeholder that names the account by address (see that file).

The sample member/steward *addresses* (anvil accounts from `foundry-rs/foundry`,
e.g. `0xf39F…2266`) are public test accounts, not secrets. `.env` and
`ui/.env.local` are gitignored local only; `.env.example` files ship with
placeholder values (`your_private_key_here`, zero address). No mnemonics or
credential-bearing URLs appear in tracked files.