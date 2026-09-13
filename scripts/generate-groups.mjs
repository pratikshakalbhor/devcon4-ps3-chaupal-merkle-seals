// SAMPLE-DATA GENERATOR (test/example data only — not real member data).
//
// Seeds data/groups.json with 12 chaupal groups for local testing (anvil):
//   groups 0-9 use anvil's well-known public accounts as stewards/members;
//   groups 10-11 use sha256-derived placeholder addresses (no known key).
// It OVERWRITES data/groups.json from scratch — run it only when you want to
// reset the sample lists, NOT after you hand-edited members. To rebuild trees
// after editing data/groups.json, run `npm run trees` instead (see
// scripts/README.md).
//
// NOTE ON KEYS: this script commits NO private keys. It only references anvil's
// *publicly known* account addresses (foundry-rs/foundry). The anvil signing
// key used by scripts/live-smoke.sh is derived at runtime from anvil's own
// startup output, never stored in the repo.

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GROUP_NAMES = [
  "Khed Chaupal",
  "Pimpalgaon Chaupal",
  "Wadgaon Chaupal",
  "Talegaon Chaupal",
  "Umbraj Chaupal",
  "Koregaon Chaupal",
  "Shirval Chaupal",
  "Lonand Chaupal",
  "Phaltan Chaupal",
  "Rahimatpur Chaupal",
  "Vaduj Chaupal",
  "Atpadi Chaupal",
];

const ANVIL = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
];

function address(seed) {
  return getAddress(
    "0x" + createHash("sha256").update(seed).digest("hex").slice(0, 40),
  );
}

function groups() {
  return GROUP_NAMES.map((name, g) => {
    const members = g === 0 ? ANVIL.slice(0, 8).slice() : [];
    for (let i = members.length; i < 8; i++) {
      members.push(address(`member:${g}:${i}`));
    }
    const steward = g < ANVIL.length ? ANVIL[g] : address(`steward:${g}`);
    return { name, steward, members };
  });
}

async function main() {
  const out = path.join(ROOT, "data", "groups.json");
  await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(
      out,
      JSON.stringify(
        { chainId: 31337, groups: groups() },
        null,
        2,
      ) + "\n",
    );
  console.log(`wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});