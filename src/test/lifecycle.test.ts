import { describe, expect, it } from "vitest";
import { ACKNOWLEDGEABLE, FIELD_TARGETS, journeyStep, OPEN_STATUSES } from "@/lib/civic";

describe("case lifecycle rules", () => {
  it("shows an acknowledged case at the Acknowledged step", () => {
    expect(journeyStep("accepted")).toBe(2);
    expect(journeyStep("inspection_scheduled")).toBe(2);
  });
  it("treats awaiting verification as work underway, not fixed", () => {
    expect(journeyStep("awaiting_verification")).toBe(3);
    expect(OPEN_STATUSES).toContain("awaiting_verification");
  });
  it("field teams cannot assign, reject or close", () => {
    expect(FIELD_TARGETS).not.toContain("assigned");
    expect(FIELD_TARGETS).not.toContain("rejected");
    expect(FIELD_TARGETS).not.toContain("closed");
  });
  it("only new or reopened cases can be acknowledged", () => {
    expect(ACKNOWLEDGEABLE).toContain("reopened");
    expect(ACKNOWLEDGEABLE).not.toContain("in_progress");
  });
});
