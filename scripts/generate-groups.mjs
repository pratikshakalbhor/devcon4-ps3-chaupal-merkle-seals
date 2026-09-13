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

const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea895c8328aabc1d5a16f",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
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
      { chainId: 31337, anvilKeys: ANVIL_KEYS, groups: groups() },
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