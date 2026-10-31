import { z } from "zod";
import type { ContentSchema } from "./index";

/**
 * Stages of a cause that carry NO liturgical feast. Public liturgical cult
 * begins with beatification: a Venerable (heroic virtue declared) or a Servant
 * of God (cause opened) has no feast day, so a record at either stage must not
 * carry one — and one at a later stage must.
 */
export const FEASTLESS_CANONIZATION_STATUSES: ReadonlySet<string> = new Set([
  "venerable",
  "servant_of_god",
]);

const FEAST_FIELDS = ["feastDay", "feastMonth", "feastDayOfMonth"] as const;

export const saintSchema: ContentSchema = {
  contentType: "SAINT",
  schema: z
    .object({
      slug: z.string().min(1),
      canonicalName: z.string().min(1),
      // Required for a canonized or beatified saint, absent for a Venerable or
      // Servant of God (see the refinement below).
      feastDay: z
        .string()
        .regex(/^\d{2}-\d{2}$/)
        .optional(), // MM-DD
      feastMonth: z.number().int().min(1).max(12).optional(),
      feastDayOfMonth: z.number().int().min(1).max(31).optional(),
      patronages: z.array(z.string()).default([]),
      biography: z.string().min(100),
      saintType: z.enum([
        "martyr",
        "doctor_of_the_church",
        "virgin",
        "confessor",
        "religious",
        "lay",
        "bishop",
        "pope",
        "apostle",
        "evangelist",
        "founder",
        "missionary",
        "other",
      ]),
      canonizationStatus: z.enum(["canonized", "beatified", "venerable", "servant_of_god"]),
      canonizationDate: z.string().optional(),
      canonizedBy: z.string().optional(),
      birthDate: z.string().optional(),
      deathDate: z.string().optional(),
      // Exact permitted title shown beneath the name (e.g. "Mother of God").
      titleLabel: z.string().optional(),
      // Explicit sort rank for the foundational figures (lower = earlier).
      orderRank: z.number().int().optional(),
      // Papacy years for saint-popes, to render "Pope from X to Y".
      papacyStart: z.string().optional(),
      papacyEnd: z.string().optional(),
      relatedPrayers: z.array(z.string()).default([]),
      relatedDevotions: z.array(z.string()).default([]),
      citations: z.array(z.string().url()).min(2),
    })
    .superRefine((value, ctx) => {
      const feastless = FEASTLESS_CANONIZATION_STATUSES.has(value.canonizationStatus);
      for (const field of FEAST_FIELDS) {
        const present = value[field] !== undefined;
        if (feastless && present) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `a ${value.canonizationStatus} has no liturgical feast`,
          });
        } else if (!feastless && !present) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "required for a canonized or beatified saint",
          });
        }
      }
    }),
  instruction: {
    description:
      "Catholic saint or blessed with verified canonization status, biographical text, feast day, and patronages.",
    accuracyRules: [
      "Feast day MUST match the General Roman Calendar or the saint's proper calendar. Never invent a feast day.",
      "A Venerable or Servant of God has no liturgical feast: record none (feast fields are required only from beatification on).",
      "Canonization status (canonized / beatified / venerable / servant_of_god) MUST be sourced.",
      "Do not assign patronages without a citation — apocryphal patronages are common online.",
      "Distinguish memorials, optional memorials, feasts, and solemnities when noting feast rank.",
      "Cross-reference two approved sources before claiming canonization details.",
    ],
    requiredFields: [
      "slug",
      "canonicalName",
      "feastDay",
      "feastMonth",
      "feastDayOfMonth",
      "biography",
      "saintType",
      "canonizationStatus",
      "citations",
    ],
    optionalFields: [
      "patronages",
      "canonizationDate",
      "canonizedBy",
      "birthDate",
      "deathDate",
      "titleLabel",
      "orderRank",
      "papacyStart",
      "papacyEnd",
      "relatedPrayers",
      "relatedDevotions",
    ],
    preferredSourceHosts: ["vatican.va", "usccb.org", "ewtn.com", "catholic.org", "newadvent.org"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
