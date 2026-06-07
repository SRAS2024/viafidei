import { z } from "zod";
import type { ContentSchema } from "./index";

export const apparitionSchema: ContentSchema = {
  contentType: "APPARITION",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    location: z.string().min(1),
    country: z.string().min(2),
    approvedStatus: z.enum([
      "approved",
      "constat_de_supernaturalitate",
      "non_constat",
      "not_supernatural",
      "under_investigation",
      "not_yet_judged",
      "private_revelation",
    ]),
    yearOfApparition: z.number().int().optional(),
    feastDay: z
      .string()
      .regex(/^\d{2}-\d{2}$/)
      .optional(), // MM-DD liturgical feast, when one is celebrated
    summary: z.string().min(50),
    background: z.string().optional(),
    visionaries: z.array(z.string()).default([]),
    messageHighlights: z.array(z.string()).default([]),
    associatedMarianTitleSlug: z.string().optional(),
    officialDocumentUrl: z.string().url().optional(),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A Marian or other private revelation apparition with verified Church approval status, location, date, and message highlights.",
    accuracyRules: [
      "approvedStatus MUST be sourced from a Vatican, dioscesan, or USCCB document. Do not infer approval from popularity.",
      "Private revelations bind no one to belief, even when approved — note this in summary when appropriate.",
      "Do not paraphrase or invent message text. Reproduce verbatim from approved source or summarize neutrally.",
      "Distinguish apparitions from interior locutions, visions, or other phenomena.",
      "Mark needs_human_review for any apparition with status non_constat, not_supernatural, or under_investigation.",
    ],
    requiredFields: [
      "slug",
      "title",
      "location",
      "country",
      "approvedStatus",
      "summary",
      "citations",
    ],
    optionalFields: [
      "yearOfApparition",
      "feastDay",
      "background",
      "visionaries",
      "messageHighlights",
      "associatedMarianTitleSlug",
      "officialDocumentUrl",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com"],
    minCitations: 2,
    requiresHumanReview: true,
  },
};
