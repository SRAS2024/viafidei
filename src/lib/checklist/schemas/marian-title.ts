import { z } from "zod";
import type { ContentSchema } from "./index";

export const marianTitleSchema: ContentSchema = {
  contentType: "MARIAN_TITLE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(20),
    origin: z.string().min(20),
    feastDay: z
      .string()
      .regex(/^\d{2}-\d{2}$/)
      .optional(),
    region: z.string().optional(),
    associatedApparitionSlug: z.string().optional(),
    associatedPrayers: z.array(z.string()).default([]),
    iconographyNotes: z.string().optional(),
    theologicalSignificance: z.string().min(20),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A title or invocation of the Blessed Virgin Mary (e.g. Our Lady of Sorrows, Theotokos, Stella Maris). Captures origin, theology, feast day if any, and any associated approved apparition.",
    accuracyRules: [
      "A Marian title is NOT the same as an apparition. Link to an apparition only if it is approved by the Church.",
      "Do not invent feast days. Many Marian titles have no liturgical feast.",
      "Theological significance MUST come from approved teaching, not popular devotion writing.",
      "Distinguish defined dogmas (Mother of God, Immaculate Conception, etc.) from popular titles.",
    ],
    requiredFields: ["slug", "title", "summary", "origin", "theologicalSignificance", "citations"],
    optionalFields: [
      "feastDay",
      "region",
      "associatedApparitionSlug",
      "associatedPrayers",
      "iconographyNotes",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
