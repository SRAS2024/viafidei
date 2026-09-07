import { z } from "zod";
import type { ContentSchema } from "./index";

export const riteSchema: ContentSchema = {
  contentType: "RITE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    // The canonical rite key (roman, byzantine, …) this entry describes.
    riteKey: z.string().optional(),
    // Liturgical family and what the entry describes: a rite family, one of
    // the Churches sui iuris, or a Latin use (Ambrosian, Dominican…).
    family: z
      .enum(["latin", "byzantine", "alexandrian", "west_syriac", "east_syriac", "armenian"])
      .optional(),
    entryKind: z.enum(["liturgical_rite", "church_sui_iuris", "latin_use"]).optional(),
    region: z.string().optional(),
    faithfulEstimate: z.string().optional(),
    // The History section shown within the rite's card.
    history: z.string().optional(),
    background: z.string().optional(),
    summary: z.string().optional(),
    citations: z.array(z.string().url()).min(1),
  }),
  instruction: {
    description:
      "A Catholic rite (Roman, Byzantine, Maronite, …) with its history and a short description of its liturgical tradition.",
    accuracyRules: [
      "Describe only the recognized Catholic rites; never invent a rite.",
      "The history section must be drawn from approved sources and cited.",
      "Do not conflate distinct rites or churches sui iuris.",
    ],
    requiredFields: ["slug", "title", "citations"],
    optionalFields: ["riteKey", "history", "background", "summary"],
    preferredSourceHosts: ["vatican.va", "newadvent.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
