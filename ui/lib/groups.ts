import "server-only";
import path from "node:path";
import fs from "node:fs/promises";

export interface GroupInfo {
  id: number;
  name: string;
  steward: string;
}

const ROOT = path.resolve(process.cwd(), "..", "data");

export async function getGroups(): Promise<GroupInfo[]> {
  const raw = await fs.readFile(path.join(ROOT, "groups.json"), "utf8");
  const data = JSON.parse(raw) as { groups: { name: string; steward: string }[] };
  return data.groups.map((g, id) => ({
    id,
    name: g.name,
    steward: g.steward.toLowerCase(),
  }));
}

export async function getMembers(groupId: number): Promise<string[]> {
  const raw = await fs.readFile(path.join(ROOT, "groups.json"), "utf8");
  const data = JSON.parse(raw) as {
    groups: { name: string; steward: string; members: string[] }[];
  };
  return data.groups[groupId]?.members ?? [];
}

export async function getRoot(groupId: number): Promise<string> {
  const raw = await fs.readFile(path.join(ROOT, "roots.json"), "utf8");
  const roots = JSON.parse(raw) as Record<string, string>;
  return roots[String(groupId)];
}