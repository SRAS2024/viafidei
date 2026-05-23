import { z } from "zod";
import type { ContentSchema } from "./index";

export const prayerSchema: ContentSchema = {
  contentType: "PRAYER",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(20),
    prayerType: z.enum([
      "morning",
      "evening",
      "meal",
      "litany",
      "novena",
      "rosary",
      "marian",
      "general",
      "intercession",
      "consecration",
      "act",
    ]),
    category: z.string().min(1),
    language: z.string().min(2).default("en"),
    officialPrayer: z.string().optional(),
    occasions: z.array(z.string()).default([]),
    relatedSaints: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(1),
    summary: z.string().optional(),
  }),
  instruction: {
    description:
      "A complete Catholic prayer with full official text and contextual metadata. The worker must reproduce the prayer verbatim from approved sources — never paraphrased or invented.",
    accuracyRules: [
      "Do not paraphrase or summarize official prayer text. Reproduce verbatim.",
      "Do not invent indulgences attached to a prayer; cite the official document if one is claimed.",
      "Do not invent promises attached to a prayer.",
      "Match prayer to its liturgical category from approved sources only.",
    ],
    requiredFields: ["slug", "title", "body", "prayerType", "category", "citations"],
    optionalFields: ["officialPrayer", "occasions", "relatedSaints", "summary", "language"],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com", "catholic.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
