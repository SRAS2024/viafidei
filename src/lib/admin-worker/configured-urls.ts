/**
 * Configured fixed URL lists (spec section 5, discovery method
 * CONFIGURED_URL). The operator maintains a catalogue of known-good
 * URLs per content type and the navigator inserts them as
 * CandidateSourceUrl rows on every pass.
 *
 * The catalogue is a JSON config so it lives in code review and ships
 * with the deploy — no DB editing required. Each entry MUST be on an
 * approved authority host or it is silently dropped.
 */

import type {
  CandidateSourceDiscoveryMethod,
  ChecklistContentType,
  PrismaClient,
} from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/checklist";
import { discoverCandidate, isJunkUrl } from "./web-navigator";
import { writeAdminWorkerLog } from "./logs";

export interface ConfiguredUrlEntry {
  url: string;
  predictedContentType?: ChecklistContentType;
  /** Note for the operator (why this URL is on the list). */
  note?: string;
}

/**
 * Built-in catalogue. Operators can add to this file via PR or
 * supplement it at runtime with `addConfiguredUrl()` below.
 *
 * The entries here are intentionally small + Vatican-only to start;
 * the catalogue grows by PR as the operator validates URLs.
 */
export const BUILTIN_CONFIGURED_URLS: readonly ConfiguredUrlEntry[] = [
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/credo.htm",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "Catechism — The Creed",
  },
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/sacraments.htm",
    predictedContentType: "SACRAMENT",
    note: "Catechism — Sacraments",
  },
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/prayer.htm",
    predictedContentType: "PRAYER",
    note: "Catechism — Christian Prayer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED SEED CATALOGUE — high-yield index / landing pages across every
  // content type. Each links out to many items the internal-link crawler + the
  // per-host sitemap discovery then mine. All are on approved authority hosts.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Church documents, councils, encyclicals, POPES ─────────────────────────
  {
    url: "https://www.vatican.va/content/vatican/en/holy-father.html",
    predictedContentType: "POPE",
    note: "Vatican — the Holy Father + list of popes",
  },
  {
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/index.htm",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "Documents of the Second Vatican Council",
  },
  {
    url: "https://www.papalencyclicals.net/",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "Papal Encyclicals Online — full archive",
  },
  {
    url: "https://www.papalencyclicals.net/councils/",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "Ecumenical councils — full texts",
  },
  {
    url: "https://www.usccb.org/committees/doctrine",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "USCCB — doctrine",
  },

  // ── Saints + Doctors of the Church ─────────────────────────────────────────
  {
    url: "https://www.newadvent.org/cathen/",
    predictedContentType: "SAINT",
    note: "Catholic Encyclopedia — full A–Z index",
  },
  {
    url: "https://www.catholic.org/saints/",
    predictedContentType: "SAINT",
    note: "Catholic Online — saints index",
  },
  {
    url: "https://www.catholic.org/saints/patron.php",
    predictedContentType: "SAINT",
    note: "Catholic Online — patron saints index",
  },
  {
    url: "https://www.franciscanmedia.org/saint-of-the-day/",
    predictedContentType: "SAINT",
    note: "Franciscan Media — Saint of the Day archive",
  },
  {
    url: "https://catholicsaints.info/",
    predictedContentType: "SAINT",
    note: "CatholicSaints.Info — comprehensive saints index",
  },
  {
    url: "https://www.newadvent.org/summa/",
    predictedContentType: "DOCTOR",
    note: "Summa Theologica (St. Thomas Aquinas)",
  },
  {
    url: "https://www.newadvent.org/fathers/",
    predictedContentType: "DOCTOR",
    note: "New Advent — Church Fathers (full texts)",
  },
  {
    url: "https://www.corpusthomisticum.org/",
    predictedContentType: "DOCTOR",
    note: "Corpus Thomisticum — complete Aquinas",
  },

  // ── Prayers (incl. Latin) ──────────────────────────────────────────────────
  {
    url: "https://www.ewtn.com/catholicism/devotions",
    predictedContentType: "PRAYER",
    note: "EWTN — prayers & devotions library",
  },
  {
    url: "https://www.catholic.org/prayers/",
    predictedContentType: "PRAYER",
    note: "Catholic Online — prayers index",
  },
  {
    url: "https://www.usccb.org/prayers",
    predictedContentType: "PRAYER",
    note: "USCCB — Catholic prayers",
  },
  {
    url: "http://www.preces-latinae.org/thesaurus/thesaurus.html",
    predictedContentType: "PRAYER",
    note: "Thesaurus Precum Latinarum — Latin prayers index",
  },
  {
    url: "https://www.vatican.va/special/rosary/index_rosary_en.html",
    predictedContentType: "PRAYER",
    note: "Vatican — the Holy Rosary",
  },

  // ── Novenas ────────────────────────────────────────────────────────────────
  {
    url: "https://www.praymorenovenas.com/list-of-novenas",
    predictedContentType: "NOVENA",
    note: "Pray More Novenas — full list",
  },
  {
    url: "https://www.ewtn.com/catholicism/devotions/novenas",
    predictedContentType: "NOVENA",
    note: "EWTN — novenas",
  },

  // ── Devotions ──────────────────────────────────────────────────────────────
  {
    url: "https://www.thedivinemercy.org/message/devotions",
    predictedContentType: "DEVOTION",
    note: "Divine Mercy — devotions (Marians)",
  },
  {
    url: "https://www.rosarycenter.org/",
    predictedContentType: "DEVOTION",
    note: "Rosary Confraternity",
  },
  {
    url: "https://www.catholicculture.org/culture/library/most/",
    predictedContentType: "DEVOTION",
    note: "Catholic Culture — devotional library",
  },

  // ── Marian titles + apparitions ────────────────────────────────────────────
  {
    url: "https://www.miraculousmedal.org/",
    predictedContentType: "MARIAN_TITLE",
    note: "Miraculous Medal Shrine",
  },
  {
    url: "https://www.ewtn.com/catholicism/teachings/marian",
    predictedContentType: "MARIAN_TITLE",
    note: "EWTN — Marian teachings & titles",
  },
  {
    url: "https://www.lourdes-france.org/en/",
    predictedContentType: "APPARITION",
    note: "Sanctuary of Lourdes",
  },
  { url: "https://www.fatima.pt/en", predictedContentType: "APPARITION", note: "Shrine of Fátima" },

  // ── Liturgical + rites ─────────────────────────────────────────────────────
  {
    url: "https://www.universalis.com/",
    predictedContentType: "LITURGICAL",
    note: "Universalis — Liturgy of the Hours + Mass",
  },
  {
    url: "https://divineoffice.org/",
    predictedContentType: "LITURGICAL",
    note: "Divine Office — Liturgy of the Hours",
  },
  {
    url: "https://www.catholicculture.org/culture/liturgicalyear/",
    predictedContentType: "LITURGICAL",
    note: "Catholic Culture — liturgical year",
  },
  {
    url: "https://www.liturgyoffice.org.uk/",
    predictedContentType: "RITE",
    note: "Liturgy Office (England & Wales)",
  },

  // ── Spiritual practices ────────────────────────────────────────────────────
  {
    url: "https://www.ignatianspirituality.com/",
    predictedContentType: "SPIRITUAL_PRACTICE",
    note: "Ignatian Spirituality — Spiritual Exercises",
  },
  {
    url: "https://www.osb.org/",
    predictedContentType: "SPIRITUAL_PRACTICE",
    note: "Benedictines — Lectio Divina & the Rule",
  },

  // ── Parish / hierarchy directories ─────────────────────────────────────────
  {
    url: "https://gcatholic.org/dioceses/",
    predictedContentType: "PARISH",
    note: "GCatholic — dioceses & churches worldwide",
  },
  {
    url: "https://www.catholic-hierarchy.org/",
    predictedContentType: "PARISH",
    note: "Catholic-Hierarchy — dioceses & bishops",
  },
] as const;

const RUNTIME_EXTRA: ConfiguredUrlEntry[] = [];

export function addConfiguredUrl(entry: ConfiguredUrlEntry): void {
  RUNTIME_EXTRA.push(entry);
}

export function listConfiguredUrls(): readonly ConfiguredUrlEntry[] {
  return [...BUILTIN_CONFIGURED_URLS, ...RUNTIME_EXTRA];
}

export interface ConfiguredUrlsOutcome {
  total: number;
  inserted: number;
  rejected: number;
}

export async function discoverFromConfiguredUrls(
  prisma: PrismaClient,
): Promise<ConfiguredUrlsOutcome> {
  const entries = listConfiguredUrls();
  let inserted = 0;
  let rejected = 0;
  for (const entry of entries) {
    let host = "";
    try {
      host = new URL(entry.url).host;
    } catch {
      rejected += 1;
      continue;
    }
    if (!isApprovedAuthorityHost(host)) {
      rejected += 1;
      continue;
    }
    if (isJunkUrl(entry.url).junk) {
      rejected += 1;
      continue;
    }
    const row = await discoverCandidate(prisma, {
      url: entry.url,
      sourceHost: host,
      discoveryMethod: "CONFIGURED_URL" as CandidateSourceDiscoveryMethod,
      predictedContentType: entry.predictedContentType,
      // Configured URLs are highest-confidence — the operator has
      // hand-picked them.
      predictedUsefulness: 0.9,
    });
    if (row) inserted += 1;
    else rejected += 1;
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "configured_urls_discovery",
    message: `Configured URL pass: ${inserted} inserted, ${rejected} rejected (of ${entries.length}).`,
    safeMetadata: { total: entries.length, inserted, rejected },
  });
  return { total: entries.length, inserted, rejected };
}
