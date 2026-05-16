import { describe, expect, it } from "vitest";
import { validateNovenaPackage } from "@/lib/content-qa/contracts/novena";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const DIVINE_MERCY = staticPurposesForHost("thedivinemercy.org");

function buildDays(count: number) {
  const days = [];
  for (let i = 1; i <= count; i++) {
    days.push({
      dayNumber: i,
      dayTitle: `Day ${i}`,
      dayPrayer: `Day ${i} prayer text. O Lord, hear my prayer. Amen.`,
      closingPrayer: "Closing prayer.",
    });
  }
  return days;
}

describe("NovenaPackage contract", () => {
  it("accepts a complete nine-day novena", () => {
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "divine-mercy-novena",
        title: "Divine Mercy Novena",
        sourceUrl: "https://www.thedivinemercy.org/novena",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "Divine Mercy Novena",
          background:
            "The Divine Mercy Novena was given by Jesus to Saint Faustina Kowalska. It is prayed from Good Friday through Divine Mercy Sunday.",
          purpose: "To obtain mercy for the whole world and for specific intentions.",
          durationDays: 9,
          days: buildDays(9),
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("publish");
  });

  it("rejects a novena missing a day", () => {
    const days = buildDays(9);
    days.splice(3, 1); // remove day 4
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "incomplete-novena",
        title: "Incomplete Novena",
        sourceUrl: "https://www.thedivinemercy.org/novena",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "Incomplete Novena",
          background: "Background.",
          purpose: "Purpose.",
          durationDays: 9,
          days,
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields.some((f) => f.startsWith("days"))).toBe(true);
  });

  it("rejects a novena with a duplicate day", () => {
    const days = buildDays(9);
    days[2] = { ...days[2], dayNumber: 2 }; // day 3 duplicates day 2
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "dup-novena",
        title: "Dup",
        sourceUrl: "https://www.thedivinemercy.org/novena",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "Dup",
          background: "Background.",
          purpose: "Purpose.",
          durationDays: 9,
          days,
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
  });

  it("rejects a novena missing a day prayer", () => {
    const days = buildDays(9);
    days[4] = { ...days[4], dayPrayer: "" }; // day 5 has no prayer
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "no-day-prayer",
        title: "No Day Prayer",
        sourceUrl: "https://www.thedivinemercy.org/novena",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "No Day Prayer",
          background: "Background.",
          purpose: "Purpose.",
          durationDays: 9,
          days,
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields.some((f) => f.includes("dayPrayer"))).toBe(true);
  });

  it("rejects a novena missing background", () => {
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "no-bg",
        title: "No Background",
        sourceUrl: "https://www.thedivinemercy.org/novena",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "No Background",
          background: "",
          purpose: "Purpose.",
          durationDays: 9,
          days: buildDays(9),
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("background");
  });

  it("deletes a novena event announcement", () => {
    const result = validateNovenaPackage(
      {
        contentType: "Novena",
        slug: "novena-event",
        title: "Annual Novena Event 2026",
        sourceUrl: "https://www.thedivinemercy.org/novena-event",
        sourceHost: "thedivinemercy.org",
        payload: {
          novenaName: "Annual Novena Event 2026",
          background:
            "Join us for our annual novena event! Register now. Tickets available at the door. Click here to RSVP.",
          purpose: "An advertised event, not a novena.",
          durationDays: 9,
          days: buildDays(9),
        },
      },
      { sourcePurposes: DIVINE_MERCY },
    );
    expect(result.decision).toBe("delete");
  });
});
