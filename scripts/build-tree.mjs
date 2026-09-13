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