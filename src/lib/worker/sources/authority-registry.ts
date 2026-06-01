/**
 * Authority source registry.
 *
 * Lists every Catholic source the worker is allowed to read from, with its
 * authority level. The worker NEVER fetches from a source not listed here.
 * Sources are seeded into the AuthoritySource table during setup; admins can
 * pause individual sources via the admin UI.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

export interface AuthoritySourceSeed {
  name: string;
  host: string;
  baseUrl: string;
  authorityLevel: SourceAuthorityLevel;
  description: string;
  contentTypes: ChecklistContentType[];
}

const ALL_TYPES: ChecklistContentType[] = [
  "PRAYER",
  "DEVOTION",
  "SAINT",
  "MARIAN_TITLE",
  "APPARITION",
  "NOVENA",
  "SACRAMENT",
  "GUIDE",
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "SPIRITUAL_PRACTICE",
];

export const AUTHORITY_SOURCES: AuthoritySourceSeed[] = [
  {
    name: "The Holy See (Vatican)",
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    authorityLevel: "VATICAN",
    description:
      "The official website of the Holy See. Primary authority for papal documents, Roman Curia communications, and the Catechism.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Catechism of the Catholic Church (Vatican archive)",
    host: "vatican.va/archive",
    baseUrl: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM",
    authorityLevel: "CATECHISM",
    description: "Official English text of the Catechism, hosted on Vatican.va.",
    contentTypes: [
      "PRAYER",
      "DEVOTION",
      "SACRAMENT",
      "GUIDE",
      "CHURCH_DOCUMENT",
      "LITURGICAL",
      "SPIRITUAL_PRACTICE",
    ],
  },
  {
    name: "United States Conference of Catholic Bishops",
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    authorityLevel: "USCCB",
    description:
      "USCCB pastoral letters, liturgical calendar, and approved Catholic prayers in English.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Roman Missal (Liturgical book)",
    host: "icel.org",
    baseUrl: "https://www.icel.org",
    authorityLevel: "LITURGICAL_BOOK",
    description:
      "International Commission on English in the Liturgy — approved English texts for the Roman Missal.",
    contentTypes: ["PRAYER", "LITURGICAL", "SACRAMENT"],
  },
  {
    name: "EWTN",
    host: "ewtn.com",
    baseUrl: "https://www.ewtn.com",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "EWTN Global Catholic Network — trusted Catholic publisher with editorial review.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Catholic Answers",
    host: "catholic.com",
    baseUrl: "https://www.catholic.com",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "Catholic Answers — apologetics and Catholic teaching.",
    contentTypes: ["PRAYER", "DEVOTION", "SAINT", "SACRAMENT", "GUIDE", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Catholic.org",
    host: "catholic.org",
    baseUrl: "https://www.catholic.org",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "Catholic Online — prayers and saint biographies.",
    contentTypes: ["PRAYER", "SAINT", "NOVENA", "DEVOTION"],
  },
  {
    name: "New Advent (Catholic Encyclopedia)",
    host: "newadvent.org",
    baseUrl: "https://www.newadvent.org",
    authorityLevel: "TRUSTED_PUBLISHER",
    description:
      "New Advent — Catholic Encyclopedia and source texts (St. Thomas, Fathers of the Church).",
    contentTypes: ["SAINT", "CHURCH_DOCUMENT", "LITURGICAL", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Vatican News",
    host: "vaticannews.va",
    baseUrl: "https://www.vaticannews.va",
    authorityLevel: "VATICAN",
    description: "Official Vatican news service.",
    contentTypes: ["CHURCH_DOCUMENT", "SAINT", "LITURGICAL"],
  },
  {
    name: "Press Office of the Holy See",
    host: "press.vatican.va",
    baseUrl: "https://press.vatican.va",
    authorityLevel: "VATICAN",
    description: "Official Vatican press office releases.",
    contentTypes: ["CHURCH_DOCUMENT"],
  },
  {
    name: "Dicastery for the Causes of Saints",
    host: "causasanctorum.va",
    baseUrl: "https://www.causasanctorum.va",
    authorityLevel: "VATICAN",
    description:
      "Vatican dicastery responsible for canonization causes; primary source for saint and blessed status.",
    contentTypes: ["SAINT", "APPARITION"],
  },
  {
    name: "Apostleship of Prayer / Pope's Worldwide Prayer Network",
    host: "popesprayer.va",
    baseUrl: "https://www.popesprayer.va",
    authorityLevel: "VATICAN",
    description: "Holy Father's monthly prayer intentions.",
    contentTypes: ["PRAYER", "DEVOTION"],
  },
  {
    name: "Discalced Carmelites (OCD)",
    host: "carmelite.org",
    baseUrl: "https://carmelite.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Discalced Carmelite Order resources (St. Teresa, St. John of the Cross).",
    contentTypes: ["SAINT", "DEVOTION", "SPIRITUAL_PRACTICE", "PRAYER"],
  },
  {
    name: "Dominican Order",
    host: "op.org",
    baseUrl: "https://www.op.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Order of Preachers (Dominicans).",
    contentTypes: ["SAINT", "DEVOTION", "PRAYER", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Franciscan Friars",
    host: "ofm.org",
    baseUrl: "https://www.ofm.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Order of Friars Minor (Franciscans).",
    contentTypes: ["SAINT", "DEVOTION", "PRAYER"],
  },
  {
    name: "Society of Jesus (Jesuits)",
    host: "jesuits.global",
    baseUrl: "https://www.jesuits.global",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Society of Jesus — Ignatian spirituality.",
    contentTypes: ["SAINT", "SPIRITUAL_PRACTICE", "PRAYER"],
  },
];

/**
 * Local-verification-only source hosts. When `ADMIN_WORKER_DEV_SOURCE_HOSTS`
 * is set AND `NODE_ENV !== "production"`, the listed hosts are treated as
 * approved COMMUNITY-level sources so a developer can point the worker at a
 * LOCAL MIRROR of approved Catholic content and watch the full autonomous
 * chain (fetch → read → blocks → classify → extract → build → strict QA →
 * quality → publish → verify) run end-to-end offline.
 *
 * Safety: this NEVER fires in production (guarded by NODE_ENV) and lowers
 * NO standard — content from a dev host must still pass strict QA, quality
 * scoring, and the per-type content contract before it can publish, exactly
 * like any other source. It only widens the fetch allow-list for local runs.
 */
function devSourceHosts(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  const raw = process.env.ADMIN_WORKER_DEV_SOURCE_HOSTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function authorityLevelForHost(host: string): SourceAuthorityLevel | null {
  const normalized = host.toLowerCase();
  const match = AUTHORITY_SOURCES.find(
    (src) => normalized === src.host || normalized.endsWith(`.${src.host}`),
  );
  if (match) return match.authorityLevel;
  // Local-verification hook (non-production only).
  if (devSourceHosts().some((h) => normalized === h || normalized.endsWith(`.${h}`))) {
    return "COMMUNITY";
  }
  return null;
}

export function isApprovedAuthorityHost(host: string): boolean {
  return authorityLevelForHost(host) !== null;
}

export function findAuthoritySource(host: string): AuthoritySourceSeed | null {
  const normalized = host.toLowerCase();
  return (
    AUTHORITY_SOURCES.find(
      (src) => normalized === src.host || normalized.endsWith(`.${src.host}`),
    ) ?? null
  );
}
