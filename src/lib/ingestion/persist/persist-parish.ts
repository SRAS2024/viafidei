import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedParish } from "../types";
import type { PersistOutcome } from "./persist-prayer";
import { normalizeWebsiteIdentity } from "./dedup";

async function findExistingParish(item: IngestedParish, incomingChecksum: string) {
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
    // Two sources can publish the same parish under slightly different
    // website spellings (with/without www., trailing slash, scheme). Walk
    // a small candidate set and compare normalized website identities.
    const normalizedSite = normalizeWebsiteIdentity(item.websiteUrl);
    if (normalizedSite) {
      const websiteCandidates = await prisma.parish.findMany({
        where: { websiteUrl: { not: null } },
        take: 200,
        orderBy: { updatedAt: "desc" },
      });
      const match = websiteCandidates.find(
        (c) => normalizeWebsiteIdentity(c.websiteUrl) === normalizedSite,
      );
      if (match) return match;
    }
  }
  // Body-level dedup: identical content checksum (same name + address +
  // website + diocese) means the upstream is republishing the same record.
  const byChecksum = await prisma.parish.findFirst({
    where: { contentChecksum: incomingChecksum },
  });
  if (byChecksum) return byChecksum;
  // Final guard: catch the same parish where slug / website / external key all
  // differ but the normalized name + city + region/country line up. This rolls
  // up listings that come in slightly different formats from different sources.
  const normalizedName = normalizeSlug(item.name);
  if (normalizedName && item.city && (item.region || item.country)) {
    const candidates = await prisma.parish.findMany({
      where: {
        city: item.city,
        ...(item.region ? { region: item.region } : {}),
        ...(item.country ? { country: item.country } : {}),
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
  const incomingChecksum = computeChecksum(item);
  const existing = await findExistingParish(item, incomingChecksum);

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
