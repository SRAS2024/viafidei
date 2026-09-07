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
  schema: z
    .object({
      slug: z.string().min(1),
      title: z.string().min(1),
      // A parish is locatable EITHER by a postal address + city OR by exact
      // coordinates (see the refine below). OpenStreetMap carries a street
      // address on only ~a quarter of Catholic churches but coordinates on all
      // of them; requiring both would cap the directory at a fraction of the
      // real supply. Nothing is ever invented: an absent address stays absent
      // and the page renders a coordinate-based directions link instead.
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      /** ISO-3166 alpha-2 (the source tag), kept apart from the display name. */
      countryCode: z.string().length(2).optional(),
      website: z.string().url().optional(),
      designation: z.enum(PARISH_DESIGNATIONS).default("parish"),
      diocese: z.string().optional(),
      background: z.string().optional(),
      summary: z.string().optional(),
      // Best-effort contact + schedule details. Optional by design: a parish is
      // publishable on just its name + location, so a missing phone / Mass time /
      // confession time never blocks it. Filled when found on the parish website
      // (or an OSM tag) and re-checked by the monthly refresh sweep.
      phone: z.string().optional(),
      massTimes: z.string().optional(),
      confessionTimes: z.string().optional(),
      // Normalized address fingerprint for duplicate detection: two parishes with
      // the same addressKey are the same place and must not both be published.
      addressKey: z.string().optional(),
      // Stable source identity (`osm:node/123`, a Google place id, …) so a
      // re-swept source updates its own row instead of creating a duplicate.
      sourceRef: z.string().optional(),
      // Geocoordinates (when the directory source supplies them) power the
      // "use my location → nearest parish" feature.
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      citations: z.array(z.string().url()).min(1),
    })
    .refine(
      (p) =>
        (Boolean(p.address?.trim()) && Boolean(p.city?.trim())) ||
        (typeof p.latitude === "number" && typeof p.longitude === "number"),
      {
        message: "a parish needs either address + city or latitude + longitude",
        path: ["address"],
      },
    ),
  instruction: {
    description:
      "A real Catholic parish, shrine, cathedral, or basilica directory record with its location and designation.",
    accuracyRules: [
      "Only include real, verifiable parishes / shrines / cathedrals / basilicas from approved directory sources.",
      "Do not invent addresses or dioceses; cite the official directory or diocesan source.",
      "Classify the designation (parish, shrine, cathedral, major basilica, minor basilica) only when the source states it.",
      "Locate every record by its address and city, or by exact coordinates when the source has no postal address.",
    ],
    requiredFields: ["slug", "title", "citations"],
    optionalFields: [
      "address",
      "city",
      "designation",
      "diocese",
      "background",
      "summary",
      "state",
      "country",
      "countryCode",
      "website",
      "phone",
      "massTimes",
      "confessionTimes",
      "addressKey",
      "sourceRef",
      "latitude",
      "longitude",
    ],
    preferredSourceHosts: ["usccb.org", "vatican.va", "gcatholic.org"],
    minCitations: 1,
    requiresHumanReview: false,
  },
};
