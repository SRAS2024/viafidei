import { z } from "zod";
import type { ContentSchema } from "./index";

export const doctorSchema: ContentSchema = {
  contentType: "DOCTOR",
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    // The honorific epithet, e.g. "Doctor of Grace", "Angelic Doctor".
    doctorTitle: z.string().optional(),
    feastDay: z.string().optional(),
    feastMonth: z.number().int().min(1).max(12).optional(),
    feastDayOfMonth: z.number().int().min(1).max(31).optional(),
    ecclesialRole: z.enum(["pope", "bishop", "priest", "deacon", "religious", "lay"]).optional(),
    saintSlug: z.string().optional(),
    declaredDoctorYear: z.number().int().optional(),
    background: z.string().optional(),
    summary: z.string().optional(),
    citations: z.array(z.string().url()).min(1),
  }),
  instruction: {
    description:
      "A Doctor of the Church — a saint recognized for an eminent contribution to theology or doctrine — with their honorific title and a short biography.",
    accuracyRules: [
      "Only include saints who have been formally declared Doctors of the Church.",
      "Use the saint's name and doctoral epithet exactly as recorded; never invent titles.",
      "Cite the official source declaring the doctorate.",
    ],
    requiredFields: ["slug", "title", "citations"],
    optionalFields: ["doctorTitle", "feastDay", "background", "summary"],
    preferredSourceHosts: ["vatican.va", "newadvent.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
