/**
 * The public-domain fallbacks of the SAINT mapper: the Catholic Encyclopedia
 * (1913, via Wikisource) and the Roman Martyrology (1916 English edition).
 *
 * They are FALLBACKS, never overrides. The mapper's Wikipedia gates run first
 * and keep every veto they had (an infobox that names another feast, a stage
 * the article contradicts, another communion as the venerating body). These
 * sources are asked only for what Wikipedia could not give:
 *   - a biography, when there is no English article or its lead is under the
 *     biography floor;
 *   - corroboration of Wikidata's ONE feast day, when the article states no
 *     feast at all (or there is no article).
 * Either source contradicting Wikidata's day refuses the row, and so does an
 * Encyclopedia article used for the biography whose own feast statement
 * disagrees with the feast the row would publish.
 *
 * Which source supplied the biography and which corroborated the feast is
 * recorded in the payload's `provenance`, and the detail page credits a
 * public-domain biography in one small line, as it credits Wikipedia.
 */

import {
  CATHOLIC_ENCYCLOPEDIA,
  catholicEncyclopediaBiography,
  catholicEncyclopediaFeastVerdict,
  resolveCatholicEncyclopediaArticle,
  subjectNameWords,
  type CatholicEncyclopediaArticle,
  type CatholicEncyclopediaRef,
} from "./catholic-encyclopedia";
import type { ParsedFeast } from "./corroboration";
import { noteUnreadSource, type SourceReadLedger } from "./http";
import {
  MARTYROLOGY_1916,
  martyrologyBiography,
  martyrologyFeastVerdict,
  type MartyrologyVerdict,
} from "./roman-martyrology";
import type { CanonizationStatus, SaintFacts } from "./saint-facts";

/** Where a saint's biography text, or its feast's corroboration, came from. */
export type SaintTextSource =
  | "wikipedia"
  | typeof CATHOLIC_ENCYCLOPEDIA.id
  | typeof MARTYROLOGY_1916.id;

/** A biography quoted from a public-domain source, with what credits it. */
export interface PublicDomainBiography {
  text: string;
  source: typeof CATHOLIC_ENCYCLOPEDIA.id | typeof MARTYROLOGY_1916.id;
  /** The page credited and cited (Wikisource article / the archive.org book). */
  url: string;
  /** The Encyclopedia article's title ("St. Ita"). */
  title?: string;
  /** The Martyrology day the announcement is read on ("MM-DD"). */
  day?: string;
}

/** A public-domain source contradicting Wikidata's feast day: the row is refused. */
export interface PublicDomainFeastRefusal {
  kind: "refused";
  code: "feast_contradicted" | "feast_ambiguous";
  detail: string;
}

/** What the public-domain sources say about Wikidata's feast day. */
export type PublicDomainFeastVerdict =
  | { kind: "corroborated"; source: PublicDomainBiography["source"]; url: string }
  | PublicDomainFeastRefusal
  | { kind: "silent"; detail: string };

/**
 * One row's public-domain witnesses, read lazily and at most once each: the
 * Martyrology from the committed index (no request), the Encyclopedia from
 * Wikisource (only for a saint whose Wikidata item links it).
 */
export class SaintPublicDomainSources {
  private encyclopedia: Promise<CatholicEncyclopediaArticle | null> | null = null;
  private encyclopediaUnread = false;
  /** The English article's Encyclopedia citations (empty without one). */
  private refs: readonly CatholicEncyclopediaRef[] = [];
  /** The English article's title, for the Wikisource header check. */
  private wikipediaTitle: string | null = null;

  constructor(
    private readonly input: {
      facts: Pick<SaintFacts, "label" | "ceIds" | "ceArticles">;
      ledger?: SourceReadLedger;
    },
  ) {}

  /**
   * Once the English article has been read: the Encyclopedia articles it
   * cites, and its title. Call before the Encyclopedia is first asked for.
   */
  useEnglishArticle(refs: readonly CatholicEncyclopediaRef[], title: string | null): void {
    this.refs = refs;
    this.wikipediaTitle = title;
  }

  /** True when Wikidata links the saint to the Encyclopedia at all. */
  hasEncyclopediaLink(): boolean {
    return this.input.facts.ceIds.length > 0 || this.input.facts.ceArticles.length > 0;
  }

  /**
   * Could an Encyclopedia article be found without an English Wikipedia
   * article? Only through Wikidata's own link to the Wikisource page.
   */
  hasDirectEncyclopediaLink(): boolean {
    return this.input.facts.ceArticles.length > 0;
  }

  /** The saint's Encyclopedia article, read once (null when none can be tied to the saint). */
  encyclopediaArticle(): Promise<CatholicEncyclopediaArticle | null> {
    if (!this.hasEncyclopediaLink()) return Promise.resolve(null);
    this.encyclopedia ??= (async () => {
      const own: SourceReadLedger = { unread: [] };
      const article = await resolveCatholicEncyclopediaArticle({
        wikisourceUrls: this.input.facts.ceArticles,
        newAdventIds: this.input.facts.ceIds,
        refs: this.refs,
        wikipediaTitle: this.wikipediaTitle,
        ledger: own,
      }).catch(() => null);
      if (own.unread.length > 0) {
        this.encyclopediaUnread = true;
        for (const url of own.unread) noteUnreadSource(this.input.ledger, url);
      }
      return article;
    })();
    return this.encyclopedia;
  }

  /**
   * True once the Encyclopedia was asked for and a read of it did not
   * complete. Its feast statement can VETO a row, so — like an unread
   * Wikipedia article — an unread page means the row waits for the next pass
   * rather than publishing on the other witnesses alone.
   */
  encyclopediaReadFailed(): boolean {
    return this.encyclopediaUnread;
  }

  /** The Martyrology's verdict on Wikidata's single feast day (no request). */
  martyrology(
    feast: ParsedFeast | null,
    status: CanonizationStatus | null,
  ): MartyrologyVerdict | null {
    if (!feast || !status || status === "venerable" || status === "servant_of_god") return null;
    return martyrologyFeastVerdict({ label: this.input.facts.label, feast, status });
  }

  /** The Martyrology announcement as a biography, when it may be shown. */
  martyrologyBiography(
    feast: ParsedFeast | null,
    status: CanonizationStatus | null,
  ): PublicDomainBiography | null {
    const verdict = this.martyrology(feast, status);
    if (verdict?.kind !== "corroborated") return null;
    const text = martyrologyBiography(verdict.match);
    return text
      ? { text, source: MARTYROLOGY_1916.id, url: MARTYROLOGY_1916.url, day: verdict.match.day }
      : null;
  }

  /** The Encyclopedia's opening paragraph(s) as a biography, when there is one. */
  async encyclopediaBiography(): Promise<PublicDomainBiography | null> {
    const article = await this.encyclopediaArticle();
    const text = article ? catholicEncyclopediaBiography(article) : null;
    return article && text
      ? { text, source: CATHOLIC_ENCYCLOPEDIA.id, url: article.url, title: article.title }
      : null;
  }

  /**
   * The biography to publish when Wikipedia has none: the Encyclopedia's
   * first, the Martyrology's announcement second.
   */
  async biography(
    feast: ParsedFeast | null,
    status: CanonizationStatus | null,
  ): Promise<PublicDomainBiography | null> {
    return (await this.encyclopediaBiography()) ?? this.martyrologyBiography(feast, status);
  }

  /** The words naming the Encyclopedia article's subject (its title and the label). */
  private subjectNames(article: CatholicEncyclopediaArticle): string[] {
    return subjectNameWords(article.title, this.input.facts.label);
  }

  /**
   * Does the Encyclopedia article (when one was read) state a feast other
   * than `feastDay`? The refusal when it does; null when it agrees, states
   * none, or there is no article.
   */
  async encyclopediaDisagreement(feastDay: string): Promise<PublicDomainFeastRefusal | null> {
    const article = await this.encyclopediaArticle();
    if (!article) return null;
    const verdict = catholicEncyclopediaFeastVerdict(article, feastDay, this.subjectNames(article));
    if (verdict.kind !== "contradicted" && verdict.kind !== "ambiguous") return null;
    return {
      kind: "refused",
      code: verdict.kind === "contradicted" ? "feast_contradicted" : "feast_ambiguous",
      detail: `the Catholic Encyclopedia (${article.title}) states ${verdict.days.join(" ")}, Wikidata ${feastDay}`,
    };
  }

  /**
   * Wikidata's ONE feast day against the public-domain sources, for a row
   * whose Wikipedia article stated no feast. Either source contradicting the
   * day refuses; otherwise the Encyclopedia corroborates (an explicit
   * statement of that day and no other), else the Martyrology (the saint
   * named on that day).
   */
  async feastVerdict(
    feast: ParsedFeast,
    status: CanonizationStatus,
  ): Promise<PublicDomainFeastVerdict> {
    const disagreement = await this.encyclopediaDisagreement(feast.feastDay);
    if (disagreement) return disagreement;
    const rm = this.martyrology(feast, status);
    if (rm?.kind === "contradicted") {
      return { kind: "refused", code: "feast_contradicted", detail: rm.detail };
    }
    const article = await this.encyclopediaArticle();
    if (
      article &&
      catholicEncyclopediaFeastVerdict(article, feast.feastDay, this.subjectNames(article)).kind ===
        "corroborated"
    ) {
      return { kind: "corroborated", source: CATHOLIC_ENCYCLOPEDIA.id, url: article.url };
    }
    if (rm?.kind === "corroborated") {
      return { kind: "corroborated", source: MARTYROLOGY_1916.id, url: MARTYROLOGY_1916.url };
    }
    const why = rm?.kind === "silent" ? ` (the Martyrology: ${rm.detail})` : "";
    return { kind: "silent", detail: `no public-domain source states ${feast.feastDay}${why}` };
  }
}
