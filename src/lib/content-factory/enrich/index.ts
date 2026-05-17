/**
 * Package enrichment layer.
 *
 * Enrichment may fill missing fields only from approved structured
 * sources or canonical internal maps:
 *
 *   - Saint feast days   ← canonical saint calendar (internal map)
 *   - Saint patronages   ← approved saint sources (per host whitelist)
 *   - Sacrament groups   ← canonical 7-sacrament map
 *   - Scripture text     ← approved Catholic Bible source
 *   - Parish diocese     ← approved parish directories
 *
 * Enrichment never guesses. Every filled field receives a fresh
 * FieldProvenance with `extractionMethod = "enrichment:<source>"` so
 * an admin can audit where the value came from.
 *
 * If a value cannot be enriched, the field stays empty and the
 * builder/QA layer decides whether the package still validates.
 */

import { logger } from "../../observability/logger";
import {
  SACRAMENT_GROUP_BY_KEY,
  isCanonicalSacramentKey,
} from "../../content-qa/sacrament-normalize";
import type { ContentPackage, FieldProvenance } from "../types";

function canonicalSacramentGroup(key: string): string | null {
  if (!isCanonicalSacramentKey(key)) return null;
  return SACRAMENT_GROUP_BY_KEY[key];
}

const APPROVED_SAINT_HOSTS = new Set([
  "vatican.va",
  "usccb.org",
  "catholic.org",
  "catholicculture.org",
]);

const APPROVED_BIBLE_HOSTS = new Set(["bible.usccb.org", "usccb.org", "vatican.va"]);

const APPROVED_PARISH_DIRECTORY_HOSTS = new Set(["usccb.org", "parishesonline.com"]);

const SAINT_FEAST_CANONICAL: Record<string, { feastDay: string; feastMonth: number; feastDayOfMonth: number }> = {
  "francis-of-assisi": { feastDay: "October 4", feastMonth: 10, feastDayOfMonth: 4 },
  "thérèse-of-lisieux": { feastDay: "October 1", feastMonth: 10, feastDayOfMonth: 1 },
  "therese-of-lisieux": { feastDay: "October 1", feastMonth: 10, feastDayOfMonth: 1 },
  "ignatius-of-loyola": { feastDay: "July 31", feastMonth: 7, feastDayOfMonth: 31 },
  "anthony-of-padua": { feastDay: "June 13", feastMonth: 6, feastDayOfMonth: 13 },
  "augustine-of-hippo": { feastDay: "August 28", feastMonth: 8, feastDayOfMonth: 28 },
  "thomas-aquinas": { feastDay: "January 28", feastMonth: 1, feastDayOfMonth: 28 },
  "catherine-of-siena": { feastDay: "April 29", feastMonth: 4, feastDayOfMonth: 29 },
};

const SAINT_PATRONAGE_CANONICAL: Record<string, string[]> = {
  "francis-of-assisi": ["Animals", "Ecology", "Italy"],
  "thérèse-of-lisieux": ["Missions", "Florists"],
  "therese-of-lisieux": ["Missions", "Florists"],
  "anthony-of-padua": ["Lost things", "Poor"],
  "joseph": ["Workers", "Universal Church", "Fathers"],
};

export function enrichSaintFeast(args: {
  slug: string;
  builderVersion: string;
  pkg: ContentPackage;
}): { enriched: boolean; provenance?: FieldProvenance } {
  const canon = SAINT_FEAST_CANONICAL[args.slug];
  if (!canon) return { enriched: false };
  const p = args.pkg.payload as Record<string, unknown>;
  if (p.feastDay) return { enriched: false };
  p.feastDay = canon.feastDay;
  p.feastMonth = canon.feastMonth;
  p.feastDayOfMonth = canon.feastDayOfMonth;
  const prov: FieldProvenance = {
    sourceUrl: args.pkg.sourceUrl,
    sourceHost: args.pkg.sourceHost,
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: "canonical-saint-calendar",
    snippetHash: null,
    extractionMethod: "enrichment:canonical-saint-calendar",
    extractorVersion: args.builderVersion,
    confidence: 0.95,
    timestamp: new Date().toISOString(),
  };
  args.pkg.provenance.feastDay = prov;
  args.pkg.provenance.feastMonth = prov;
  args.pkg.provenance.feastDayOfMonth = prov;
  return { enriched: true, provenance: prov };
}

export function enrichSaintPatronage(args: {
  slug: string;
  builderVersion: string;
  pkg: ContentPackage;
}): { enriched: boolean; provenance?: FieldProvenance } {
  if (!APPROVED_SAINT_HOSTS.has(args.pkg.sourceHost)) return { enriched: false };
  const p = args.pkg.payload as Record<string, unknown>;
  if (Array.isArray(p.patronages) && p.patronages.length > 0) return { enriched: false };
  const canon = SAINT_PATRONAGE_CANONICAL[args.slug];
  if (!canon) return { enriched: false };
  p.patronages = canon;
  const prov: FieldProvenance = {
    sourceUrl: args.pkg.sourceUrl,
    sourceHost: args.pkg.sourceHost,
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: "canonical-patronage-map",
    snippetHash: null,
    extractionMethod: "enrichment:canonical-patronage-map",
    extractorVersion: args.builderVersion,
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  };
  args.pkg.provenance.patronages = prov;
  return { enriched: true, provenance: prov };
}

export function enrichSacramentGroup(args: {
  builderVersion: string;
  pkg: ContentPackage;
}): { enriched: boolean; provenance?: FieldProvenance } {
  const p = args.pkg.payload as Record<string, unknown>;
  if (typeof p.sacramentKey !== "string") return { enriched: false };
  if (typeof p.sacramentGroup === "string" && p.sacramentGroup) return { enriched: false };
  const group = canonicalSacramentGroup(p.sacramentKey);
  if (!group) return { enriched: false };
  p.sacramentGroup = group;
  const prov: FieldProvenance = {
    sourceUrl: args.pkg.sourceUrl,
    sourceHost: args.pkg.sourceHost,
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: "canonical-sacrament-group-map",
    snippetHash: null,
    extractionMethod: "deterministic:canonical-sacrament-group",
    extractorVersion: args.builderVersion,
    confidence: 1,
    timestamp: new Date().toISOString(),
  };
  args.pkg.provenance.sacramentGroup = prov;
  return { enriched: true, provenance: prov };
}

export function enrichScriptureText(args: {
  builderVersion: string;
  pkg: ContentPackage;
}): { enriched: boolean; provenance?: FieldProvenance } {
  if (!APPROVED_BIBLE_HOSTS.has(args.pkg.sourceHost)) return { enriched: false };
  const p = args.pkg.payload as Record<string, unknown>;
  if (typeof p.scriptureText === "string" && p.scriptureText.trim()) return { enriched: false };
  // The factory does not own a bundled Bible text; we mark the block
  // as reference-only so the renderer shows the reference without the
  // text and QA still passes (the contract permits ref-only blocks).
  p.scriptureText = null;
  p.licenseStatus = p.licenseStatus ?? "reference_only";
  return { enriched: false };
}

export function enrichParishDiocese(args: {
  builderVersion: string;
  pkg: ContentPackage;
}): { enriched: boolean; provenance?: FieldProvenance } {
  if (!APPROVED_PARISH_DIRECTORY_HOSTS.has(args.pkg.sourceHost)) return { enriched: false };
  const p = args.pkg.payload as Record<string, unknown>;
  if (typeof p.diocese === "string" && p.diocese) return { enriched: false };
  return { enriched: false };
}

/**
 * Apply all enrichment passes to a content package. Returns the same
 * package for fluent chaining. Each pass is best-effort; failures are
 * logged but do not block QA.
 */
export function enrichPackage(pkg: ContentPackage, builderVersion: string): ContentPackage {
  try {
    switch (pkg.contentType) {
      case "Saint": {
        enrichSaintFeast({ slug: pkg.slug, builderVersion, pkg });
        enrichSaintPatronage({ slug: pkg.slug, builderVersion, pkg });
        break;
      }
      case "Sacrament": {
        enrichSacramentGroup({ builderVersion, pkg });
        break;
      }
      case "Parish": {
        enrichParishDiocese({ builderVersion, pkg });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    logger.warn("content-factory.enrich.failed", {
      slug: pkg.slug,
      contentType: pkg.contentType,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return pkg;
}
