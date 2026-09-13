import { describe, expect, it } from "vitest";
import { getGroups, getRoot } from "@/lib/groups";

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
});