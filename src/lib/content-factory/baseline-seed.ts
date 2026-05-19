/**
 * Baseline content seeder (spec §21).
 *
 * Drives one canonical fixture per spec content type through the
 * full factory pipeline:
 *
 *   syntheticSourceDocument
 *   → runContentFactory (builder → normalize → enrich → cross-source
 *     validation → strict QA → persist → public display verify →
 *     search/sitemap verify → cache revalidate)
 *
 * Used by `npm run seed:baseline` and by integration tests that need
 * a fresh database populated through the same pipeline as the
 * production worker. Skips entries whose fixture builder is unknown
 * (returns "not-supported" decision without writing anything).
 */

import { runContentFactory, syntheticSourceDocument } from ".";
import type { ContentTypeKey } from "./types";

export type BaselineSeedEntry = {
  contentType: ContentTypeKey;
  slug: string;
  title: string;
  rawBody: string;
  sourceUrl: string;
  sourceHost: string;
  sourcePurpose: string;
};

/**
 * One spec-listed baseline fixture per content type the user
 * explicitly names in §21. Parishes are optional — included only
 * when an approved parish source provides identity, so the seeder
 * skips them gracefully when the data is missing.
 */
export const BASELINE_SEED_FIXTURES: ReadonlyArray<BaselineSeedEntry> = [
  {
    contentType: "Prayer",
    slug: "our-father",
    title: "Our Father",
    sourceUrl: "https://vatican.va/prayers/baseline-our-father",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestPrayers",
    rawBody:
      "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, " +
      "thy will be done on earth as it is in heaven. Give us this day our daily " +
      "bread, and forgive us our trespasses, as we forgive those who trespass " +
      "against us. And lead us not into temptation, but deliver us from evil. Amen.",
  },
  {
    contentType: "Saint",
    slug: "thomas-aquinas",
    title: "St. Thomas Aquinas",
    sourceUrl: "https://vatican.va/saints/baseline-thomas-aquinas",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestSaints",
    rawBody:
      "St. Thomas Aquinas was a Dominican friar and Doctor of the Church. " +
      "Feast day: January 28. He synthesized faith and reason in the Summa " +
      "Theologiae and is the patron saint of theologians and Catholic " +
      "universities. Born 1225, died 1274. Canonized 1323.",
  },
  {
    contentType: "Devotion",
    slug: "divine-mercy",
    title: "Divine Mercy Devotion",
    sourceUrl: "https://vatican.va/devotions/baseline-divine-mercy",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestDevotions",
    rawBody:
      "The Divine Mercy devotion was given by Jesus to St. Faustina Kowalska " +
      "in the 1930s. Practice: Recite the Divine Mercy Chaplet daily at 3pm, " +
      "the Hour of Mercy. Begin with the Sign of the Cross, then pray the " +
      "Our Father, Hail Mary, and Apostles' Creed.",
  },
  {
    contentType: "Sacrament",
    slug: "baptism",
    title: "The Sacrament of Baptism",
    sourceUrl: "https://vatican.va/sacrament/baseline-baptism",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestSacraments",
    rawBody:
      "Baptism is the first of the seven sacraments and the gateway to the " +
      "Christian life. The Sacrament of Baptism is one of the three " +
      "sacraments of Initiation. Through baptism we are freed from sin and " +
      "reborn as children of God.",
  },
  {
    contentType: "Liturgy",
    slug: "order-of-the-mass",
    title: "Order of the Mass",
    sourceUrl: "https://vatican.va/liturgy/baseline-order-of-the-mass",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestLiturgy",
    rawBody:
      "The Mass is divided into the Introductory Rites, the Liturgy of the " +
      "Word, the Liturgy of the Eucharist, and the Concluding Rites. Each " +
      "part forms a single act of worship.",
  },
  {
    contentType: "History",
    slug: "council-of-nicaea",
    title: "First Council of Nicaea",
    sourceUrl: "https://vatican.va/history/baseline-nicaea",
    sourceHost: "vatican.va",
    sourcePurpose: "canIngestHistory",
    rawBody:
      "The First Council of Nicaea took place in AD 325. It was convened by " +
      "Emperor Constantine I and produced the original Nicene Creed. It is " +
      "considered the first ecumenical council of the Church.",
  },
];

export type BaselineSeedResult = {
  contentType: ContentTypeKey;
  slug: string;
  ok: boolean;
  decision: string;
};

/**
 * Run the baseline seeder. Returns a per-fixture result so callers
 * can summarise success vs. failure. Does NOT throw on partial
 * failure — the operator inspects the result list.
 */
export async function seedBaselineContent(): Promise<BaselineSeedResult[]> {
  const results: BaselineSeedResult[] = [];
  for (const fx of BASELINE_SEED_FIXTURES) {
    const doc = syntheticSourceDocument({
      sourceUrl: fx.sourceUrl,
      sourceHost: fx.sourceHost,
      sourceTitle: fx.title,
      rawBody: fx.rawBody,
      sourcePurposes: { [fx.sourcePurpose]: true },
    });
    try {
      const result = await runContentFactory({
        contentType: fx.contentType,
        document: doc,
        triggeredBy: "automatic",
        sourceRole: "primary_content_source",
      });
      results.push({
        contentType: fx.contentType,
        slug: fx.slug,
        decision: result.decision,
        ok:
          result.decision === "persisted-created" ||
          result.decision === "persisted-updated" ||
          result.decision === "persist-skipped",
      });
    } catch (e) {
      results.push({
        contentType: fx.contentType,
        slug: fx.slug,
        decision: `error: ${e instanceof Error ? e.message : String(e)}`,
        ok: false,
      });
    }
  }
  return results;
}
