/**
 * Public render-readiness validators. Every public page template
 * imports the validator for its content type and refuses to render
 * the page if any required field or section is empty.
 *
 * This is the belt-and-suspenders backup to the stored
 * `publicRenderReady` flag: even if a row's flag was incorrectly set
 * by an admin manual edit, the template-level check ensures empty
 * required sections never render publicly.
 */

import { isPrayerRenderReady } from "./contracts/prayer";
import { isSaintRenderReady } from "./contracts/saint";
import { isApparitionRenderReady } from "./contracts/apparition";
import { isDevotionRenderReady } from "./contracts/devotion";
import { isNovenaRenderReady } from "./contracts/novena";
import { isSacramentRenderReady } from "./contracts/sacrament";
import { isParishRenderReady } from "./contracts/parish";
import { VALID_HISTORY_TYPES } from "./contracts/history";
import { VALID_LITURGY_KINDS } from "./contracts/liturgy";
import { VALID_GUIDE_TYPES } from "./contracts/spiritual-guidance";
import { REQUIRED_ROSARY_PRAYERS } from "./contracts/rosary";

export type PublicRenderCheck = {
  ready: boolean;
  /** Names of required sections / fields that are empty or invalid. */
  missing: string[];
};

/**
 * Generic render check. Each public page template passes its row
 * (or its current view-model fragment) here. The function returns
 * `{ ready: false, missing: [...] }` to tell the template to render
 * a 404 / "content unavailable" message instead of the page.
 */
export function checkPrayerRender(row: {
  prayerType?: string | null;
  defaultTitle: string;
  body: string;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.prayerType) missing.push("prayerType");
  if (!row.defaultTitle || row.defaultTitle.trim().length < 2) missing.push("prayerName");
  if (!row.body || row.body.trim().length < 30) missing.push("prayerText");
  if (!isPrayerRenderReady(row)) missing.push("prayer-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkSaintRender(row: {
  saintType?: string | null;
  canonicalName: string;
  feastDay?: string | null;
  feastMonth?: number | null;
  feastDayOfMonth?: number | null;
  biography: string;
  patronages: string[];
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.saintType) missing.push("saintType");
  if (!row.canonicalName || row.canonicalName.trim().length < 2) missing.push("saintName");
  if (!row.biography || row.biography.trim().length < 80) missing.push("background");
  if (!isSaintRenderReady(row)) missing.push("saint-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkApparitionRender(row: {
  title: string;
  location?: string | null;
  country?: string | null;
  approvedStatus?: string | null;
  background?: string | null;
  summary: string;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.title) missing.push("apparitionName");
  if (!row.location) missing.push("location");
  if (!row.country) missing.push("country");
  if (!row.summary || row.summary.trim().length < 60) missing.push("summary");
  if (!row.approvedStatus) missing.push("approvalStatus");
  if (!isApparitionRenderReady(row)) missing.push("apparition-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkDevotionRender(row: {
  devotionType?: string | null;
  title: string;
  background?: string | null;
  practiceInstructions?: string | null;
  summary: string;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.devotionType) missing.push("devotionType");
  if (!row.title) missing.push("devotionName");
  const background = row.background ?? row.summary;
  if (!background) missing.push("background");
  if (!row.practiceInstructions) missing.push("practiceInstructions");
  if (!isDevotionRenderReady(row)) missing.push("devotion-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkNovenaRender(row: {
  title: string;
  background?: string | null;
  purpose?: string | null;
  packageMetadata?: unknown;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.title) missing.push("novenaName");
  if (!row.background) missing.push("background");
  if (!row.purpose) missing.push("purpose");
  if (!isNovenaRenderReady(row)) missing.push("novena-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkSacramentRender(row: {
  sacramentKey?: string | null;
  sacramentGroup?: string | null;
  title: string;
  background?: string | null;
  bodyText?: string | null;
  summary?: string | null;
  packageMetadata?: unknown;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.sacramentKey) missing.push("sacramentKey");
  if (!row.sacramentGroup) missing.push("sacramentGroup");
  if (!row.title) missing.push("sacramentName");
  if (!isSacramentRenderReady(row)) missing.push("sacrament-render-ready");
  return { ready: missing.length === 0, missing };
}

export function checkRosaryRender(row: {
  title: string;
  background?: string | null;
  bodyText?: string | null;
  packageMetadata?: { openingPrayers?: string[]; mysterySets?: unknown[] } | null;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.title) missing.push("title");
  if (!row.background) missing.push("background");
  if (!row.bodyText) missing.push("howToPray");
  const meta = row.packageMetadata;
  if (!meta || !Array.isArray(meta.openingPrayers) || meta.openingPrayers.length === 0) {
    missing.push("coreOpeningPrayers");
  } else {
    for (const required of REQUIRED_ROSARY_PRAYERS) {
      if (
        !meta.openingPrayers.some((p) => new RegExp(required.replace(/'/g, "['’]?"), "i").test(p))
      ) {
        missing.push(`coreOpeningPrayer:${required}`);
      }
    }
  }
  if (!meta || !Array.isArray(meta.mysterySets) || meta.mysterySets.length < 3) {
    missing.push("mysterySets");
  }
  return { ready: missing.length === 0, missing };
}

export function checkConsecrationRender(row: {
  title: string;
  background?: string | null;
  durationDays?: number | null;
  packageMetadata?: { dailyPrayers?: unknown[]; finalConsecrationPrayer?: string } | null;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.title) missing.push("consecrationName");
  if (!row.background) missing.push("background");
  if (!row.durationDays || row.durationDays < 1) missing.push("durationDays");
  const meta = row.packageMetadata;
  if (!meta || !Array.isArray(meta.dailyPrayers) || meta.dailyPrayers.length === 0) {
    missing.push("dailyPrayers");
  }
  if (!meta || !meta.finalConsecrationPrayer || meta.finalConsecrationPrayer.trim().length === 0) {
    missing.push("finalConsecrationPrayer");
  }
  return { ready: missing.length === 0, missing };
}

export function checkSpiritualGuidanceRender(row: {
  kind?: string | null;
  subtype?: string | null;
  title: string;
  summary: string;
  bodyText?: string | null;
  steps?: unknown;
}): PublicRenderCheck {
  const missing: string[] = [];
  // Type can be inferred from kind or subtype; we accept any allowed
  // guide type label.
  if (!row.title) missing.push("guideName");
  if (!row.summary || row.summary.trim().length === 0) missing.push("practicalPurpose");
  const steps = row.steps as Array<{ title?: string; body?: string }> | null;
  if (!Array.isArray(steps) || steps.length === 0) {
    missing.push("steps");
  } else {
    for (const s of steps) {
      if (!s.title || !s.body) {
        missing.push("steps:incomplete");
        break;
      }
    }
  }
  return { ready: missing.length === 0, missing };
}

export function checkLiturgyRender(row: {
  kind?: string | null;
  title: string;
  body: string;
  sourceUrl?: string | null;
  externalSourceKey?: string | null;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.title) missing.push("title");
  if (!row.body || row.body.trim().length === 0) missing.push("body");
  if (!row.kind) missing.push("liturgyKind");
  if (!row.sourceUrl && !row.externalSourceKey) missing.push("sourceUrl");
  return { ready: missing.length === 0, missing };
}

export function checkHistoryRender(row: {
  historyType?: string | null;
  title: string;
  dateOrEra?: string | null;
  summary?: string | null;
  body: string;
  sourceUrl?: string | null;
  externalSourceKey?: string | null;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (
    !row.historyType ||
    !(VALID_HISTORY_TYPES as ReadonlyArray<string>).includes(row.historyType)
  ) {
    missing.push("historyType");
  }
  if (!row.title) missing.push("title");
  if (!row.dateOrEra) missing.push("dateOrEra");
  if (!row.summary || row.summary.trim().length === 0) missing.push("summary");
  if (!row.body || row.body.trim().length === 0) missing.push("body");
  if (!row.sourceUrl && !row.externalSourceKey) missing.push("sourceUrl");
  return { ready: missing.length === 0, missing };
}

export function checkParishRender(row: {
  name: string;
  city?: string | null;
  address?: string | null;
  country?: string | null;
  sourceUrl?: string | null;
  externalSourceKey?: string | null;
  websiteUrl?: string | null;
}): PublicRenderCheck {
  const missing: string[] = [];
  if (!row.name) missing.push("parishName");
  if (!row.country) missing.push("country");
  if (!row.city && !row.address) missing.push("locationInfo");
  if (!row.sourceUrl && !row.externalSourceKey && !row.websiteUrl) missing.push("sourceUrl");
  if (!isParishRenderReady(row)) missing.push("parish-render-ready");
  return { ready: missing.length === 0, missing };
}

/** Allowed values exported for admin UI dropdowns / validators. */
export const RENDER_ALLOWED = {
  liturgyKinds: VALID_LITURGY_KINDS,
  historyTypes: VALID_HISTORY_TYPES,
  guideTypes: VALID_GUIDE_TYPES,
} as const;
