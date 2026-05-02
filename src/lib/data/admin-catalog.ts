import { prisma } from "../db/client";
import { Prisma, type LiturgyKind, type SpiritualLifeKind } from "@prisma/client";

function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

export type AdminMutationResult<T> =
  | { ok: true; entity: T; created: boolean }
  | { ok: false; reason: "duplicate" | "not_found" | "invalid" };

export type PrayerInput = {
  slug?: string | null;
  defaultTitle: string;
  body: string;
  category: string;
  categoryId?: string | null;
};

export async function createPrayer(input: PrayerInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.defaultTitle);
  const exists = await prisma.prayer.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.prayer.create({
    data: {
      slug,
      defaultTitle: input.defaultTitle,
      body: input.body,
      category: input.category,
      categoryId: input.categoryId ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updatePrayer(id: string, patch: Partial<PrayerInput>) {
  const existing = await prisma.prayer.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.PrayerUpdateInput = {};
  if (patch.defaultTitle !== undefined) data.defaultTitle = patch.defaultTitle;
  if (patch.body !== undefined) data.body = patch.body;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.prayer.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  if (patch.categoryId !== undefined) {
    data.categoryRel = patch.categoryId
      ? { connect: { id: patch.categoryId } }
      : { disconnect: true };
  }
  const entity = await prisma.prayer.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deletePrayer(id: string) {
  const existing = await prisma.prayer.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.prayer.delete({ where: { id } });
  return { ok: true as const };
}

export type SaintInput = {
  slug?: string | null;
  canonicalName: string;
  feastDay?: string | null;
  patronages?: string[];
  biography: string;
  officialPrayer?: string | null;
};

export async function createSaint(input: SaintInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.canonicalName);
  const exists = await prisma.saint.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.saint.create({
    data: {
      slug,
      canonicalName: input.canonicalName,
      feastDay: input.feastDay ?? null,
      patronages: input.patronages ?? [],
      biography: input.biography,
      officialPrayer: input.officialPrayer ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateSaint(id: string, patch: Partial<SaintInput>) {
  const existing = await prisma.saint.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.SaintUpdateInput = {};
  if (patch.canonicalName !== undefined) data.canonicalName = patch.canonicalName;
  if (patch.biography !== undefined) data.biography = patch.biography;
  if (patch.feastDay !== undefined) data.feastDay = patch.feastDay ?? null;
  if (patch.officialPrayer !== undefined) data.officialPrayer = patch.officialPrayer ?? null;
  if (patch.patronages !== undefined) data.patronages = patch.patronages;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.saint.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.saint.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteSaint(id: string) {
  const existing = await prisma.saint.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.saint.delete({ where: { id } });
  return { ok: true as const };
}

export type ApparitionInput = {
  slug?: string | null;
  title: string;
  location?: string | null;
  country?: string | null;
  approvedStatus?: string | null;
  summary: string;
  officialPrayer?: string | null;
};

export async function createApparition(input: ApparitionInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.title);
  const exists = await prisma.marianApparition.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.marianApparition.create({
    data: {
      slug,
      title: input.title,
      location: input.location ?? null,
      country: input.country ?? null,
      approvedStatus: input.approvedStatus ?? null,
      summary: input.summary,
      officialPrayer: input.officialPrayer ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateApparition(id: string, patch: Partial<ApparitionInput>) {
  const existing = await prisma.marianApparition.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.MarianApparitionUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.summary !== undefined) data.summary = patch.summary;
  if (patch.location !== undefined) data.location = patch.location ?? null;
  if (patch.country !== undefined) data.country = patch.country ?? null;
  if (patch.approvedStatus !== undefined) data.approvedStatus = patch.approvedStatus ?? null;
  if (patch.officialPrayer !== undefined) data.officialPrayer = patch.officialPrayer ?? null;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.marianApparition.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.marianApparition.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteApparition(id: string) {
  const existing = await prisma.marianApparition.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.marianApparition.delete({ where: { id } });
  return { ok: true as const };
}

export type DevotionInput = {
  slug?: string | null;
  title: string;
  summary: string;
  practiceText?: string | null;
  durationMinutes?: number | null;
};

export async function createDevotion(input: DevotionInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.title);
  const exists = await prisma.devotion.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.devotion.create({
    data: {
      slug,
      title: input.title,
      summary: input.summary,
      practiceText: input.practiceText ?? null,
      durationMinutes: input.durationMinutes ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateDevotion(id: string, patch: Partial<DevotionInput>) {
  const existing = await prisma.devotion.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.DevotionUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.summary !== undefined) data.summary = patch.summary;
  if (patch.practiceText !== undefined) data.practiceText = patch.practiceText ?? null;
  if (patch.durationMinutes !== undefined) data.durationMinutes = patch.durationMinutes ?? null;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.devotion.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.devotion.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteDevotion(id: string) {
  const existing = await prisma.devotion.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.devotion.delete({ where: { id } });
  return { ok: true as const };
}

export type ParishInput = {
  slug?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  diocese?: string | null;
  ociaUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function createParish(input: ParishInput) {
  const baseSlug = input.slug
    ? slugify(input.slug)
    : slugify(`${input.name}-${input.city ?? ""}-${input.country ?? ""}`);
  const exists = await prisma.parish.findUnique({ where: { slug: baseSlug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.parish.create({
    data: {
      slug: baseSlug,
      name: input.name,
      address: input.address ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      country: input.country ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      websiteUrl: input.websiteUrl ?? null,
      diocese: input.diocese ?? null,
      ociaUrl: input.ociaUrl ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateParish(id: string, patch: Partial<ParishInput>) {
  const existing = await prisma.parish.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.ParishUpdateInput = {};
  for (const key of [
    "name",
    "address",
    "city",
    "region",
    "country",
    "phone",
    "email",
    "websiteUrl",
    "diocese",
    "ociaUrl",
  ] as const) {
    if (patch[key] !== undefined) {
      (data as Record<string, unknown>)[key] = patch[key] ?? null;
    }
  }
  if (patch.latitude !== undefined) data.latitude = patch.latitude ?? null;
  if (patch.longitude !== undefined) data.longitude = patch.longitude ?? null;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.parish.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.parish.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteParish(id: string) {
  const existing = await prisma.parish.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.parish.delete({ where: { id } });
  return { ok: true as const };
}

export type LiturgyInput = {
  slug?: string | null;
  kind?: LiturgyKind;
  title: string;
  summary?: string | null;
  body: string;
};

export async function createLiturgy(input: LiturgyInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.title);
  const exists = await prisma.liturgyEntry.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.liturgyEntry.create({
    data: {
      slug,
      kind: input.kind ?? "GENERAL",
      title: input.title,
      summary: input.summary ?? null,
      body: input.body,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateLiturgy(id: string, patch: Partial<LiturgyInput>) {
  const existing = await prisma.liturgyEntry.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.LiturgyEntryUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.body !== undefined) data.body = patch.body;
  if (patch.summary !== undefined) data.summary = patch.summary ?? null;
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.liturgyEntry.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.liturgyEntry.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteLiturgy(id: string) {
  const existing = await prisma.liturgyEntry.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.liturgyEntry.delete({ where: { id } });
  return { ok: true as const };
}

export type SpiritualLifeInput = {
  slug?: string | null;
  kind?: SpiritualLifeKind;
  title: string;
  summary: string;
  bodyText?: string | null;
  steps?: unknown;
  durationDays?: number | null;
  goalTemplateSlug?: string | null;
};

export async function createSpiritualLifeGuide(input: SpiritualLifeInput) {
  const slug = (input.slug && slugify(input.slug)) || slugify(input.title);
  const exists = await prisma.spiritualLifeGuide.findUnique({ where: { slug } });
  if (exists) return { ok: false as const, reason: "duplicate" as const };
  const entity = await prisma.spiritualLifeGuide.create({
    data: {
      slug,
      kind: input.kind ?? "GENERAL",
      title: input.title,
      summary: input.summary,
      bodyText: input.bodyText ?? null,
      steps: (input.steps as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      durationDays: input.durationDays ?? null,
      goalTemplateSlug: input.goalTemplateSlug ?? null,
    },
  });
  return { ok: true as const, entity, created: true };
}

export async function updateSpiritualLifeGuide(id: string, patch: Partial<SpiritualLifeInput>) {
  const existing = await prisma.spiritualLifeGuide.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const data: Prisma.SpiritualLifeGuideUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.summary !== undefined) data.summary = patch.summary;
  if (patch.bodyText !== undefined) data.bodyText = patch.bodyText ?? null;
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.durationDays !== undefined) data.durationDays = patch.durationDays ?? null;
  if (patch.goalTemplateSlug !== undefined) data.goalTemplateSlug = patch.goalTemplateSlug ?? null;
  if (patch.steps !== undefined) {
    data.steps = (patch.steps as Prisma.InputJsonValue) ?? Prisma.JsonNull;
  }
  if (patch.slug !== undefined) {
    const next = slugify(patch.slug);
    if (next && next !== existing.slug) {
      const collision = await prisma.spiritualLifeGuide.findUnique({ where: { slug: next } });
      if (collision && collision.id !== id) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      data.slug = next;
    }
  }
  const entity = await prisma.spiritualLifeGuide.update({ where: { id }, data });
  return { ok: true as const, entity, created: false };
}

export async function deleteSpiritualLifeGuide(id: string) {
  const existing = await prisma.spiritualLifeGuide.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.spiritualLifeGuide.delete({ where: { id } });
  return { ok: true as const };
}
