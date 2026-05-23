import { z } from "zod";
import type { ContentSchema } from "./index";

export const devotionSchema: ContentSchema = {
  contentType: "DEVOTION",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(20),
    background: z.string().optional(),
    devotionType: z.string().min(1),
    subtype: z.string().optional(),
    practiceInstructions: z.string().min(20),
    practiceText: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    relatedPrayers: z.array(z.string()).default([]),
    relatedSaints: z.array(z.string()).default([]),
    indulgences: z
      .object({
        claimed: z.boolean(),
        citation: z.string().optional(),
      })
      .optional(),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A Catholic devotional practice with origin, instructions for how to perform it, and any officially attached graces or indulgences.",
    accuracyRules: [
      "Indulgences must cite the originating Apostolic Penitentiary or Vatican document. If no citation, mark indulgences.claimed=false.",
      "Do not invent promises (such as 'fifteen promises' style claims) unless sourced.",
      "Distinguish private devotions from liturgical devotions explicitly in the background field.",
      "Cross-reference at least two approved sources before publishing.",
    ],
    requiredFields: [
      "slug",
      "title",
      "summary",
      "devotionType",
      "practiceInstructions",
      "citations",
    ],
    optionalFields: [
      "background",
      "subtype",
      "practiceText",
      "durationMinutes",
      "relatedPrayers",
      "relatedSaints",
      "indulgences",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com", "catholiccompany.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
