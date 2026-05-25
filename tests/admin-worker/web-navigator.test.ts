/**
 * Web navigator junk-URL classifier. The navigator MUST refuse to
 * waste fetches on the obvious-junk patterns the spec calls out:
 * livestreams, events, donations, staff, bulletins, school pages,
 * news posts, calendar pages, login, store, ads.
 */

import { describe, expect, it } from "vitest";

import { isJunkUrl } from "@/lib/admin-worker/web-navigator";

describe("isJunkUrl", () => {
  it.each([
    "https://example.org/livestream/",
    "https://example.org/live",
    "https://example.org/watch?v=123",
    "https://parish.example/events/2025-05-01",
    "https://parish.example/calendar/",
    "https://parish.example/donate",
    "https://parish.example/giving/online",
    "https://parish.example/staff/",
    "https://parish.example/bulletin/2025-05-01",
    "https://parish.example/newsletter",
    "https://example.org/school/",
    "https://parish.example/news/some-news-post/",
    "https://example.org/blog/some-post",
    "https://example.org/login",
    "https://example.org/store/",
    "https://example.org/shop/cart",
    "https://example.org/checkout",
    "https://example.org/ad/123",
  ])("rejects %s", (url) => {
    expect(isJunkUrl(url).junk).toBe(true);
  });

  it.each([
    "https://www.vatican.va/content/catechism/en/credo/intro.html",
    "https://www.usccb.org/prayers/our-father",
    "https://example.org/prayers/litany-of-the-sacred-heart",
    "https://example.org/saint/teresa-of-avila",
    "https://example.org/devotions/divine-mercy",
  ])("accepts content-looking URL %s", (url) => {
    expect(isJunkUrl(url).junk).toBe(false);
  });
});
