import { z } from "zod";
import type { ContentSchema } from "./index";

export const popeSchema: ContentSchema = {
  contentType: "POPE",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    // Year (or full date) the pontificate began; the chronological sort key.
    papacyStart: z.string().min(1),
    // Year/date the pontificate ended; omitted (or "present") for the reigning pope.
    papacyEnd: z.string().optional(),
    birthName: z.string().optional(),
    background: z.string().optional(),
    summary: z.string().optional(),
    citations: z.array(z.string().url()).min(1),
  }),
  instruction: {
    description:
      "A Roman Pontiff (pope) with his regnal name and the years of his pontificate, for the chronological list of popes.",
    accuracyRules: [
      "Use the regnal name (e.g. 'Pope Francis', 'Pope St. John Paul II') exactly as recorded.",
      "Record the years of the pontificate from approved sources; never invent dates.",
      "Leave papacyEnd empty (or 'present') only for the currently reigning pope.",
    ],
    requiredFields: ["slug", "title", "papacyStart", "citations"],
    optionalFields: ["papacyEnd", "birthName", "background", "summary"],
    preferredSourceHosts: ["vatican.va", "newadvent.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
