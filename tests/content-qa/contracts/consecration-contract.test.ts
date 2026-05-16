import { describe, expect, it } from "vitest";
import { validateConsecrationPackage } from "@/lib/content-qa/contracts/consecration";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const DIVINE_MERCY = staticPurposesForHost("thedivinemercy.org");

function buildDays(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    dayNumber: i + 1,
    prayers: ["Day prayer: O Jesus, I consecrate myself. Amen."],
  }));
}

describe("ConsecrationPackage contract", () => {
  it("accepts a full consecration guide", () => {
    const result = validateConsecrationPackage(
      {
        contentType: "Consecration",
        slug: "33-day-marian-consecration",
        title: "33-Day Marian Consecration",
        sourceUrl: "https://www.thedivinemercy.org/consecration",
        sourceHost: "thedivinemercy.org",
        payload: {
          consecrationName: "33-Day Marian Consecration",
          background:
            "Saint Louis de Montfort's preparation for the Total Consecration to Jesus through Mary.",
          durationDays: 33,
          dailyStructure: "Each day: read the meditation, then pray the day's prayers.",
          dailyPrayers: buildDays(33),
          finalConsecrationPrayer: "I, [name], a faithless sinner, renew and ratify today...",
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("publish");
  });

  it("rejects a consecration missing days", () => {
    const result = validateConsecrationPackage(
      {
        contentType: "Consecration",
        slug: "no-days",
        title: "No Days",
        sourceUrl: "https://www.thedivinemercy.org/consecration",
        sourceHost: "thedivinemercy.org",
        payload: {
          consecrationName: "No Days",
          background: "Background.",
          durationDays: 33,
          dailyStructure: "",
          dailyPrayers: [],
          finalConsecrationPrayer: "Final prayer.",
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("dailyPrayers");
  });

  it("rejects a consecration missing daily prayers", () => {
    const days = buildDays(33);
    days[5] = { dayNumber: 6, prayers: [] };
    const result = validateConsecrationPackage(
      {
        contentType: "Consecration",
        slug: "no-prayers-day-6",
        title: "Missing Day Prayers",
        sourceUrl: "https://www.thedivinemercy.org/consecration",
        sourceHost: "thedivinemercy.org",
        payload: {
          consecrationName: "Missing Day Prayers",
          background: "Background.",
          durationDays: 33,
          dailyStructure: "Each day.",
          dailyPrayers: days,
          finalConsecrationPrayer: "Final prayer.",
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
  });

  it("rejects a consecration missing the final prayer", () => {
    const result = validateConsecrationPackage(
      {
        contentType: "Consecration",
        slug: "no-final",
        title: "No Final Prayer",
        sourceUrl: "https://www.thedivinemercy.org/consecration",
        sourceHost: "thedivinemercy.org",
        payload: {
          consecrationName: "No Final Prayer",
          background: "Background.",
          durationDays: 33,
          dailyStructure: "Each day.",
          dailyPrayers: buildDays(33),
          finalConsecrationPrayer: "",
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("finalConsecrationPrayer");
  });

  it("deletes a consecration event advertisement", () => {
    const result = validateConsecrationPackage(
      {
        contentType: "Consecration",
        slug: "consecration-retreat",
        title: "Consecration Retreat 2026",
        sourceUrl: "https://www.thedivinemercy.org/event",
        sourceHost: "thedivinemercy.org",
        payload: {
          consecrationName: "Consecration Retreat 2026",
          background:
            "Join us for our consecration retreat. Register now! Tickets available. Click here to RSVP.",
          durationDays: 33,
          dailyStructure: "Each day.",
          dailyPrayers: buildDays(33),
          finalConsecrationPrayer: "Final prayer.",
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("delete");
  });
});
