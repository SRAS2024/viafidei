/**
 * Content type router — proves:
 *   1. A source not approved for a content type cannot be routed to
 *      that builder, regardless of URL/title signals.
 *   2. URL + title + heading signals rank content types in the
 *      expected order.
 *   3. Negative hints (livestream / event / bulletin / schedule)
 *      reject the candidate.
 */

import { describe, expect, it } from "vitest";
import { routeContentTypes } from "@/lib/content-factory";

describe("routeContentTypes", () => {
  it("excludes content types the source is not approved for", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      title: "Our Father",
      sourcePurposes: { canIngestPrayers: true },
    });
    const types = decision.ranked.map((r) => r.contentType);
    expect(types).toContain("Prayer");
    expect(types).not.toContain("Saint");
    expect(decision.rejected.some((r) => r.contentType === "Saint")).toBe(true);
  });

  it("ranks Prayer first when URL and title both signal Prayer", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      title: "The Our Father — A Prayer for Daily Use",
      sourcePurposes: { canIngestPrayers: true, canIngestSaints: true, canIngestDevotions: true },
    });
    expect(decision.ranked[0].contentType).toBe("Prayer");
    expect(decision.ranked[0].reasons).toContain("url_pattern_match");
    expect(decision.ranked[0].reasons).toContain("title_or_heading_match");
  });

  it("rejects livestreams/events even when URL looks promising", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/sunday-evening-prayer-livestream",
      sourceHost: "example.com",
      title: "Live Stream: Sunday Evening Prayer Service",
      sourcePurposes: { canIngestPrayers: true },
    });
    // Negative hints should knock Prayer down to the rejected list.
    expect(decision.rejected.some((r) => r.contentType === "Prayer")).toBe(true);
  });

  it("returns an empty ranking when the source has no purposes set", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      title: "Our Father",
      sourcePurposes: {},
    });
    expect(decision.ranked).toHaveLength(0);
  });

  it("rejects the full spec list of hard-negative signals", () => {
    // Spec #4 hard negative signals. Each title/URL fragment must
    // cause Prayer (the most-permissively-allowed type here) to land
    // in the rejected set.
    const cases: Array<{ title: string; label: string }> = [
      { title: "Sunday Watch Live: Mass", label: "watch_live" },
      { title: "Weekly Parish Bulletin", label: "bulletin" },
      { title: "Our Staff Page", label: "staff_page" },
      { title: "Donate Now to Our Parish", label: "donation_page" },
      { title: "Catholic School Page", label: "school_page" },
      { title: "Event Registration — Spring Retreat", label: "event_registration" },
      { title: "Mass Schedule for This Week", label: "mass_schedule" },
      { title: "Diocese News Article: Bishop Visit", label: "news_article" },
      { title: "Vatican Press Release", label: "press_release" },
      { title: "Podcast Episode 42: On Prayer", label: "podcast_episode" },
      { title: "Blog Post About Personal Prayer Life", label: "unrelated_blog_post" },
    ];
    for (const c of cases) {
      const decision = routeContentTypes({
        sourceUrl: "https://example.com/prayers/page",
        sourceHost: "example.com",
        title: c.title,
        sourcePurposes: { canIngestPrayers: true },
      });
      expect(
        decision.rejected.some(
          (r) => r.contentType === "Prayer" && r.reason.includes("negative_signal"),
        ),
        `expected Prayer to be rejected for "${c.title}" (label=${c.label})`,
      ).toBe(true);
    }
  });

  it("surfaces the matched negative-signal label in the rejection reason", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/page",
      sourceHost: "example.com",
      title: "Weekly Parish Bulletin",
      sourcePurposes: { canIngestPrayers: true },
    });
    const prayerRejection = decision.rejected.find((r) => r.contentType === "Prayer");
    expect(prayerRejection?.reason).toMatch(/bulletin/);
  });
});
