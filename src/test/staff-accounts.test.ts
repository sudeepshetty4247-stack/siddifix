import { describe, it, expect } from "vitest";
import { staffPasswordRule } from "@/lib/staff-accounts.functions";
describe("staff temporary password rule", () => {
  it("rejects short passwords", () => expect(staffPasswordRule("Abc12345")).toBe(false));
  it("rejects missing number", () => expect(staffPasswordRule("Abcdefghijklm")).toBe(false));
  it("accepts 12+ mixed case with number", () => expect(staffPasswordRule("Siddi2026Staff")).toBe(true));
});
