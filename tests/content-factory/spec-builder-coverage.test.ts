/**
 * Every spec-required content type has a builder exported from
 * @/lib/content-factory.
 *
 * The spec lists 13 builders:
 *
 *   PrayerBuilder
 *   SaintBuilder
 *   MarianApparitionBuilder
 *   ParishBuilder
 *   DevotionBuilder
 *   NovenaBuilder
 *   SacramentBuilder
 *   RosaryBuilder
 *   ConsecrationBuilder
 *   SpiritualGuidanceBuilder
 *   LiturgyBuilder
 *   HistoryBuilder
 *   ScriptureBlockBuilder (exposed as `buildScriptureBlock` function)
 *
 * This test pins those exports so a future schema change cannot
 * silently drop one. It also asserts each Builder object exposes
 * the documented BuilderOutcome union via its `build` return type
 * — verified by calling each builder once and asserting the
 * outcome is in the spec's enum.
 */

import { describe, expect, it } from "vitest";
import * as factory from "@/lib/content-factory";

const SPEC_BUILDER_OBJECTS = [
  "PrayerBuilder",
  "SaintBuilder",
  "MarianApparitionBuilder",
  "ParishBuilder",
  "DevotionBuilder",
  "NovenaBuilder",
  "SacramentBuilder",
  "RosaryBuilder",
  "ConsecrationBuilder",
  "SpiritualGuidanceBuilder",
  "LiturgyBuilder",
  "HistoryBuilder",
] as const;

const SPEC_BUILDER_OUTCOMES = [
  "built_complete_package",
  "build_failed_missing_required_fields",
  "wrong_content",
  "source_not_allowed",
  "duplicate",
  "not_supported_by_source",
  "source_exhausted",
] as const;

describe("every spec-required builder is exported from @/lib/content-factory", () => {
  for (const name of SPEC_BUILDER_OBJECTS) {
    it(`exports ${name} as a Builder object with build() and contentType`, () => {
      const exp = (factory as unknown as Record<string, unknown>)[name];
      expect(exp).toBeDefined();
      const builder = exp as { build: unknown; contentType: unknown };
      expect(typeof builder.build).toBe("function");
      expect(typeof builder.contentType).toBe("string");
    });
  }

  it("exports buildScriptureBlock as a function (scripture blocks attach to packages, not stand-alone)", () => {
    expect(typeof (factory as unknown as Record<string, unknown>).buildScriptureBlock).toBe(
      "function",
    );
  });

  it("exposes all 12 Builder objects (Prayer, Saint, MarianApparition, Parish, Devotion, Novena, Sacrament, Rosary, Consecration, SpiritualGuidance, Liturgy, History)", () => {
    expect(SPEC_BUILDER_OBJECTS).toHaveLength(12);
    for (const name of SPEC_BUILDER_OBJECTS) {
      expect((factory as unknown as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe("every builder's BuilderOutcome union matches the spec", () => {
  // Each builder is called once with an obviously-wrong document so
  // we can observe what outcome it returns. The outcome MUST be one
  // of the spec's enum values — never a freeform string.
  for (const name of SPEC_BUILDER_OBJECTS) {
    it(`${name} returns a documented BuilderOutcome on an unapproved-source fixture`, () => {
      const builder = (factory as unknown as Record<string, unknown>)[name] as {
        build: (ctx: {
          document: ReturnType<typeof factory.syntheticSourceDocument>;
        }) => { outcome: string };
        contentType: string;
      };
      const doc = factory.syntheticSourceDocument({
        sourceUrl: "https://random.example.org/page",
        sourceHost: "random.example.org",
        sourceTitle: "Unrelated random page",
        rawBody: "This page has no relevant content for any builder.",
        sourcePurposes: {}, // no source purposes -> unapproved
      });
      const result = builder.build({ document: doc });
      expect(SPEC_BUILDER_OUTCOMES as readonly string[]).toContain(result.outcome);
    });
  }
});
