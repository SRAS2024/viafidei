/**
 * Which public-domain work a published item's prose was quoted from, if any.
 *
 * The structured saint ingest quotes a biography verbatim from the Catholic
 * Encyclopedia (1913, as transcribed on Wikisource) or from the Roman
 * Martyrology (1916 English edition, as scanned by the Internet Archive) when
 * Wikipedia has no English lead to quote. Neither text needs a licence, but
 * the page still says where the words come from — in the same single small
 * line it uses to credit Wikipedia (`wikipedia-attribution.ts`).
 *
 * Only `payload.provenance` decides: `{ biography: "<source id>",
 * biographyUrl: <page>, biographyTitle: <article> }`, written by the ingest.
 * Pure: no I/O, no React. Returns null rather than guess.
 */

export type PublicDomainSourceId = "catholic-encyclopedia-1913" | "roman-martyrology-1916";

export interface PublicDomainTextSource {
  source: PublicDomainSourceId;
  /** The page the text was taken from (Wikisource article / archive.org book). */
  url: string;
  /** The work, as the credit line names it. */
  work: string;
  /** The Encyclopedia article's title ("St. Ita"); absent for the Martyrology. */
  title?: string;
}

/** How each work is named in the credit line. */
const WORKS: Readonly<Record<PublicDomainSourceId, string>> = {
  "catholic-encyclopedia-1913": "the Catholic Encyclopedia (1913)",
  "roman-martyrology-1916": "the Roman Martyrology (1916)",
};

/** Hosts the ingest takes these texts from; any other URL is not credited. */
const HOSTS: Readonly<Record<PublicDomainSourceId, RegExp>> = {
  "catholic-encyclopedia-1913":
    /^https:\/\/en\.wikisource\.org\/wiki\/Catholic_Encyclopedia_\(1913\)\//,
  "roman-martyrology-1916": /^https:\/\/archive\.org\/details\//,
};

/** Fields the ingest may fill from a public-domain text. */
const QUOTED_FIELDS = ["biography"] as const;

function isSource(value: unknown): value is PublicDomainSourceId {
  return value === "catholic-encyclopedia-1913" || value === "roman-martyrology-1916";
}

/**
 * The public-domain work this item's displayed prose came from, or null when
 * none of it did.
 */
export function publicDomainTextSource(
  payload: Record<string, unknown>,
): PublicDomainTextSource | null {
  const p = payload.provenance;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const provenance = p as Record<string, unknown>;
  for (const field of QUOTED_FIELDS) {
    const source = provenance[field];
    const text = payload[field];
    if (!isSource(source) || typeof text !== "string" || !text.trim()) continue;
    const url = provenance[`${field}Url`];
    if (typeof url !== "string" || !HOSTS[source].test(url)) continue;
    const title = provenance[`${field}Title`];
    return {
      source,
      url,
      work: WORKS[source],
      ...(source === "catholic-encyclopedia-1913" && typeof title === "string" && title.trim()
        ? { title: title.trim() }
        : {}),
    };
  }
  return null;
}
