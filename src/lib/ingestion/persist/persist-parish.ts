import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedParish } from "../types";
import type { PersistOutcome } from "./persist-prayer";

async function findExistingParish(item: IngestedParish) {
  const bySlug = await prisma.parish.findUnique({ where: { slug: item.slug } });
  if (bySlug) return bySlug;
  if (item.name && item.city && item.country) {
    const composite = await prisma.parish.findUnique({
      where: {
        name_city_country: {
          name: item.name,
          city: item.city,
          country: item.country,
        },
      },
    });
    if (composite) return composite;
  }
  if (item.externalSourceKey) {
    const byExternalKey = await prisma.parish.findFirst({
      where: { externalSourceKey: item.externalSourceKey },
    });
    if (byExternalKey) return byExternalKey;
  }
  if (item.websiteUrl) {
    const byWebsite = await prisma.parish.findFirst({
      where: { websiteUrl: item.websiteUrl },
    });
    if (byWebsite) return byWebsite;
  }
  // Final guard: catch the same parish where slug / website / external key all
  // differ but the normalized name + city + country line up. This rolls up
  // listings that come in slightly different formats from different sources.
  const normalizedName = normalizeSlug(item.name);
  if (normalizedName && item.city && item.country) {
    const candidates = await prisma.parish.findMany({
      where: {
        city: item.city,
        country: item.country,
      },
      take: 50,
    });
    const match = candidates.find((c) => normalizeSlug(c.name) === normalizedName);
    if (match) return match;
  }
  return null;
}

function deriveSourceHost(item: IngestedParish): string | null {
  const candidate = item.externalSourceKey ?? item.websiteUrl;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function persistParish(
  item: IngestedParish,
  initialStatus: ContentStatus,
): Promise<PersistOutcome> {
  const existing = await findExistingParish(item);
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.parish.update({
      where: { id: existing.id },
      data: {
        name: item.name,
        address: item.address ?? existing.address ?? null,
        city: item.city ?? existing.city ?? null,
        region: item.region ?? existing.region ?? null,
        country: item.country ?? existing.country ?? null,
        phone: item.phone ?? existing.phone ?? null,
        email: item.email ?? existing.email ?? null,
        websiteUrl: item.websiteUrl ?? existing.websiteUrl ?? null,
        diocese: item.diocese ?? existing.diocese ?? null,
        ociaUrl: item.ociaUrl ?? existing.ociaUrl ?? null,
        latitude: item.latitude ?? existing.latitude ?? null,
        longitude: item.longitude ?? existing.longitude ?? null,
        externalSourceKey: item.externalSourceKey ?? existing.externalSourceKey ?? null,
        sourceHost: existing.sourceHost ?? deriveSourceHost(item),
        contentChecksum: incomingChecksum,
        status: initialStatus,
      },
    });
    return "updated";
  }

  await prisma.parish.create({
    data: {
      slug: item.slug,
      name: item.name,
      address: item.address ?? null,
      city: item.city ?? null,
      region: item.region ?? null,
      country: item.country ?? null,
      phone: item.phone ?? null,
      email: item.email ?? null,
      websiteUrl: item.websiteUrl ?? null,
      diocese: item.diocese ?? null,
      ociaUrl: item.ociaUrl ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      externalSourceKey: item.externalSourceKey ?? null,
      sourceHost: deriveSourceHost(item),
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return "created";
}
