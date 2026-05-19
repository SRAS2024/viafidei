/**
 * History classifier tests (spec §11).
 */

import { describe, expect, it } from "vitest";
import {
  APPROVED_HISTORY_CATEGORIES,
  classifyHistoryPage,
} from "@/lib/content-factory/normalize/history-classifier";

describe("classifyHistoryPage()", () => {
  it("accepts a council page with an approved category and a date marker", () => {
    const r = classifyHistoryPage({
      title: "The Council of Trent",
      body: "The Council of Trent took place from 1545-1563. It was a major council of the Catholic Church.",
      category: APPROVED_HISTORY_CATEGORIES[0],
    });
    expect(r.approved).toBe(true);
  });

  it("rejects a news article even when the topic looks historical", () => {
    const r = classifyHistoryPage({
      title: "Vatican announces new initiative",
      body: "By John Doe | June 15, 2024. Breaking news from the Vatican. Click here to read more. Subscribe to our newsletter.",
      category: APPROVED_HISTORY_CATEGORIES[0],
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/news|blog/i);
  });

  it("rejects a category that is not in the approved list", () => {
    const r = classifyHistoryPage({
      title: "Random Topic",
      body: "An event that took place in 1900.",
      category: "RandomCategory",
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/approved/);
  });

  it("rejects a page with no era / date marker", () => {
    const r = classifyHistoryPage({
      title: "Some history",
      body: "An unspecified time period.",
      category: APPROVED_HISTORY_CATEGORIES[0],
    });
    expect(r.approved).toBe(false);
  });
});
