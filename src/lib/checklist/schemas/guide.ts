import { z } from "zod";
import type { ContentSchema } from "./index";

const guideStepSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  // A step must actually instruct: a one-line title with a token body reads
  // as a table of contents, not a how-to.
  body: z.string().min(40),
});

/** The practice a guide belongs to. The list is closed so the site can group and label guides. */
export const GUIDE_KINDS = [
  "rosary",
  "chaplet",
  "confession",
  "adoration",
  "consecration",
  "discernment",
  "vocation",
  "lent_preparation",
  "advent_preparation",
  "rcia",
  "ocia",
  "mass",
  "liturgy_of_the_hours",
  "sacramental_preparation",
  "funeral",
  "marriage",
  "family",
  "season",
  "pilgrimage",
  "devotion",
  "sacramental",
  "scripture",
  "general",
] as const;

export const guideSchema: ContentSchema = {
  contentType: "GUIDE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(20),
    kind: z.enum(GUIDE_KINDS),
    // Optional grouping used by the /guides chips when the kind alone is too
    // coarse (e.g. a `general` guide about the Mass → category "liturgy").
    category: z.string().optional(),
    // Why / what it is — a short paragraph shown before the steps.
    intro: z.string().optional(),
    whatYouNeed: z.array(z.string()).default([]),
    whenToPray: z.string().optional(),
    tips: z.array(z.string()).default([]),
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
    steps: z.array(guideStepSchema).min(3),
    durationMinutes: z.number().int().positive().optional(),
    relatedPrayers: z.array(z.string()).default([]),
    relatedDevotions: z.array(z.string()).default([]),
    relatedPractices: z.array(z.string()).default([]),
    relatedSaints: z.array(z.string()).default([]),
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
    optionalFields: [
      "sacramentKey",
      "category",
      "intro",
      "whatYouNeed",
      "whenToPray",
      "tips",
      "durationMinutes",
      "relatedPrayers",
      "relatedDevotions",
      "relatedPractices",
      "relatedSaints",
    ],
    preferredSourceHosts: ["usccb.org", "vatican.va", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
