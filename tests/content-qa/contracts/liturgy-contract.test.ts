import { describe, expect, it } from "vitest";
import { validateLiturgyPackage } from "@/lib/content-qa/contracts/liturgy";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const VATICAN = staticPurposesForHost("vatican.va");

describe("LiturgyPackage contract", () => {
  it("accepts liturgical formation", () => {
    const result = validateLiturgyPackage(
      {
        contentType: "Liturgy",
        slug: "mass-structure",
        title: "The Structure of the Mass",
        sourceUrl: "https://www.vatican.va/mass",
        sourceHost: "vatican.va",
        payload: {
          liturgyKind: "Mass structure",
          title: "The Structure of the Mass",
          summary: "An explanation of the four parts of the Mass.",
          body: "The Mass structure includes the Liturgy of the Word and the Liturgy of the Eucharist. The Eucharistic Prayer is the heart of the Mass. The Order of Mass follows a specific ritual.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes a Mass schedule", () => {
    const result = validateLiturgyPackage(
      {
        contentType: "Liturgy",
        slug: "mass-schedule",
        title: "Sunday Mass Times",
        sourceUrl: "https://www.vatican.va/schedule",
        sourceHost: "vatican.va",
        payload: {
          liturgyKind: "Mass structure",
          title: "Sunday Mass Times",
          summary: "Mass schedule.",
          body: "Mass schedule: Sunday 8am, 10am, 12pm. Daily Mass at 7am Mon-Fri.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a livestream", () => {
    const result = validateLiturgyPackage(
      {
        contentType: "Liturgy",
        slug: "live-mass",
        title: "Live Mass Today",
        sourceUrl: "https://www.vatican.va/live",
        sourceHost: "vatican.va",
        payload: {
          liturgyKind: "Mass structure",
          title: "Live Mass Today",
          summary: "Watch live.",
          body: "Watch the live Mass today on YouTube. Click here to stream live.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a bulletin", () => {
    const result = validateLiturgyPackage(
      {
        contentType: "Liturgy",
        slug: "bulletin",
        title: "Weekly Parish Bulletin",
        sourceUrl: "https://www.vatican.va/bulletin",
        sourceHost: "vatican.va",
        payload: {
          liturgyKind: "General liturgical formation",
          title: "Weekly Parish Bulletin",
          summary: "Bulletin.",
          body: "This week's parish bulletin includes announcements, mass times, and events.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes an event page", () => {
    const result = validateLiturgyPackage(
      {
        contentType: "Liturgy",
        slug: "liturgy-event",
        title: "Liturgy Conference 2026",
        sourceUrl: "https://www.vatican.va/event",
        sourceHost: "vatican.va",
        payload: {
          liturgyKind: "Mass structure",
          title: "Liturgy Conference 2026",
          summary: "Conference.",
          body: "Join us for our liturgy conference. Register now! Tickets available.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });
});
