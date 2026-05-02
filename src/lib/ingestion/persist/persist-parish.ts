import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedParish } from "../types";
import type { PersistOutcome } from "./persist-prayer";

async function findExistingParish(item: IngestedParish) {
  const bySlug = await prisma.parish.findUnique({ where: { slug: item.slug } });
  if (bySlug) return bySlug;
  if (item.name && item.city && item.country) {
    return prisma.parish.findUnique({
      where: {
        name_city_country: {
          name: item.name,
          city: item.city,
          country: item.country,
        },
      },
    });
  }
  return null;
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
        contentChecksum: incomingChecksum,
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
      sourceHost: null,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return "created";
}
