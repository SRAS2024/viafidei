import { z } from "zod";

export const prayerCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  defaultTitle: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  category: z.string().min(1).max(80),
  categoryId: z.string().max(64).nullish(),
});
export const prayerUpdateSchema = z.object({
  slug: z.string().max(200).nullish(),
  defaultTitle: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20_000).optional(),
  category: z.string().min(1).max(80).optional(),
  categoryId: z.string().max(64).nullish(),
});

export const saintCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  canonicalName: z.string().min(1).max(200),
  feastDay: z.string().max(40).nullish(),
  patronages: z.array(z.string().max(120)).max(40).optional(),
  biography: z.string().min(1).max(40_000),
  officialPrayer: z.string().max(20_000).nullish(),
});
export const saintUpdateSchema = z.object({
  slug: z.string().max(200).nullish(),
  canonicalName: z.string().min(1).max(200).optional(),
  feastDay: z.string().max(40).nullish(),
  patronages: z.array(z.string().max(120)).max(40).optional(),
  biography: z.string().min(1).max(40_000).optional(),
  officialPrayer: z.string().max(20_000).nullish(),
});

export const apparitionCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  title: z.string().min(1).max(200),
  location: z.string().max(200).nullish(),
  country: z.string().max(80).nullish(),
  approvedStatus: z.string().max(80).nullish(),
  summary: z.string().min(1).max(20_000),
  officialPrayer: z.string().max(20_000).nullish(),
});
export const apparitionUpdateSchema = z.object({
  slug: z.string().max(200).nullish(),
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).nullish(),
  country: z.string().max(80).nullish(),
  approvedStatus: z.string().max(80).nullish(),
  summary: z.string().min(1).max(20_000).optional(),
  officialPrayer: z.string().max(20_000).nullish(),
});

export const devotionCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(20_000),
  practiceText: z.string().max(40_000).nullish(),
  durationMinutes: z.number().int().positive().max(1440).nullish(),
});
export const devotionUpdateSchema = z.object({
  slug: z.string().max(200).nullish(),
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(20_000).optional(),
  practiceText: z.string().max(40_000).nullish(),
  durationMinutes: z.number().int().positive().max(1440).nullish(),
});

export const parishCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullish(),
  city: z.string().max(120).nullish(),
  region: z.string().max(120).nullish(),
  country: z.string().max(80).nullish(),
  phone: z.string().max(80).nullish(),
  email: z.string().email().max(200).nullish(),
  websiteUrl: z.string().url().max(500).nullish(),
  diocese: z.string().max(200).nullish(),
  ociaUrl: z.string().url().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});
export const parishUpdateSchema = parishCreateSchema.partial();

const LITURGY_KINDS = [
  "MASS_STRUCTURE",
  "LITURGICAL_YEAR",
  "SYMBOLISM",
  "MARRIAGE_RITE",
  "FUNERAL_RITE",
  "ORDINATION_RITE",
  "COUNCIL_TIMELINE",
  "GLOSSARY",
  "GENERAL",
] as const;

export const liturgyCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  kind: z.enum(LITURGY_KINDS).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).nullish(),
  body: z.string().min(1).max(80_000),
});
export const liturgyUpdateSchema = liturgyCreateSchema.partial();

const SPIRITUAL_KINDS = [
  "ROSARY",
  "CONFESSION",
  "ADORATION",
  "DEVOTION",
  "CONSECRATION",
  "VOCATION",
  "GENERAL",
] as const;

export const spiritualLifeCreateSchema = z.object({
  slug: z.string().max(200).nullish(),
  kind: z.enum(SPIRITUAL_KINDS).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  bodyText: z.string().max(80_000).nullish(),
  steps: z.unknown().optional(),
  durationDays: z.number().int().positive().max(365).nullish(),
  goalTemplateSlug: z.string().max(120).nullish(),
});
export const spiritualLifeUpdateSchema = spiritualLifeCreateSchema.partial();
