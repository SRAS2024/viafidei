import { z } from "zod";
import type { ContentSchema } from "./index";

export const PARISH_DESIGNATIONS = [
  "parish",
  "shrine",
  "cathedral",
  "major-basilica",
  "minor-basilica",
] as const;

export const parishSchema: ContentSchema = {
  contentType: "PARISH",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    designation: z.enum(PARISH_DESIGNATIONS).default("parish"),
    diocese: z.string().optional(),
    background: z.string().optional(),
    summary: z.string().optional(),
    citations: z.array(z.string().url()).min(1),
  }),
  instruction: {
    description:
      "A real Catholic parish, shrine, cathedral, or basilica directory record with its location and designation.",
    accuracyRules: [
      "Only include real, verifiable parishes / shrines / cathedrals / basilicas from approved directory sources.",
      "Do not invent addresses or dioceses; cite the official directory or diocesan source.",
      "Classify the designation (parish, shrine, cathedral, major basilica, minor basilica) only when the source states it.",
    ],
    requiredFields: ["slug", "title", "address", "city", "citations"],
    optionalFields: ["designation", "diocese", "background", "summary"],
    preferredSourceHosts: ["usccb.org", "vatican.va", "gcatholic.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
