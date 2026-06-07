import { z } from "zod";
import type { ContentSchema } from "./index";

export const sacramentSchema: ContentSchema = {
  contentType: "SACRAMENT",
  schema: z.object({
    slug: z.string().min(1),
    sacramentKey: z.enum([
      "baptism",
      "confirmation",
      "eucharist",
      "reconciliation",
      "anointing_of_the_sick",
      "holy_orders",
      "matrimony",
    ]),
    title: z.string().min(1),
    summary: z.string().min(50),
    theologicalOverview: z.string().min(100),
    institution: z.string().min(20),
    matterAndForm: z.object({
      matter: z.string().min(5),
      form: z.string().min(5),
    }),
    minister: z.string().min(5),
    recipient: z.string().min(5),
    effects: z.array(z.string()).min(1),
    preparation: z.string().optional(),
    relatedRites: z.array(z.string()).default([]),
    catechismReferences: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(2),
  }),
  instruction: {
    description:
      "A Catholic sacrament with its theology, matter and form, ordinary minister, recipient, and proper effects. The seven sacraments are doctrinally fixed and must be reproduced from the Catechism and approved liturgical books.",
    accuracyRules: [
      "Only the seven sacraments are valid: baptism, confirmation, eucharist, reconciliation, anointing_of_the_sick, holy_orders, matrimony.",
      "Matter and form MUST come from the Catechism or approved liturgical books.",
      "Effects MUST be sourced from the Catechism (CCC 1210-1666).",
      "Do not invent doctrine. Theological language must mirror approved teaching.",
      "Cite Catechism paragraphs where available.",
      "Reject any source that conflicts with the Catechism on matter, form, minister, or effects.",
    ],
    requiredFields: [
      "slug",
      "sacramentKey",
      "title",
      "summary",
      "theologicalOverview",
      "institution",
      "matterAndForm",
      "minister",
      "recipient",
      "effects",
      "citations",
    ],
    optionalFields: ["preparation", "relatedRites", "catechismReferences"],
    preferredSourceHosts: ["vatican.va", "usccb.org"],
    minCitations: 2,
    requiresHumanReview: false,
  },
};
