import { z } from "zod";
import type { ContentSchema } from "./index";

export const liturgicalSchema: ContentSchema = {
  contentType: "LITURGICAL",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum([
      "feast",
      "solemnity",
      "memorial",
      "optional_memorial",
      "liturgical_season",
      "liturgical_year",
      "mass_structure",
      "marriage_rite",
      "funeral_rite",
      "ordination_rite",
      "council_event",
      "symbolism",
      "glossary_term",
    ]),
    rank: z
      .enum(["solemnity", "feast", "memorial", "optional_memorial", "weekday", "n/a"])
      .optional(),
    season: z
      .enum(["advent", "christmas", "ordinary_time", "lent", "triduum", "easter", "n/a"])
      .optional(),
    summary: z.string().min(50),
    body: z.string().min(50),
    feastDate: z
      .string()
      .regex(/^\d{2}-\d{2}$/)
      .optional(),
    movableFeast: z.boolean().default(false),
    associatedSaintSlugs: z.array(z.string()).default([]),
    associatedReadings: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A liturgical entry — feast, solemnity, season, rite, council event, or glossary term. Must align with the General Roman Calendar or approved liturgical books.",
    accuracyRules: [
      "Feast date MUST match the General Roman Calendar. Note movable feasts explicitly.",
      "Rank (solemnity / feast / memorial / optional memorial) MUST be sourced from approved liturgical books.",
      "Do not invent feast days, ranks, or readings.",
      "Distinguish particular calendars (US, country, religious order) from the General Roman Calendar in the body.",
      "Cross-reference with the Roman Missal or USCCB liturgical calendar.",
    ],
    requiredFields: ["slug", "title", "kind", "summary", "body", "citations"],
    optionalFields: [
      "rank",
      "season",
      "feastDate",
      "movableFeast",
      "associatedSaintSlugs",
      "associatedReadings",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
