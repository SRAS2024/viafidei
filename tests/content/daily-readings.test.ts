import { describe, expect, it } from "vitest";

import {
  buildReadingFraming,
  buildReadingSkeleton,
  hasAnyBody,
  isSunday,
  mergeSections,
  type ReadingSection,
} from "@/lib/content-shared/daily-readings";

// A known Sunday and a known weekday (UTC).
const SUNDAY = new Date(Date.UTC(2026, 5, 7)); // 2026-06-07 is a Sunday
const WEEKDAY = new Date(Date.UTC(2026, 5, 8)); // Monday

describe("daily-readings helpers", () => {
  it("knows Sunday vs weekday", () => {
    expect(isSunday(SUNDAY)).toBe(true);
    expect(isSunday(WEEKDAY)).toBe(false);
  });

  it("Sunday skeleton includes a Second Reading; weekday does not", () => {
    const sun = buildReadingSkeleton(SUNDAY).map((s) => s.kind);
    const wk = buildReadingSkeleton(WEEKDAY).map((s) => s.kind);
    expect(sun).toContain("SECOND_READING");
    expect(wk).not.toContain("SECOND_READING");
    // Always first reading, psalm, acclamation, gospel.
    for (const k of ["FIRST_READING", "PSALM", "ACCLAMATION", "GOSPEL"]) {
      expect(wk).toContain(k);
    }
  });

  it("skeleton never carries fabricated bodies", () => {
    const sections = buildReadingSkeleton(SUNDAY);
    expect(sections.every((s) => s.body === null && s.citation === null)).toBe(true);
    expect(hasAnyBody(sections)).toBe(false);
  });

  it("framing exposes liturgical metadata + a source link", () => {
    const f = buildReadingFraming(SUNDAY);
    expect(f.date).toBe("2026-06-07");
    expect(f.sourceName).toBe("USCCB");
    expect(f.sourceUrl).toMatch(/usccb/i);
    expect(f.sections.length).toBeGreaterThanOrEqual(5);
  });

  it("mergeSections overlays verified bodies by kind, keeping order", () => {
    const skeleton = buildReadingSkeleton(WEEKDAY);
    const stored: ReadingSection[] = [
      { kind: "GOSPEL", label: "Gospel", citation: "Jn 1:1-5", body: "In the beginning…" },
    ];
    const merged = mergeSections(skeleton, stored);
    const gospel = merged.find((s) => s.kind === "GOSPEL");
    expect(gospel?.body).toBe("In the beginning…");
    expect(gospel?.citation).toBe("Jn 1:1-5");
    expect(hasAnyBody(merged)).toBe(true);
    // first reading still has no fabricated body
    expect(merged.find((s) => s.kind === "FIRST_READING")?.body).toBeNull();
  });
});
