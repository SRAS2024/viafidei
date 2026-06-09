/**
 * Content-subtitle publishing skill. Generates a deterministic descriptive
 * subtitle for a content item and stores it on the published row, so the public
 * page can render it under the title. Low-risk, idempotent (re-running just
 * re-derives the same subtitle).
 */

import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

export const subtitleSkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "publish_content_subtitle",
    purpose: "Generate and store a descriptive subtitle on a published content row.",
    category: "PUBLISHING",
    riskLevel: "low",
    inputs: ["contentType", "slug", "contentSubtype", "fields"],
    outputs: ["subtitle"],
    successMetrics: ["subtitle_stored"],
    idem: (ctx) =>
      `publish_content_subtitle:${String((ctx.input as Record<string, unknown>).slug ?? "")}`,
    run: async (ctx: SkillContext) => {
      const i = ctx.input as Record<string, unknown>;
      const contentType = String(ctx.contentType ?? i.contentType ?? "");
      const subtitle = generateContentSubtitle({
        contentType,
        contentSubtype: ctx.contentSubtype ?? (i.contentSubtype as string | null) ?? null,
        title: String(i.title ?? ""),
        fields: (i.fields as Record<string, unknown>) ?? i,
      });
      const slug = String(i.slug ?? "");
      const updated = await ctx.prisma.publishedContent
        .updateMany({ where: { contentType: contentType as never, slug }, data: { subtitle } })
        .catch(() => ({ count: 0 }));
      return {
        ok: updated.count > 0,
        detail: updated.count > 0 ? `subtitle set: "${subtitle}"` : "no published row to update",
        outputEntityType: "PublishedContent",
        outputEntityId: slug,
      };
    },
  }),
];
