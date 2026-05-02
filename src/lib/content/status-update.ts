import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import type { ReviewableEntityType } from "./types";

export async function setEntityStatus(
  entityType: ReviewableEntityType,
  entityId: string,
  status: ContentStatus,
): Promise<{ status: ContentStatus } | null> {
  switch (entityType) {
    case "Prayer":
      return prisma.prayer.update({
        where: { id: entityId },
        data: { status },
        select: { status: true },
      });
    case "Saint":
      return prisma.saint.update({
        where: { id: entityId },
        data: { status },
        select: { status: true },
      });
    case "MarianApparition":
      return prisma.marianApparition.update({
        where: { id: entityId },
        data: { status },
        select: { status: true },
      });
    case "Parish":
      return prisma.parish.update({
        where: { id: entityId },
        data: { status },
        select: { status: true },
      });
    case "Devotion":
      return prisma.devotion.update({
        where: { id: entityId },
        data: { status },
        select: { status: true },
      });
  }
}

export async function getEntityStatus(
  entityType: ReviewableEntityType,
  entityId: string,
): Promise<ContentStatus | null> {
  switch (entityType) {
    case "Prayer": {
      const e = await prisma.prayer.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return e?.status ?? null;
    }
    case "Saint": {
      const e = await prisma.saint.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return e?.status ?? null;
    }
    case "MarianApparition": {
      const e = await prisma.marianApparition.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return e?.status ?? null;
    }
    case "Parish": {
      const e = await prisma.parish.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return e?.status ?? null;
    }
    case "Devotion": {
      const e = await prisma.devotion.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return e?.status ?? null;
    }
  }
}
