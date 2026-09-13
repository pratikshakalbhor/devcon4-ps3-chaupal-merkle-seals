// Builds Merkle trees for all 12 chaupal groups and emits roots + proofs.
// Run via `npm run trees` (rebuilds from data/groups.json — idempotent).
//
// LEAF COVENANT (byte-for-byte with src/ChaupalSeal.sol's claim()):
//   leaves are built with StandardMerkleTree.of(`[addr, groupId]`, ["address",
//   "uint256"]), which computes
//       leaf = keccak256(keccak256(abi.encode(addr, groupId)))
//   exactly matching the on-chain derivation at src/ChaupalSeal.sol:58
//       keccak256(bytes.concat(keccak256(abi.encode(msg.sender, groupId))))
//   (NOT abi.encodePacked — the OZ library and the contract both use standard
//   ABI encoding, double-hashed; anything else makes proofs fail on-chain).
//   groupId is the group's index in data/groups.json (0..11) and is baked into
//   every leaf, so a proof for group A can never verify against group B.
//   Every leaf is assert-checked below against the raw double-keccak.
//
// INPUT:  data/groups.json -> { chainId, groups: [ {name, steward, members: [addr,
//         members: [addr, ...] } ] } (groupId == array index)
// OUTPUT: data/roots.json                 root per group
//         data/trees/group-<g>.json       full OZ tree dump (for proof lookups)
//         data/proofs/group-<g>.json      { address: [proof nodes] }
//         data/proofs/all.json            { <groupId>: { address: [nodes] } }
//         data/forge/group-<g>.json       Forge-test fixtures (root + proofs)
//
// IDEMPOTENT: deterministic given the same member lists (members are deduped
// preserving order); re-running with unchanged data writes identical bytes.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { AbiCoder, keccak256 } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main() {
  const data = JSON.parse(
    await fs.readFile(path.join(ROOT, "data", "groups.json"), "utf8"),
  );
  const groups = data.groups;
  const treesDir = path.join(ROOT, "data", "trees");
  const proofsDir = path.join(ROOT, "data", "proofs");
  const forgeDir = path.join(ROOT, "data", "forge");
  await fs.mkdir(treesDir, { recursive: true });
  await fs.mkdir(proofsDir, { recursive: true });
  await fs.mkdir(forgeDir, { recursive: true });

  const roots = {};
  const allProofs = {};

  for (let g = 0; g < groups.length; g++) {
    const members = [...new Set(groups[g].members)];
    const values = members.map((addr) => [addr, g]);
    const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

    await fs.writeFile(
      path.join(treesDir, `group-${g}.json`),
      JSON.stringify(tree.dump(), null, 2) + "\n",
    );

    const proofs = {};
    members.forEach((addr) => {
      const lib = tree.leafHash([addr, g]);
      const manual = keccak256(
        keccak256(AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [addr, g])),
      );
      if (manual !== lib) {
        throw new Error(`leaf mismatch group ${g} ${addr}: lib=${lib} manual=${manual}`);
      }
      proofs[addr] = tree.getProof([addr, g]);
    });
    allProofs[String(g)] = proofs;
    roots[String(g)] = tree.root;

    await fs.writeFile(
      path.join(proofsDir, `group-${g}.json`),
      JSON.stringify(proofs, null, 2) + "\n",
    );

    await fs.writeFile(
      path.join(forgeDir, `group-${g}.json`),
      JSON.stringify(
        {
          root: tree.root,
          count: members.length,
          members: members.map((addr, i) => ({ a: addr, p: tree.getProof(i) })),
        },
        null,
        2,
      ) + "\n",
    );
  }

  await fs.writeFile(
    path.join(proofsDir, "all.json"),
    JSON.stringify(allProofs, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(ROOT, "data", "roots.json"),
    JSON.stringify(roots, null, 2) + "\n",
  );

  console.log(`Built ${groups.length} trees.`);
  for (const g of Object.keys(roots)) {
    console.log(`  group ${g}: ${roots[g]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});