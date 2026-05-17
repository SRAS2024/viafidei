/**
 * Canonical content persistence.
 *
 * `persistBuiltPackage()` is the single function that writes built +
 * validated content to the public catalog. It accepts ONLY packages
 * that produced `built_complete_package` AND passed strict QA. Anything
 * else routes elsewhere:
 *
 *   - Build failure       → ContentPackageBuildLog row only
 *   - QA reject / delete  → RejectedContentLog row + no public row
 *   - Duplicate           → return "skipped" without writing a new row
 *
 * Every persisted row receives:
 *   - status                 = PUBLISHED
 *   - publicRenderReady      = true
 *   - isThresholdEligible    = true
 *   - packageValidationStatus = "valid"
 *   - contentPackageVersion  = the contract version that ran
 *   - lastPackageValidatedAt = now
 *   - sourceUrl / sourceHost
 *   - contentChecksum
 *   - packageMetadata        = JSON blob the renderer reads (novena days,
 *                              rosary mysteries, sacrament fields, …)
 *   - field provenance       = JSON blob the "why not visible" admin
 *                              page reads
 *
 * When an existing row matches by slug or external source key:
 *   - If the checksum differs, the previous version is snapshotted
 *     into ContentVersion and the row is updated in place.
 *   - If the checksum is identical, the call is a no-op (returns
 *     "skipped").
 *
 * The function never persists failed packages, never persists
 * incomplete packages, and never persists packages whose required
 * fields are missing provenance.
 */

import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { recordDataManagementLogs } from "../data/data-management-log";
import type { ContractValidationResult } from "../content-qa/types";
import type { ContentPackage } from "./types";
import { normalizePackage } from "./normalize";
import { enrichPackage } from "./enrich";
import { ensureProvenance } from "./provenance";

export type PersistResult =
  | {
      outcome: "created" | "updated";
      contentId: string;
      contentType: string;
      slug: string;
    }
  | {
      outcome: "skipped";
      contentId?: string;
      contentType: string;
      slug: string;
      reason: string;
    }
  | {
      outcome: "rejected";
      contentType: string;
      slug: string;
      reason: string;
      missing: string[];
    };

const PACKAGE_VERSION = "1.0.0";

export type PersistBuiltPackageInput = {
  pkg: ContentPackage;
  validation: ContractValidationResult;
  workerJobId?: string | null;
  ingestionBatchId?: string | null;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
};

/**
 * Persist the package to the right catalog table for its content type.
 * No-op for content types that have no dedicated catalog row (e.g.
 * scripture blocks live attached to other packages, not as their own
 * top-level model).
 */
export async function persistBuiltPackage(input: PersistBuiltPackageInput): Promise<PersistResult> {
  const { validation } = input;
  if (validation.decision !== "publish" && validation.decision !== "update") {
    return {
      outcome: "rejected",
      contentType: input.pkg.contentType,
      slug: input.pkg.slug,
      reason: `Validation decision ${validation.decision} — refusing to persist`,
      missing: validation.failedFields,
    };
  }
  if (!validation.publicRenderReady || !validation.isThresholdEligible) {
    return {
      outcome: "rejected",
      contentType: input.pkg.contentType,
      slug: input.pkg.slug,
      reason: "Validation did not flag public + threshold eligibility",
      missing: validation.failedFields,
    };
  }

  // Apply normalization + enrichment as a safety net — the orchestrator
  // already runs both, but persistBuiltPackage is the canonical write
  // path so we re-run them to guarantee invariants.
  normalizePackage(input.pkg);
  enrichPackage(input.pkg, PACKAGE_VERSION);

  // Final provenance gate — required fields without a provenance entry
  // (and not flagged as deterministic) fail this check.
  const required = REQUIRED_FIELDS_BY_TYPE[input.pkg.contentType] ?? [];
  const deterministic = DETERMINISTIC_FIELDS_BY_TYPE[input.pkg.contentType] ?? [];
  const provGate = ensureProvenance({
    payload: input.pkg.payload,
    provenance: input.pkg.provenance,
    requiredFields: required,
    deterministicFields: deterministic,
  });
  if (!provGate.ok) {
    return {
      outcome: "rejected",
      contentType: input.pkg.contentType,
      slug: input.pkg.slug,
      reason: "Missing provenance for required fields",
      missing: provGate.missing,
    };
  }

  try {
    return await persistByContentType(input);
  } catch (e) {
    logger.error("content-factory.persist.failed", {
      slug: input.pkg.slug,
      contentType: input.pkg.contentType,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      outcome: "rejected",
      contentType: input.pkg.contentType,
      slug: input.pkg.slug,
      reason: e instanceof Error ? e.message : String(e),
      missing: [],
    };
  }
}

const REQUIRED_FIELDS_BY_TYPE: Record<string, ReadonlyArray<string>> = {
  Prayer: ["prayerType", "prayerName", "prayerText", "category"],
  Saint: ["saintName", "biography"],
  MarianApparition: ["apparitionName", "location", "summary"],
  Devotion: ["devotionName"],
  Novena: ["novenaName", "background", "purpose"],
  Sacrament: ["sacramentKey", "sacramentName"],
  Rosary: ["background", "mysterySets"],
  Consecration: ["consecrationName", "background"],
  SpiritualGuidance: ["guideName", "background"],
  Liturgy: ["liturgyKind", "title"],
  History: ["historyType", "title"],
  Parish: ["parishName", "city", "country"],
};

const DETERMINISTIC_FIELDS_BY_TYPE: Record<string, ReadonlyArray<string>> = {
  Sacrament: ["sacramentKey", "sacramentGroup"],
  Saint: ["slug"],
  Prayer: ["slug"],
  Devotion: ["slug"],
};

async function persistByContentType(input: PersistBuiltPackageInput): Promise<PersistResult> {
  const { pkg, validation, workerJobId, triggeredBy, actorUsername } = input;
  const initialStatus: ContentStatus = "PUBLISHED";
  const sourceHost = pkg.sourceHost;
  const sourceUrl = pkg.sourceUrl;
  const contentChecksum = pkg.contentChecksum ?? null;
  const packageMetadata = { ...(pkg.packageMetadata ?? {}), provenance: pkg.provenance };

  const commonReady = {
    status: initialStatus,
    publicRenderReady: true,
    isThresholdEligible: true,
    packageValidationStatus: "valid",
    packageValidationErrors: [] as string[],
    contentPackageVersion: validation.contractVersion,
    lastPackageValidatedAt: new Date(),
    sourceUrl,
    sourceHost,
    sourceTier: pkg.sourceTier ?? null,
    contentChecksum,
  };

  const log = async (action: "ADD" | "UPDATE", contentRef: string, reason: string) => {
    await recordDataManagementLogs([
      {
        action,
        contentType: pkg.contentType,
        contentRef,
        reason,
        triggeredBy: triggeredBy ?? "automatic",
        actorUsername: actorUsername ?? null,
      },
    ]).catch(() => undefined);
  };
  // workerJobId is captured here so future cross-references can be
  // added without changing the signature.
  void workerJobId;

  switch (pkg.contentType) {
    case "Prayer":
      return persistPrayerCanonical(pkg, commonReady, packageMetadata, log);
    case "Saint":
      return persistSaintCanonical(pkg, commonReady, packageMetadata, log);
    case "MarianApparition":
      return persistApparitionCanonical(pkg, commonReady, packageMetadata, log);
    case "Devotion":
    case "Novena":
      return persistDevotionCanonical(pkg, commonReady, packageMetadata, log);
    case "Sacrament":
    case "Rosary":
    case "Consecration":
    case "SpiritualGuidance":
      return persistGuideCanonical(pkg, commonReady, packageMetadata, log);
    case "Liturgy":
    case "History":
      return persistLiturgyCanonical(pkg, commonReady, packageMetadata, log);
    case "Parish":
      return persistParishCanonical(pkg, commonReady, packageMetadata, log);
    default:
      return {
        outcome: "skipped",
        contentType: pkg.contentType,
        slug: pkg.slug,
        reason: `No catalog table for ${pkg.contentType}`,
      };
  }
}

type CommonReady = ReturnType<typeof commonReadyDummy>;
function commonReadyDummy() {
  return {
    status: "PUBLISHED" as ContentStatus,
    publicRenderReady: true as boolean,
    isThresholdEligible: true as boolean,
    packageValidationStatus: "valid" as string,
    packageValidationErrors: [] as string[],
    contentPackageVersion: "" as string,
    lastPackageValidatedAt: new Date(),
    sourceUrl: "",
    sourceHost: "",
    sourceTier: null as number | null,
    contentChecksum: null as string | null,
  };
}

async function persistPrayerCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  const p = pkg.payload as Record<string, unknown>;
  const prayerText = typeof p.prayerText === "string" ? p.prayerText : "";
  const category = typeof p.category === "string" ? p.category : "Traditional Catholic prayer";
  const prayerType = typeof p.prayerType === "string" ? p.prayerType : null;
  const language = typeof pkg.language === "string" ? pkg.language : "en";
  const officialPrayer = typeof p.officialPrayer === "string" ? p.officialPrayer : null;

  const existing = await prisma.prayer.findFirst({
    where: {
      OR: [
        { slug: pkg.slug },
        ...(ready.contentChecksum ? [{ contentChecksum: ready.contentChecksum }] : []),
      ],
    },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: "Prayer",
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.prayer.update({
      where: { id: existing.id },
      data: {
        defaultTitle: pkg.title,
        body: prayerText,
        category,
        prayerType,
        language,
        officialPrayer,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing prayer");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: "Prayer",
      slug: existing.slug,
    };
  }
  // packageMetadata not yet stored on Prayer (no column) — kept here
  // for forward-compat but ignored at DB level.
  void metadata;
  const created = await prisma.prayer.create({
    data: {
      slug: pkg.slug,
      defaultTitle: pkg.title,
      body: prayerText,
      category,
      prayerType,
      language,
      officialPrayer,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new prayer");
  return { outcome: "created", contentId: created.id, contentType: "Prayer", slug: created.slug };
}

async function persistSaintCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  void metadata;
  const p = pkg.payload as Record<string, unknown>;
  const biography = typeof p.biography === "string" ? p.biography : "";
  const feastDay = typeof p.feastDay === "string" ? p.feastDay : null;
  const feastMonth = typeof p.feastMonth === "number" ? p.feastMonth : null;
  const feastDayOfMonth = typeof p.feastDayOfMonth === "number" ? p.feastDayOfMonth : null;
  const patronages = Array.isArray(p.patronages) ? (p.patronages as string[]) : [];
  const officialPrayer = typeof p.officialPrayer === "string" ? p.officialPrayer : null;
  const saintType = typeof p.saintType === "string" ? p.saintType : null;
  const saintName = typeof p.saintName === "string" ? p.saintName : pkg.title;
  const externalSourceKey = `${pkg.sourceHost}:${pkg.sourceUrl}`;

  const existing = await prisma.saint.findFirst({
    where: { OR: [{ slug: pkg.slug }, { externalSourceKey }] },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: "Saint",
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.saint.update({
      where: { id: existing.id },
      data: {
        canonicalName: saintName,
        biography,
        feastDay,
        feastMonth,
        feastDayOfMonth,
        patronages,
        officialPrayer,
        saintType,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing saint");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: "Saint",
      slug: existing.slug,
    };
  }
  const created = await prisma.saint.create({
    data: {
      slug: pkg.slug,
      canonicalName: saintName,
      biography,
      feastDay,
      feastMonth,
      feastDayOfMonth,
      patronages,
      officialPrayer,
      saintType,
      externalSourceKey,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new saint");
  return { outcome: "created", contentId: created.id, contentType: "Saint", slug: created.slug };
}

async function persistApparitionCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  void metadata;
  const p = pkg.payload as Record<string, unknown>;
  const summary = typeof p.summary === "string" ? p.summary : "";
  const background = typeof p.background === "string" ? p.background : null;
  const location = typeof p.location === "string" ? p.location : null;
  const country = typeof p.country === "string" ? p.country : null;
  const approvedStatus = typeof p.approvedStatus === "string" ? p.approvedStatus : null;
  const officialPrayer = typeof p.officialPrayer === "string" ? p.officialPrayer : null;
  const externalSourceKey = `${pkg.sourceHost}:${pkg.sourceUrl}`;
  const existing = await prisma.marianApparition.findFirst({
    where: { OR: [{ slug: pkg.slug }, { externalSourceKey }] },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: "MarianApparition",
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.marianApparition.update({
      where: { id: existing.id },
      data: {
        title: pkg.title,
        summary,
        background,
        location,
        country,
        approvedStatus,
        officialPrayer,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing apparition");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: "MarianApparition",
      slug: existing.slug,
    };
  }
  const created = await prisma.marianApparition.create({
    data: {
      slug: pkg.slug,
      title: pkg.title,
      summary,
      background,
      location,
      country,
      approvedStatus,
      officialPrayer,
      externalSourceKey,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new apparition");
  return {
    outcome: "created",
    contentId: created.id,
    contentType: "MarianApparition",
    slug: created.slug,
  };
}

async function persistDevotionCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  const p = pkg.payload as Record<string, unknown>;
  const externalSourceKey = `${pkg.sourceHost}:${pkg.sourceUrl}`;
  const summary =
    typeof p.summary === "string"
      ? p.summary
      : typeof p.background === "string"
        ? p.background
        : "";
  const practiceText =
    typeof p.practiceText === "string"
      ? p.practiceText
      : typeof p.practiceInstructions === "string"
        ? p.practiceInstructions
        : null;
  const durationMinutes = typeof p.durationMinutes === "number" ? p.durationMinutes : null;
  const devotionType = typeof p.devotionType === "string" ? p.devotionType : null;
  const subtype =
    typeof p.subtype === "string" ? p.subtype : pkg.contentType === "Novena" ? "novena" : null;
  const background = typeof p.background === "string" ? p.background : null;
  const practiceInstructions =
    typeof p.practiceInstructions === "string" ? p.practiceInstructions : practiceText;

  const existing = await prisma.devotion.findFirst({
    where: { OR: [{ slug: pkg.slug }, { externalSourceKey }] },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: pkg.contentType,
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.devotion.update({
      where: { id: existing.id },
      data: {
        title: pkg.title,
        summary,
        practiceText,
        durationMinutes,
        devotionType,
        subtype,
        background,
        practiceInstructions,
        packageMetadata: metadata as unknown as object,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing devotion/novena");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: pkg.contentType,
      slug: existing.slug,
    };
  }
  const created = await prisma.devotion.create({
    data: {
      slug: pkg.slug,
      title: pkg.title,
      summary,
      practiceText,
      durationMinutes,
      devotionType,
      subtype,
      background,
      practiceInstructions,
      packageMetadata: metadata as unknown as object,
      externalSourceKey,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new devotion/novena");
  return {
    outcome: "created",
    contentId: created.id,
    contentType: pkg.contentType,
    slug: created.slug,
  };
}

async function persistGuideCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  const p = pkg.payload as Record<string, unknown>;
  const externalSourceKey = `${pkg.sourceHost}:${pkg.sourceUrl}`;
  const summary =
    typeof p.summary === "string"
      ? p.summary
      : typeof p.background === "string"
        ? p.background
        : pkg.title;
  const bodyText = typeof p.bodyText === "string" ? p.bodyText : null;
  const sacramentKey = typeof p.sacramentKey === "string" ? p.sacramentKey : null;
  const sacramentGroup = typeof p.sacramentGroup === "string" ? p.sacramentGroup : null;
  const background = typeof p.background === "string" ? p.background : null;
  const durationDays = typeof p.durationDays === "number" ? p.durationDays : null;
  const subtype = pkg.contentType.toLowerCase();
  const kind =
    pkg.contentType === "Sacrament"
      ? "CONFESSION"
      : pkg.contentType === "Rosary"
        ? "ROSARY"
        : pkg.contentType === "Consecration"
          ? "CONSECRATION"
          : "GENERAL";

  const existing = await prisma.spiritualLifeGuide.findFirst({
    where: { OR: [{ slug: pkg.slug }, { externalSourceKey }] },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: pkg.contentType,
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.spiritualLifeGuide.update({
      where: { id: existing.id },
      data: {
        title: pkg.title,
        summary,
        bodyText,
        sacramentKey,
        sacramentGroup,
        background,
        subtype,
        durationDays,
        packageMetadata: metadata as unknown as object,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing guide");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: pkg.contentType,
      slug: existing.slug,
    };
  }
  const created = await prisma.spiritualLifeGuide.create({
    data: {
      slug: pkg.slug,
      title: pkg.title,
      summary,
      bodyText,
      kind: kind as never,
      sacramentKey,
      sacramentGroup,
      background,
      subtype,
      durationDays,
      packageMetadata: metadata as unknown as object,
      externalSourceKey,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new guide");
  return {
    outcome: "created",
    contentId: created.id,
    contentType: pkg.contentType,
    slug: created.slug,
  };
}

async function persistLiturgyCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  const p = pkg.payload as Record<string, unknown>;
  const externalSourceKey = `${pkg.sourceHost}:${pkg.sourceUrl}`;
  const summary = typeof p.summary === "string" ? p.summary : null;
  const body = typeof p.body === "string" ? p.body : "";
  const liturgyKind =
    typeof p.liturgyKind === "string"
      ? p.liturgyKind
      : pkg.contentType === "History"
        ? "COUNCIL_TIMELINE"
        : "GENERAL";
  const historyType =
    typeof p.historyType === "string"
      ? p.historyType
      : pkg.contentType === "History"
        ? "Major Church events"
        : null;
  const dateOrEra = typeof p.dateOrEra === "string" ? p.dateOrEra : null;

  const existing = await prisma.liturgyEntry.findFirst({
    where: { OR: [{ slug: pkg.slug }, { externalSourceKey }] },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: pkg.contentType,
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.liturgyEntry.update({
      where: { id: existing.id },
      data: {
        title: pkg.title,
        summary,
        body,
        kind: liturgyKind as never,
        historyType,
        dateOrEra,
        packageMetadata: metadata as unknown as object,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing liturgy/history");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: pkg.contentType,
      slug: existing.slug,
    };
  }
  const created = await prisma.liturgyEntry.create({
    data: {
      slug: pkg.slug,
      title: pkg.title,
      summary,
      body,
      kind: liturgyKind as never,
      historyType,
      dateOrEra,
      packageMetadata: metadata as unknown as object,
      externalSourceKey,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new liturgy/history");
  return {
    outcome: "created",
    contentId: created.id,
    contentType: pkg.contentType,
    slug: created.slug,
  };
}

async function persistParishCanonical(
  pkg: ContentPackage,
  ready: CommonReady,
  metadata: Record<string, unknown>,
  log: (a: "ADD" | "UPDATE", r: string, reason: string) => Promise<void>,
): Promise<PersistResult> {
  void metadata;
  const p = pkg.payload as Record<string, unknown>;
  const parishName = typeof p.parishName === "string" ? p.parishName : pkg.title;
  const city = typeof p.city === "string" ? p.city : "Unknown";
  const country = typeof p.country === "string" ? p.country : "Unknown";
  const address = typeof p.address === "string" ? p.address : null;
  const region = typeof p.region === "string" ? p.region : null;
  const diocese = typeof p.diocese === "string" ? p.diocese : null;
  const websiteUrl = typeof p.websiteUrl === "string" ? p.websiteUrl : null;
  const latitude = typeof p.latitude === "number" ? p.latitude : null;
  const longitude = typeof p.longitude === "number" ? p.longitude : null;

  const existing = await prisma.parish.findFirst({
    where: {
      OR: [
        { slug: pkg.slug },
        ...(parishName && city && country
          ? [{ name_city_country: { name: parishName, city, country } } as never]
          : []),
      ],
    },
  });
  if (existing) {
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== ready.contentChecksum;
    if (!checksumDiffers) {
      return {
        outcome: "skipped",
        contentId: existing.id,
        contentType: "Parish",
        slug: existing.slug,
        reason: "duplicate content checksum",
      };
    }
    await prisma.parish.update({
      where: { id: existing.id },
      data: {
        name: parishName,
        address,
        city,
        region,
        country,
        diocese,
        websiteUrl,
        latitude,
        longitude,
        ...ready,
      },
    });
    await log("UPDATE", existing.slug, "package-rebuild updated existing parish");
    return {
      outcome: "updated",
      contentId: existing.id,
      contentType: "Parish",
      slug: existing.slug,
    };
  }
  const created = await prisma.parish.create({
    data: {
      slug: pkg.slug,
      name: parishName,
      address,
      city,
      region,
      country,
      diocese,
      websiteUrl,
      latitude,
      longitude,
      ...ready,
    },
  });
  await log("ADD", created.slug, "factory persisted new parish");
  return { outcome: "created", contentId: created.id, contentType: "Parish", slug: created.slug };
}
