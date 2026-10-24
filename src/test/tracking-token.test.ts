import { describe, it, expect } from "vitest";
import { isValidTrackingToken, isValidCaseRef, TRACKING_TOKEN_RE, CASE_REF_RE } from "@/lib/tracking-token";

describe("tracking token validation", () => {
  const valid = "a".repeat(48);

  it("accepts a genuine 48-character hex token", () => {
    expect(isValidTrackingToken(valid)).toBe(true);
  });

  it("rejects short, long and non-hex tokens", () => {
    expect(isValidTrackingToken("a".repeat(47))).toBe(false);
    expect(isValidTrackingToken("a".repeat(49))).toBe(false);
    expect(isValidTrackingToken("g".repeat(48))).toBe(false);
    expect(isValidTrackingToken("A".repeat(48))).toBe(false);
    expect(isValidTrackingToken("")).toBe(false);
  });

  it("rejects tokens with injected SQL or path characters", () => {
    expect(isValidTrackingToken("' OR '1'='1")).toBe(false);
    expect(isValidTrackingToken("../../etc/passwd" + "a".repeat(34))).toBe(false);
  });
});

describe("case reference validation", () => {
  it("accepts genuine references", () => {
    expect(isValidCaseRef("BLR-T5RV6E")).toBe(true);
    expect(isValidCaseRef("IND-ABC234")).toBe(true);
  });

  it("rejects altered or guessed references", () => {
    expect(isValidCaseRef("BLR-T5RV6")).toBe(false); // too short
    expect(isValidCaseRef("BLR-T5RV6EX")).toBe(false); // too long
    expect(isValidCaseRef("blr-t5rv6e")).toBe(false); // wrong case
    expect(isValidCaseRef("BLR-T5RV10")).toBe(false); // ambiguous characters never issued
    expect(isValidCaseRef("BLRT5RV6E")).toBe(false); // missing separator
    expect(isValidCaseRef("")).toBe(false);
  });

  it("a reference alone is never a token", () => {
    expect(TRACKING_TOKEN_RE.test("BLR-T5RV6E")).toBe(false);
    expect(CASE_REF_RE.test("a".repeat(48))).toBe(false);
  });
});
