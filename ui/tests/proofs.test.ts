import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { getProof } from "@/lib/proofs";

const data = JSON.parse(
  fs.readFileSync(new URL("../../data/groups.json", import.meta.url), "utf8"),
);
const DAVE: string = data.groups[0].members[0];

describe("lib/proofs", () => {
  it("returns a proof + root for a listed member", async () => {
    const payload = await getProof(0, DAVE);
    expect(payload).not.toBeNull();
    expect(payload!.proof.length).toBeGreaterThan(0);
    expect(payload!.root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is case-insensitive on the address", async () => {
    const a = await getProof(0, DAVE);
    const b = await getProof(0, DAVE.toLowerCase());
    expect(a).toEqual(b);
  });

  it("returns null for a member who is not in that group", async () => {
    expect(await getProof(1, DAVE)).toBeNull();
  });

  it("returns null for an unknown address", async () => {
    expect(
      await getProof(0, "0x0000000000000000000000000000000000000001"),
    ).toBeNull();
  });
});