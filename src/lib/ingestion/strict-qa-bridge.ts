/**
 * Bridge between the existing IngestedItem pipeline and the strict
 * content QA contract system. The runner already produces
 * IngestedItems from adapters; this bridge converts them into typed
 * CandidatePackages, runs the strict pipeline, and returns the
 * contract decision the runner must honour.
 *
 * Decision mapping:
 *
 *   - `publish` / `update` → persist (PUBLISHED + render-ready flags)
 *   - `skip`               → persist returned "skipped" for an exact
 *                            duplicate; the contract did not run
 *   - `reject`             → DO NOT persist; write RejectedContentLog
 *   - `delete`             → DO NOT persist; write RejectedContentLog
 *                            (the item was clearly wrong / random)
 *   - `archive`            → only used on existing rows by the cleanup
 *                            job — never produced by an ingest
 *   - `review`             → optional admin holding area — only used
 *                            when triggered by an admin
 */

import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedLiturgy,
  IngestedParish,
  IngestedPrayer,
  IngestedSaint,
} from "./types";
import { isCanonicalSacramentKey, normalizeSacrament } from "../content-qa/sacrament-normalize";
import { VALID_HISTORY_TYPES } from "../content-qa/contracts/history";
import { runStrictPipelineSync } from "../content-qa/pipeline";
import {
  staticPurposesForHost,
  getSourcePurposes,
  type SourcePurposeRecord,
} from "../content-qa/source-purpose";
import type {
  CandidatePackage,
  ContentTypeKey,
  ContractValidationResult,
} from "../content-qa/types";

/**
 * Pull host out of the IngestedItem's externalSourceKey. External
 * keys are URL-like strings (e.g. "vatican.va:/path"); we strip
 * everything after the colon and any URL scheme to get a bare host.
 */
function hostFromExternalKey(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  // Full URL form: parse the host directly.
  if (/^https?:\/\//i.test(key)) {
    try {
      return new URL(key).host.toLowerCase();
    } catch {
      return undefined;
    }
  }
  // Adapter "host:/path" form: everything before the first colon is the host.
  const colon = key.indexOf(":");
  const head = colon > 0 ? key.slice(0, colon) : key;
  return head.toLowerCase();
}

function sourceUrlFromExternalKey(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  if (/^https?:\/\//i.test(key)) return key;
  // Adapters historically use "host:/path" form; restore to a URL.
  const colon = key.indexOf(":");
  if (colon > 0) {
    return `https://${key.slice(0, colon)}${key.slice(colon + 1)}`;
  }
  return undefined;
}

/**
 * Liturgy-kind enum value → human label used by the strict liturgy
 * contract. The enum is upper-snake-case; the contract accepts the
 * label too via case-insensitive lookup.
 */
const LITURGY_KIND_LABEL: Record<string, string> = {
  MASS_STRUCTURE: "Mass structure",
  LITURGICAL_YEAR: "Liturgical year",
  SYMBOLISM: "Liturgical symbols",
  MARRIAGE_RITE: "Marriage rite",
  FUNERAL_RITE: "Funeral rite",
  ORDINATION_RITE: "Ordination rite",
  COUNCIL_TIMELINE: "General liturgical formation",
  GLOSSARY: "Glossary",
  GENERAL: "General liturgical formation",
};

/**
 * Map an IngestedItem to its strict-QA content type. The Devotion /
 * SpiritualLifeGuide / LiturgyEntry parent tables host multiple
 * contracts; the bridge picks the right one based on slug / category /
 * guide kind.
 */
export function classifyForStrictQA(item: IngestedItem): ContentTypeKey {
  switch (item.kind) {
    case "prayer":
      return "Prayer";
    case "saint":
      return "Saint";
    case "apparition":
      return "MarianApparition";
    case "parish":
      return "Parish";
    case "devotion":
      // Devotion subtype detection: a Novena candidate has either a
      // novena-style slug, a "Novena" word in the title / summary, or
      // a Catholic-novena marker pattern in the body.
      if (/novena/i.test(item.title) || /novena/i.test(item.summary)) return "Novena";
      if (/rosary/i.test(item.title)) return "Rosary";
      return "Devotion";
    case "liturgy": {
      // History routing — the LiturgyEntry table also hosts history
      // packages. Slug prefixes and historyType vocabulary in the body
      // route here.
      const slug = item.slug.toLowerCase();
      if (
        /^(council-|encyclical-|catechism-|code-of-canon-law-|vatican-council-|synod-)/.test(slug)
      ) {
        return "History";
      }
      const titleAndBody = `${item.title}\n${item.body}`.toLowerCase();
      const isHistoryByVocab = VALID_HISTORY_TYPES.some((t) =>
        new RegExp(`\\b${t.toLowerCase().replace(/\s+/g, "\\s+")}\\b`).test(titleAndBody),
      );
      if (isHistoryByVocab && item.liturgyKind === "COUNCIL_TIMELINE") return "History";
      return "Liturgy";
    }
    case "guide": {
      const slug = item.slug.toLowerCase();
      if (item.guideKind === "ROSARY" || /rosary/i.test(slug)) return "Rosary";
      if (item.guideKind === "CONSECRATION" || /^consecration-/.test(slug)) return "Consecration";
      // Sacrament routing — any guide whose body normalizes onto a
      // canonical sacrament key is a Sacrament package.
      const norm = normalizeSacrament({
        title: item.title,
        body: `${item.summary}\n${item.bodyText ?? ""}`,
      });
      if (norm.key) return "Sacrament";
      return "SpiritualGuidance";
    }
  }
}

export function buildCandidate(item: IngestedItem): CandidatePackage {
  const contentType = classifyForStrictQA(item);
  const sourceUrl = sourceUrlFromExternalKey(item.externalSourceKey);
  const sourceHost = hostFromExternalKey(item.externalSourceKey);
  switch (item.kind) {
    case "prayer": {
      const p = item as IngestedPrayer;
      return {
        contentType: "Prayer",
        slug: p.slug,
        title: p.defaultTitle,
        sourceUrl,
        sourceHost,
        payload: {
          // The legacy IngestedPrayer doesn't carry a discrete prayerType,
          // so we map from the category — adapters now set category to
          // one of the canonical prayer-type labels too.
          prayerType: mapCategoryToPrayerType(p.category),
          prayerName: p.defaultTitle,
          prayerText: p.body,
          category: p.category,
          language: "en",
        },
      };
    }
    case "saint": {
      const s = item as IngestedSaint;
      return {
        contentType: "Saint",
        slug: s.slug,
        title: s.canonicalName,
        sourceUrl,
        sourceHost,
        payload: {
          saintType: deriveSaintType(s.canonicalName, s.biography),
          saintName: s.canonicalName,
          feastDay: s.feastDay,
          feastMonth: s.feastMonth,
          feastDayOfMonth: s.feastDayOfMonth,
          background: s.biography,
          patronage: s.patronages,
        },
      };
    }
    case "apparition": {
      const a = item as IngestedApparition;
      return {
        contentType: "MarianApparition",
        slug: a.slug,
        title: a.title,
        sourceUrl,
        sourceHost,
        payload: {
          apparitionName: a.title,
          location: a.location ?? "",
          country: a.country ?? "",
          approvalStatus: a.approvedStatus,
          background: a.summary,
          summary: a.summary,
        },
      };
    }
    case "parish": {
      const p = item as IngestedParish;
      return {
        contentType: "Parish",
        slug: p.slug,
        title: p.name,
        sourceUrl: sourceUrl ?? p.websiteUrl,
        sourceHost,
        payload: {
          parishName: p.name,
          address: p.address,
          city: p.city,
          region: p.region,
          country: p.country,
          diocese: p.diocese,
          websiteUrl: p.websiteUrl,
        },
      };
    }
    case "devotion": {
      const d = item as IngestedDevotion;
      const isNovena = /novena/i.test(d.title) || /novena/i.test(d.summary);
      if (isNovena) {
        return {
          contentType: "Novena",
          slug: d.slug,
          title: d.title,
          sourceUrl,
          sourceHost,
          payload: {
            novenaName: d.title,
            background: d.summary,
            purpose: d.summary,
            durationDays: 9,
            days: [],
          },
        };
      }
      return {
        contentType,
        slug: d.slug,
        title: d.title,
        sourceUrl,
        sourceHost,
        payload: {
          devotionType: deriveDevotionType(d.title, d.summary),
          devotionName: d.title,
          background: d.summary,
          practiceInstructions: d.practiceText,
          duration: d.durationMinutes,
        },
      };
    }
    case "liturgy": {
      const l = item as IngestedLiturgy;
      if (contentType === "History") {
        return {
          contentType: "History",
          slug: l.slug,
          title: l.title,
          sourceUrl,
          sourceHost,
          payload: {
            historyType: deriveHistoryType(l.slug, l.title),
            title: l.title,
            dateOrEra: extractDateOrEra(l.body),
            summary: l.summary ?? "",
            body: l.body,
          },
        };
      }
      return {
        contentType: "Liturgy",
        slug: l.slug,
        title: l.title,
        sourceUrl,
        sourceHost,
        payload: {
          liturgyKind: LITURGY_KIND_LABEL[l.liturgyKind] ?? "General liturgical formation",
          title: l.title,
          summary: l.summary,
          body: l.body,
        },
      };
    }
    case "guide": {
      const g = item as IngestedGuide;
      if (contentType === "Sacrament") {
        const norm = normalizeSacrament({
          title: g.title,
          body: `${g.summary}\n${g.bodyText ?? ""}`,
        });
        return {
          contentType: "Sacrament",
          slug: g.slug,
          title: g.title,
          sourceUrl,
          sourceHost,
          payload: {
            sacramentKey: norm.key,
            sacramentName: g.title,
            sacramentGroup: norm.group,
            background: g.summary,
            catholicExplanation: g.bodyText ?? g.summary,
            preparationGuide: g.bodyText ?? g.summary,
            participationGuide: g.bodyText ?? g.summary,
          },
        };
      }
      if (contentType === "Rosary") {
        return {
          contentType: "Rosary",
          slug: g.slug,
          title: g.title,
          sourceUrl,
          sourceHost,
          payload: {
            title: g.title,
            background: g.summary,
            howToPray: g.bodyText ?? g.summary,
            openingPrayers: [],
            mysterySets: [],
            decadeStructure: g.bodyText ?? g.summary,
            closingPrayers: [],
          },
        };
      }
      if (contentType === "Consecration") {
        return {
          contentType: "Consecration",
          slug: g.slug,
          title: g.title,
          sourceUrl,
          sourceHost,
          payload: {
            consecrationName: g.title,
            background: g.summary,
            durationDays: g.durationDays ?? null,
            dailyStructure: g.bodyText ?? "",
            dailyPrayers: (g.steps ?? []).map((s, i) => ({
              dayNumber: i + 1,
              prayers: [s.body],
            })),
            finalConsecrationPrayer: g.bodyText ?? "",
            scriptureReadings: [],
          },
        };
      }
      return {
        contentType: "SpiritualGuidance",
        slug: g.slug,
        title: g.title,
        sourceUrl,
        sourceHost,
        payload: {
          guideType: mapGuideKindToType(g.guideKind),
          guideName: g.title,
          background: g.summary,
          practicalPurpose: g.summary,
          steps: g.steps,
        },
      };
    }
  }
}

/**
 * Run the strict QA pipeline against an IngestedItem. Returns the
 * contract decision the caller must honour.
 */
export function runStrictQAOnIngestedItem(
  item: IngestedItem,
  sourcePurposes: SourcePurposeRecord,
): ContractValidationResult {
  const candidate = buildCandidate(item);
  return runStrictPipelineSync(candidate, sourcePurposes);
}

/**
 * Async variant — loads source purposes from the database. Used by
 * the runner once per item.
 */
export async function runStrictQAOnIngestedItemAsync(
  item: IngestedItem,
): Promise<ContractValidationResult> {
  const host = hostFromExternalKey(item.externalSourceKey);
  const purposes = host ? await getSourcePurposes(host) : staticPurposesForHost(null);
  return runStrictQAOnIngestedItem(item, purposes);
}

function mapCategoryToPrayerType(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("marian")) return "Marian prayer";
  if (lower.includes("eucharist")) return "Eucharistic prayer";
  if (lower.includes("morning")) return "Morning prayer";
  if (lower.includes("evening")) return "Evening prayer";
  if (lower.includes("repentance") || lower.includes("penitential")) return "Repentance prayer";
  if (lower.includes("litany")) return "Litany";
  if (lower.includes("rosary")) return "Rosary prayer";
  if (lower.includes("chaplet")) return "Chaplet prayer";
  if (lower.includes("novena")) return "Novena prayer";
  if (lower.includes("traditional") || lower.includes("dominical") || lower.includes("creedal")) {
    return "Traditional Catholic prayer";
  }
  if (lower.includes("devotion")) return "Devotional prayer";
  if (lower.includes("contrition")) return "Act of contrition";
  if (lower.includes("blessing")) return "Blessing";
  if (lower.includes("consecration")) return "Consecration prayer";
  if (lower.includes("saint")) return "Saint intercession prayer";
  return "Traditional Catholic prayer";
}

function deriveSaintType(_name: string, biography: string): string {
  if (/\bdoctor\s+of\s+the\s+church\b/i.test(biography)) return "Doctor of the Church";
  if (/\bblessed\b/i.test(_name)) return "Blessed";
  if (/\bvenerable\b/i.test(_name)) return "Venerable";
  if (/\bservant\s+of\s+god\b/i.test(_name)) return "Servant of God";
  if (/\bmartyr\b/i.test(biography)) return "Martyr";
  if (
    /\bapostle\b/i.test(biography) ||
    /\b(?:peter|paul|andrew|james|john|philip|bartholomew|thomas|matthew|james\s+the\s+less|simon\s+the\s+zealot|jude)\b/i.test(
      _name,
    )
  ) {
    return "Apostle";
  }
  if (/\bpope\b/i.test(_name)) return "Pope saint";
  if (/\bevangelist\b/i.test(biography)) return "Evangelist";
  if (/\bchurch\s+father\b/i.test(biography)) return "Church Father";
  return "Saint";
}

function deriveDevotionType(title: string, summary: string): string {
  const blob = `${title}\n${summary}`.toLowerCase();
  if (/sacred\s+heart/.test(blob)) return "Sacred Heart";
  if (/immaculate\s+heart/.test(blob)) return "Immaculate Heart";
  if (/divine\s+mercy/.test(blob)) return "Divine Mercy";
  if (/eucharistic/.test(blob)) return "Eucharistic devotion";
  if (/rosary/.test(blob)) return "Rosary";
  if (/novena/.test(blob)) return "Novena";
  if (/consecration/.test(blob)) return "Consecration";
  if (/stations\s+of\s+the\s+cross/.test(blob)) return "Stations of the Cross";
  if (/adoration/.test(blob)) return "Adoration devotion";
  if (/first\s+friday/.test(blob)) return "First Friday";
  if (/first\s+saturday/.test(blob)) return "First Saturday";
  if (/chaplet/.test(blob)) return "Chaplet";
  if (/litany/.test(blob)) return "Litany";
  if (/\bmari(?:an|a)\b|\bour\s+lady\b/.test(blob)) return "Marian devotion";
  if (/\bsaint\b/.test(blob)) return "Saint devotion";
  return "Marian devotion";
}

function deriveHistoryType(slug: string, title: string): string {
  if (/^council-|^vatican-council-/i.test(slug) || /\bcouncil\b/i.test(title)) return "Council";
  if (/^encyclical-/i.test(slug) || /\bencyclical\b/i.test(title)) return "Encyclical";
  if (/^catechism-/i.test(slug)) return "Catechism";
  if (/^code-of-canon-law-/i.test(slug)) return "Code of Canon Law";
  if (/\bschism\b/i.test(title)) return "Schism";
  if (/\bfound(?:ing|ed)\b/i.test(title) && /\border\b/i.test(title))
    return "Religious order founding";
  if (/\bconsecration\b/i.test(title) && /\bpope\b/i.test(title)) return "Papal consecration";
  return "Major Church event";
}

function extractDateOrEra(body: string): string | undefined {
  const yearMatch = body.match(/\b(?:in\s+)?(\d{3,4})\b(?:\s*(?:AD|BC|CE|BCE))?/i);
  return yearMatch ? yearMatch[0] : undefined;
}

function mapGuideKindToType(kind: string): string {
  switch (kind) {
    case "ROSARY":
      return "Rosary guide";
    case "CONFESSION":
      return "Confession preparation";
    case "ADORATION":
      return "Adoration guide";
    case "CONSECRATION":
      return "Consecration guide";
    case "VOCATION":
      return "Vocation guide";
    case "DEVOTION":
    case "GENERAL":
    default:
      return "Prayer routine";
  }
}

export { isCanonicalSacramentKey, normalizeSacrament };
