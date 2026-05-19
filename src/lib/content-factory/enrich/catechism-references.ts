/**
 * Catechism reference enrichment (spec §10).
 *
 * Sacrament packages benefit from references to the Catechism of
 * the Catholic Church (CCC). The factory does not generate these
 * — they come from a fixed internal table keyed by sacrament key.
 * When the builder produces a sacrament package without a
 * `catechismReferences` field, the enricher fills it.
 *
 * The table is intentionally small and well-cited; future
 * expansion goes here.
 */

import type { ContentPackage } from "../types";

/**
 * Authoritative Catechism reference lookup table. Numbers come
 * directly from the Catechism's paragraph numbering.
 */
export const CATECHISM_REFERENCES_BY_SACRAMENT: Readonly<
  Record<string, ReadonlyArray<{ paragraph: string; topic: string }>>
> = {
  baptism: [
    { paragraph: "1213", topic: "Baptism is the gateway to life in the Spirit" },
    { paragraph: "1216", topic: "Baptism as enlightenment / illumination" },
    { paragraph: "1257", topic: "Necessity of Baptism for salvation" },
  ],
  eucharist: [
    { paragraph: "1322", topic: "The Eucharist as the source and summit of the Christian life" },
    { paragraph: "1324", topic: "Eucharist as the heart and summit of the Church's life" },
    { paragraph: "1356", topic: "Real presence of Christ in the Eucharist" },
  ],
  confirmation: [
    { paragraph: "1285", topic: "Confirmation perfects baptismal grace" },
    {
      paragraph: "1303",
      topic: "Confirmation increases and deepens baptismal grace",
    },
  ],
  reconciliation: [
    { paragraph: "1422", topic: "Sacrament of Penance and Reconciliation" },
    { paragraph: "1440", topic: "Sin is an offense against God" },
    { paragraph: "1456", topic: "Confession of sins" },
  ],
  anointing_of_the_sick: [
    {
      paragraph: "1499",
      topic: "Sacrament of the sick — grace of the Holy Spirit for sufferers",
    },
    { paragraph: "1511", topic: "Anointing of the Sick from the New Testament" },
  ],
  holy_orders: [
    { paragraph: "1536", topic: "Sacrament of apostolic ministry" },
    { paragraph: "1547", topic: "Ministerial priesthood" },
  ],
  matrimony: [
    { paragraph: "1601", topic: "Matrimonial covenant" },
    { paragraph: "1615", topic: "Indissolubility of marriage" },
    { paragraph: "1638", topic: "Effects of marriage" },
  ],
};

/**
 * Look up Catechism references for a sacrament. Returns an empty
 * array when the sacrament key is unknown.
 */
export function catechismReferencesFor(
  sacramentKey: string,
): ReadonlyArray<{ paragraph: string; topic: string }> {
  return CATECHISM_REFERENCES_BY_SACRAMENT[sacramentKey] ?? [];
}

/**
 * Fill a sacrament package's `catechismReferences` field when the
 * builder did not. Returns the list of enrichment events for the
 * provenance trail.
 */
export function enrichSacramentCatechism(pkg: ContentPackage): {
  filled: boolean;
  references: ReadonlyArray<{ paragraph: string; topic: string }>;
} {
  if (pkg.contentType !== "Sacrament") return { filled: false, references: [] };
  const payload = pkg.payload as Record<string, unknown>;
  if (Array.isArray(payload.catechismReferences) && payload.catechismReferences.length > 0) {
    return { filled: false, references: [] };
  }
  const sacramentKey = String(payload.sacramentKey ?? "").trim();
  if (!sacramentKey) return { filled: false, references: [] };
  const refs = catechismReferencesFor(sacramentKey);
  if (refs.length === 0) return { filled: false, references: [] };
  payload.catechismReferences = refs;
  return { filled: true, references: refs };
}

/**
 * Common per-sacrament related-prayer hints. Used by the related-
 * prayer enricher to suggest relevant Prayer rows the sacrament
 * page can link to.
 */
export const RELATED_PRAYER_HINTS_BY_SACRAMENT: Readonly<Record<string, ReadonlyArray<string>>> = {
  baptism: ["the-creed", "renunciation-of-satan"],
  eucharist: ["anima-christi", "act-of-faith-eucharist"],
  confirmation: ["come-holy-spirit"],
  reconciliation: ["act-of-contrition"],
  anointing_of_the_sick: ["prayer-for-the-sick"],
  holy_orders: ["prayer-for-vocations"],
  matrimony: ["wedding-blessing"],
};
