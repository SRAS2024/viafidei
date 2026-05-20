/**
 * Source plan tests.
 *
 * SOURCE_PLAN_MINIMUMS lists the spec-recommended minimum number of
 * factory-ready sources per content type. This test pins those
 * minimums so the moment someone lowers the bar for growth the test
 * fails loudly.
 */

import { describe, expect, it } from "vitest";
import {
  SOURCE_PLAN_MINIMUMS,
  SOURCE_PLAN_CONTENT_TYPES,
  PURPOSE_FLAG_BY_CONTENT_TYPE,
} from "@/lib/ingestion/sources/source-plan";

describe("SOURCE_PLAN_MINIMUMS", () => {
  it("matches the spec recommended minimums one-to-one", () => {
    expect(SOURCE_PLAN_MINIMUMS.Prayer).toBe(5);
    expect(SOURCE_PLAN_MINIMUMS.Saint).toBe(5);
    expect(SOURCE_PLAN_MINIMUMS.Devotion).toBe(4);
    expect(SOURCE_PLAN_MINIMUMS.Novena).toBe(4);
    expect(SOURCE_PLAN_MINIMUMS.Sacrament).toBe(3);
    expect(SOURCE_PLAN_MINIMUMS.Rosary).toBe(3);
    expect(SOURCE_PLAN_MINIMUMS.Consecration).toBe(3);
    expect(SOURCE_PLAN_MINIMUMS.Liturgy).toBe(3);
    expect(SOURCE_PLAN_MINIMUMS.History).toBe(5);
    expect(SOURCE_PLAN_MINIMUMS.Parish).toBe(3);
    expect(SOURCE_PLAN_MINIMUMS.MarianApparition).toBe(3);
  });

  it("covers every major content type", () => {
    expect(SOURCE_PLAN_CONTENT_TYPES).toEqual(
      expect.arrayContaining([
        "Prayer",
        "Saint",
        "Devotion",
        "Novena",
        "Sacrament",
        "Rosary",
        "Consecration",
        "Liturgy",
        "History",
        "Parish",
        "MarianApparition",
      ]),
    );
  });

  it("maps every content type to a real canIngest* purpose flag", () => {
    for (const t of SOURCE_PLAN_CONTENT_TYPES) {
      const flag = PURPOSE_FLAG_BY_CONTENT_TYPE[t];
      expect(flag).toMatch(/^canIngest/);
    }
  });
});
