import { describe, it, expect } from "vitest";
import { preferredAreaLanguage, areaCenter, type ServiceArea } from "@/lib/service-area";
import { incidentCoverage } from "@/lib/incident-coverage";
import type { Directory } from "@/lib/directory";
describe("Independent service area, language and jurisdiction", () => {
  it("suggests Telugu for Anantapur without an explicit language", () =>
    expect(preferredAreaLanguage(null, "te")).toBe("te"));
  it("suggests Kannada for Bengaluru without an explicit language", () =>
    expect(preferredAreaLanguage(null, "kn")).toBe("kn"));
  it("preserves explicitly selected English when switching to Anantapur", () =>
    expect(preferredAreaLanguage("en", "te")).toBe("en"));
  it("preserves explicitly selected Telugu when switching to Bengaluru", () =>
    expect(preferredAreaLanguage("te", "kn")).toBe("te"));
  it("uses the configured area center", () =>
    expect(
      areaCenter({
        id: "anantapur",
        name: "Anantapur",
        reporting_enabled: false,
        notice: "",
        source_url: null,
        bounds: {},
        settings: { center: { lat: 14.6819, lng: 77.6006 } },
      } satisfies ServiceArea),
    ).toEqual({ lat: 14.6819, lng: 77.6006 }));
  it("keeps unverified Anantapur coverage unresolved rather than claiming outside the boundary", () => {
    const d = {
      coverage: [
        {
          id: "anantapur",
          reporting_enabled: false,
          bounds: { south: 14, north: 15, west: 77, east: 78 },
        },
      ],
      wards: [
        {
          id: "w",
          active: true,
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [77, 14],
                [78, 14],
                [78, 15],
                [77, 15],
                [77, 14],
              ],
            ],
          },
        },
      ],
      authorities: [],
      routes: [],
      rules: [],
    } as unknown as Directory;
    expect(incidentCoverage(d, 14.6819, 77.6006).status).toBe("unknown");
  });
});
