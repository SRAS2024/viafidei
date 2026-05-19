/**
 * Liturgy classifier tests (spec §14).
 */

import { describe, expect, it } from "vitest";
import { classifyLiturgyPage } from "@/lib/content-factory/normalize/liturgy-classifier";

describe("classifyLiturgyPage()", () => {
  it("accepts a liturgical-formation page", () => {
    const r = classifyLiturgyPage({
      title: "Order of the Mass",
      body: "The Mass is divided into the Introductory Rites, the Liturgy of the Word, the Liturgy of the Eucharist, and the Concluding Rites.",
      type: "mass_structure",
    });
    expect(r.approved).toBe(true);
  });

  it("rejects a Mass schedule page", () => {
    const r = classifyLiturgyPage({
      title: "Mass Schedule",
      body: "Sunday: 8am, 10am, 12pm. Mass schedule for this week.",
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/Mass schedule/);
  });

  it("rejects a parish bulletin", () => {
    const r = classifyLiturgyPage({
      title: "Weekly Bulletin",
      body: "This week's bulletin from St. Mary's.",
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/bulletin/);
  });

  it("rejects a livestream", () => {
    const r = classifyLiturgyPage({
      title: "Watch Mass Live",
      body: "Join our livestream Sunday morning.",
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/livestream/i);
  });

  it("rejects a parish event registration", () => {
    const r = classifyLiturgyPage({
      title: "Lenten Retreat 2024",
      body: "Register for our Lenten retreat today. Join us for a weekend.",
    });
    expect(r.approved).toBe(false);
  });

  it("rejects an unknown declared type", () => {
    const r = classifyLiturgyPage({
      title: "Liturgy of the Word",
      body: "The Liturgy of the Word includes scripture readings.",
      type: "not_a_real_type",
    });
    expect(r.approved).toBe(false);
  });

  it("rejects a page with no formation cues at all", () => {
    const r = classifyLiturgyPage({
      title: "Random",
      body: "Some completely unrelated body text.",
    });
    expect(r.approved).toBe(false);
  });
});
