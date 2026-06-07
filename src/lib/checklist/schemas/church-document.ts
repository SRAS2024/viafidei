import { z } from "zod";
import type { ContentSchema } from "./index";

export const churchDocumentSchema: ContentSchema = {
  contentType: "CHURCH_DOCUMENT",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    documentType: z.enum([
      "encyclical",
      "apostolic_exhortation",
      "apostolic_constitution",
      "motu_proprio",
      "apostolic_letter",
      "decree",
      "declaration",
      "council_document",
      "catechism_section",
      "instruction",
      "vatican_document",
      "uscb_pastoral_letter",
    ]),
    issuingAuthority: z.string().min(1),
    issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    summary: z.string().min(100),
    keyThemes: z.array(z.string()).min(1),
    canonicalUrl: z.string().url(),
    bodyExcerpt: z.string().optional(),
    relatedDocuments: z.array(z.string()).default([]),
    citations: z.array(z.string().url()).min(1),
  }),
  instruction: {
    description:
      "An official Church document (encyclical, apostolic exhortation, decree, council text, USCCB pastoral letter, etc.). Captures issuing authority, date, and the document's themes and canonical URL.",
    accuracyRules: [
      "Document type, title, and issuing authority MUST match the canonical record on vatican.va or usccb.org.",
      "Do not paraphrase quoted passages. Use bodyExcerpt only for verbatim text with provenance.",
      "Mark NEEDS_HUMAN_REVIEW for any document marked 'instruction' or 'declaration' that is not from the Holy See itself.",
      "Document slug must match the canonical Vatican URL fragment when available.",
    ],
    requiredFields: [
      "slug",
      "title",
      "documentType",
      "issuingAuthority",
      "issuedDate",
      "summary",
      "keyThemes",
      "canonicalUrl",
      "citations",
    ],
    optionalFields: ["bodyExcerpt", "relatedDocuments"],
    preferredSourceHosts: ["vatican.va", "usccb.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
