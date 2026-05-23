import { z } from "zod";
import type { ContentSchema } from "./index";

export const spiritualPracticeSchema: ContentSchema = {
  contentType: "SPIRITUAL_PRACTICE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(50),
    practiceKind: z.enum([
      "contemplative_prayer",
      "lectio_divina",
      "examen",
      "fasting",
      "almsgiving",
      "pilgrimage",
      "stations_of_the_cross",
      "spiritual_direction",
      "discernment",
      "vocation",
      "mortification",
      "other",
    ]),
    instructions: z.string().min(50),
    background: z.string().optional(),
    tradition: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    frequency: z.string().optional(),
    relatedPrayers: z.array(z.string()).default([]),
    relatedSaints: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A Catholic spiritual practice — Ignatian examen, lectio divina, fasting, pilgrimage, stations of the cross, etc. Captures how, why, and from which tradition (Ignatian, Carmelite, Benedictine, etc.) the practice comes.",
    accuracyRules: [
      "Attribute the practice to its proper spiritual tradition (Ignatian, Carmelite, Benedictine, Dominican, etc.) when applicable.",
      "Do not conflate Catholic contemplative prayer with non-Catholic meditation techniques.",
      "Source instructions from approved spiritual writers (Doctors of the Church, recognized teachers) — never anonymous online content.",
      "Cross-reference at least two approved sources.",
    ],
    requiredFields: ["slug", "title", "summary", "practiceKind", "instructions", "citations"],
    optionalFields: [
      "background",
      "tradition",
      "durationMinutes",
      "frequency",
      "relatedPrayers",
      "relatedSaints",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
