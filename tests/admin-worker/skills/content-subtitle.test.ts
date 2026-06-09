/**
 * Content subtitle — proves the deterministic generator produces accurate,
 * type-aware subtitles and that the publish_content_subtitle skill stores one
 * on the published row.
 */

import { describe, expect, it, vi } from "vitest";

import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import {
  executeCertifiedSkill,
  noopSkillDeps,
  getSkill,
  ensureSkillsRegistered,
  type SkillContext,
} from "@/lib/admin-worker/skills";

ensureSkillsRegistered();

describe("generateContentSubtitle", () => {
  it("produces accurate, type-aware subtitles", () => {
    expect(generateContentSubtitle({ contentType: "DOCTOR" })).toMatch(/Doctor of the Church/);
    expect(generateContentSubtitle({ contentType: "POPE" })).toMatch(/Pope/);
    expect(
      generateContentSubtitle({
        contentType: "CHURCH_DOCUMENT",
        contentSubtype: "encyclical",
        fields: { pope: "Leo XIII" },
      }),
    ).toBe("Encyclical of Pope Leo XIII");
    expect(
      generateContentSubtitle({ contentType: "PRAYER", contentSubtype: "marian_prayer" }),
    ).toMatch(/Marian prayer/);
    expect(
      generateContentSubtitle({
        contentType: "APPARITION",
        fields: { approvalStatus: "approved" },
      }),
    ).toMatch(/approved/i);
  });

  it("always returns a non-empty subtitle, even for unknown types", () => {
    expect(generateContentSubtitle({ contentType: "WHATEVER" }).length).toBeGreaterThan(0);
  });
});

describe("publish_content_subtitle skill", () => {
  it("generates and stores a subtitle on the published row", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const skill = getSkill("publish_content_subtitle")!;
    const ctx: SkillContext = {
      prisma: { publishedContent: { updateMany } } as never,
      input: { slug: "st-augustine" },
      brainActive: true,
      contentType: "DOCTOR",
      contentSubtype: null,
    };
    const out = await executeCertifiedSkill(skill, ctx, noopSkillDeps());
    expect(out.outcome).toBe("SUCCEEDED");
    expect(updateMany).toHaveBeenCalledTimes(1);
    const data = vi.mocked(updateMany).mock.calls[0][0] as { data: { subtitle: string } };
    expect(data.data.subtitle).toMatch(/Doctor of the Church/);
  });
});
