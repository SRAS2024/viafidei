import { z } from "zod";
import type { ContentSchema } from "./index";

const guideStepSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(20),
});

export const guideSchema: ContentSchema = {
  contentType: "GUIDE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(20),
    kind: z.enum([
      "rosary",
      "confession",
      "adoration",
      "consecration",
      "discernment",
      "vocation",
      "lent_preparation",
      "advent_preparation",
      "rcia",
      "ocia",
      "general",
    ]),
    sacramentKey: z
      .enum([
        "baptism",
        "confirmation",
        "eucharist",
        "reconciliation",
        "anointing_of_the_sick",
        "holy_orders",
        "matrimony",
      ])
      .optional(),
    steps: z.array(guideStepSchema).min(2),
    durationMinutes: z.number().int().positive().optional(),
    relatedPrayers: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A practical how-to guide for a Catholic practice (preparing for confession, praying the rosary, making a consecration, etc.). Step-by-step, sourced from approved manuals and pastoral guidance.",
    accuracyRules: [
      "Guides must mirror the Church's pastoral practice — not personal devotion variants.",
      "Confession examination-of-conscience guides must base questions on the Decalogue / Beatitudes / Precepts of the Church, not invented checklists.",
      "Sacrament-preparation guides must reference the appropriate liturgical book or USCCB pastoral text.",
      "Cross-reference at least two approved sources before publishing.",
    ],
    requiredFields: ["slug", "title", "summary", "kind", "steps", "citations"],
    optionalFields: ["sacramentKey", "durationMinutes", "relatedPrayers"],
    preferredSourceHosts: ["usccb.org", "vatican.va", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
