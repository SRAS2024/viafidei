/**
 * After a strict-pipeline `publish` or `update` decision, write the
 * package-validation columns onto the persisted row so:
 *
 *   - public pages can gate on publicRenderReady = true
 *   - threshold counters can gate on isThresholdEligible = true
 *   - admin dashboards can show packageValidationStatus +
 *     packageValidationErrors + contractPackageVersion +
 *     lastPackageValidatedAt
 *
 * Also writes the row's strict subtype / sacrament key / history type
 * onto the parent table when the bridge classified the candidate into
 * a sub-content-type (Novena → Devotion.subtype, Sacrament →
 * SpiritualLifeGuide.sacramentKey, History → LiturgyEntry.historyType,
 * etc.).
 */

import type { Prisma } from "@prisma/client";
import type { ContractValidationResult, ContentTypeKey } from "../content-qa/types";
import { SACRAMENT_GROUP_BY_KEY, isCanonicalSacramentKey } from "../content-qa/sacrament-normalize";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const ENTITY_BY_CONTENT_TYPE: Record<ContentTypeKey, string> = {
  Prayer: "Prayer",
  Saint: "Saint",
  MarianApparition: "MarianApparition",
  Devotion: "Devotion",
  Novena: "Devotion",
  Rosary: "SpiritualLifeGuide",
  Sacrament: "SpiritualLifeGuide",
  Consecration: "SpiritualLifeGuide",
  SpiritualGuidance: "SpiritualLifeGuide",
  Liturgy: "LiturgyEntry",
  History: "LiturgyEntry",
  Parish: "Parish",
};

export async function applyStrictPackageFlags(args: {
  contentType: ContentTypeKey;
  slug: string;
  result: ContractValidationResult;
  /** Optional payload values the persister did not already write. */
  payload?: {
    prayerType?: string | null;
    saintType?: string | null;
    subtype?: string | null;
    devotionType?: string | null;
    sacramentKey?: string | null;
    sacramentGroup?: string | null;
    historyType?: string | null;
    dateOrEra?: string | null;
    packageMetadata?: Record<string, unknown> | null;
    background?: string | null;
    practiceInstructions?: string | null;
    sourceUrl?: string | null;
  };
}): Promise<void> {
  const { contentType, slug, result, payload } = args;
  const entity = ENTITY_BY_CONTENT_TYPE[contentType];
  if (!entity) return;
  const isPublish = result.decision === "publish" || result.decision === "update";

  const baseData: Record<string, unknown> = {
    publicRenderReady: result.publicRenderReady && isPublish,
    isThresholdEligible: result.isThresholdEligible && isPublish,
    packageValidationStatus: isPublish ? "valid" : "invalid",
    packageValidationErrors: result.failedFields,
    contentPackageVersion: result.contractVersion,
    lastPackageValidatedAt: new Date(),
  };
  if (payload?.sourceUrl !== undefined) baseData.sourceUrl = payload.sourceUrl ?? null;

  try {
    switch (entity) {
      case "Prayer":
        await prisma.prayer.update({
          where: { slug },
          data: {
            ...baseData,
            ...(payload?.prayerType !== undefined ? { prayerType: payload.prayerType } : {}),
          },
        });
        return;
      case "Saint":
        await prisma.saint.update({
          where: { slug },
          data: {
            ...baseData,
            ...(payload?.saintType !== undefined ? { saintType: payload.saintType } : {}),
          },
        });
        return;
      case "MarianApparition":
        await prisma.marianApparition.update({
          where: { slug },
          data: baseData,
        });
        return;
      case "Devotion": {
        // Novena / Rosary route to Devotion table via subtype.
        const subtype = payload?.subtype ?? (contentType === "Novena" ? "Novena" : null);
        await prisma.devotion.update({
          where: { slug },
          data: {
            ...baseData,
            ...(subtype ? { subtype } : {}),
            ...(payload?.devotionType !== undefined ? { devotionType: payload.devotionType } : {}),
            ...(payload?.background !== undefined ? { background: payload.background } : {}),
            ...(payload?.practiceInstructions !== undefined
              ? { practiceInstructions: payload.practiceInstructions }
              : {}),
            ...(payload?.packageMetadata !== undefined
              ? {
                  packageMetadata: (payload.packageMetadata ?? undefined) as
                    | Prisma.InputJsonValue
                    | undefined,
                }
              : {}),
          },
        });
        return;
      }
      case "SpiritualLifeGuide": {
        const subtype =
          payload?.subtype ??
          (contentType === "Rosary"
            ? "Rosary"
            : contentType === "Consecration"
              ? "Consecration"
              : null);
        const sacramentKey =
          payload?.sacramentKey ??
          (contentType === "Sacrament" && isCanonicalSacramentKey(payload?.sacramentKey ?? null)
            ? (payload?.sacramentKey ?? null)
            : null);
        const sacramentGroup =
          payload?.sacramentGroup ??
          (sacramentKey && isCanonicalSacramentKey(sacramentKey)
            ? SACRAMENT_GROUP_BY_KEY[sacramentKey]
            : null);
        await prisma.spiritualLifeGuide.update({
          where: { slug },
          data: {
            ...baseData,
            ...(subtype ? { subtype } : {}),
            ...(sacramentKey ? { sacramentKey } : {}),
            ...(sacramentGroup ? { sacramentGroup } : {}),
            ...(payload?.background !== undefined ? { background: payload.background } : {}),
            ...(payload?.packageMetadata !== undefined
              ? {
                  packageMetadata: (payload.packageMetadata ?? undefined) as
                    | Prisma.InputJsonValue
                    | undefined,
                }
              : {}),
          },
        });
        return;
      }
      case "LiturgyEntry": {
        const historyType = payload?.historyType ?? null;
        await prisma.liturgyEntry.update({
          where: { slug },
          data: {
            ...baseData,
            ...(historyType ? { historyType } : {}),
            ...(payload?.dateOrEra !== undefined ? { dateOrEra: payload.dateOrEra } : {}),
            ...(payload?.packageMetadata !== undefined
              ? {
                  packageMetadata: (payload.packageMetadata ?? undefined) as
                    | Prisma.InputJsonValue
                    | undefined,
                }
              : {}),
          },
        });
        return;
      }
      case "Parish":
        await prisma.parish.update({
          where: { slug },
          data: baseData,
        });
        return;
    }
  } catch (e) {
    logger.warn("ingestion.strict_package_flags.failed", {
      contentType,
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
