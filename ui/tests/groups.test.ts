import { describe, expect, it } from "vitest";
import { getGroups, getMembers, getRoot } from "@/lib/groups";

describe("lib/groups", () => {
  it("loads all 12 committed chaupal groups with names and stewards", async () => {
    const groups = await getGroups();
    expect(groups).toHaveLength(12);
    for (const g of groups) {
      expect(g.name).toBeTruthy();
      expect(g.steward).toMatch(/^0x[0-9a-f]{40}$/);
      expect(g.steward).not.toBe(g.steward.toUpperCase());
    }
  });

  it("returns a committed root for every group", async () => {
    for (let id = 0; id < 12; id++) {
      const root = await getRoot(id);
      expect(root).toMatch(/^0x[0-9a-f]{64}$/);
      expect(root).not.toBe("0x0000000000000000000000000000000000000000000000000000000000000000");
    }
  });

  it("returns the committed member list for a group", async () => {
    const members = await getMembers(0);
    expect(members.length).toBeGreaterThan(0);
    for (const m of members) {
      expect(m).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("returns an empty member list for an unknown group", async () => {
    expect(await getMembers(99)).toEqual([]);
  });
});