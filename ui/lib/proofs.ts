import "server-only";
import path from "node:path";
import fs from "node:fs/promises";

export interface ProofPayload {
  proof: string[];
  root: string;
}

const ROOT = path.resolve(process.cwd(), "..", "data", "forge");

export async function getProof(
  groupId: number,
  address: string,
): Promise<ProofPayload | null> {
  const file = path.join(ROOT, `group-${groupId}.json`);
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw) as {
    root: string;
    members: { a: string; p: string[] }[];
  };
  const needle = address.toLowerCase();
  const member = data.members.find((m) => m.a.toLowerCase() === needle);
  if (!member) return null;
  return { proof: member.p, root: data.root };
}