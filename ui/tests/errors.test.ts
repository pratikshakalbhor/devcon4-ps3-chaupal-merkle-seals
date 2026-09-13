import { describe, expect, it } from "vitest";
import { explainRevert } from "@/lib/errors";

describe("lib/errors", () => {
  it("maps AlreadyClaimed from a custom-error message", () => {
    const e = new Error(
      'The contract function "claim" reverted with the following reason:\nCustom error name: "AlreadyClaimed"\nCustom error arguments: 0',
    );
    expect(explainRevert(e)).toContain("already claimed");
  });

  it("maps NotInMerkleTree", () => {
    expect(explainRevert(new Error('Custom error name: "NotInMerkleTree"'))).toContain(
      "does not verify",
    );
  });

  it("maps RootNotSet", () => {
    expect(explainRevert(new Error('Custom error name: "RootNotSet"'))).toContain(
      "has not published",
    );
  });

  it("maps GroupNotRegistered", () => {
    expect(explainRevert(new Error('Custom error name: "GroupNotRegistered"'))).toContain(
      "not registered",
    );
  });

  it("maps Soulbound", () => {
    expect(explainRevert(new Error('Custom error name: "Soulbound"'))).toContain(
      "soul-bound",
    );
  });

  it("recognizes a wallet rejection regardless of naming format", () => {
    expect(explainRevert(new Error("User rejected the request."))).toContain(
      "rejected in your wallet",
    );
  });

  it("falls back to the raw message for unknown errors", () => {
    expect(explainRevert(new Error("something else went wrong"))).toContain(
      "something else went wrong",
    );
  });
});