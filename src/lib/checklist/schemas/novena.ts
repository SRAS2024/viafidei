import { z } from "zod";
import type { ContentSchema } from "./index";

const novenaDaySchema = z.object({
  day: z.number().int().min(1).max(9),
  title: z.string().min(1),
  meditation: z.string().min(20),
  prayerText: z.string().min(20),
  intentionPrompt: z.string().optional(),
});

export const novenaSchema: ContentSchema = {
  contentType: "NOVENA",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(20),
    background: z.string().optional(),
    intentionTheme: z.string().min(1),
    days: z.array(novenaDaySchema).length(9),
    associatedSaintSlug: z.string().optional(),
    associatedDevotionSlug: z.string().optional(),
    typicalStartDate: z.string().optional(),
    relatedFeastSlug: z.string().optional(),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A 9-day novena with one structured entry per day. Each day must contain the full official prayer text and a meditation. Never invent novena content — novenas have established texts.",
    accuracyRules: [
      "A novena MUST have exactly 9 days. Reject anything with fewer or more.",
      "Reproduce official novena prayer text verbatim. Do not paraphrase.",
      "Many novenas are associated with a feast — verify the feast day from an approved liturgical source.",
      "Distinguish public from private novenas in the summary.",
      "Cross-check two approved sources for day-by-day prayer text.",
    ],
    requiredFields: ["slug", "title", "summary", "intentionTheme", "days", "citations"],
    optionalFields: [
      "background",
      "associatedSaintSlug",
      "associatedDevotionSlug",
      "typicalStartDate",
      "relatedFeastSlug",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
