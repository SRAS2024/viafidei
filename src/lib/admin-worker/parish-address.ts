/**
 * Parish duplicate detection by ADDRESS.
 *
 * Two parishes at the same street address are the same place, however their
 * names are spelled ("St. Mary" vs "Saint Mary Catholic Church"), so the address
 * — not the name — is the duplicate key. `parishAddressKey` normalizes an
 * address + city (+ state) into a stable fingerprint: lower-cased, de-accented,
 * punctuation-stripped, with the common street-type / directional words folded
 * to a canonical short form so "123 Main Street, St. Louis" and "123 Main St,
 * Saint Louis" collapse to the same key. The key is stored on the published
 * parish's payload (`addressKey`) AND in the indexed `PublishedContent.addressKey`
 * column (written at publish time and by the hygiene sweep), so the duplicate
 * lookup is an index probe rather than a JSON scan of every parish row.
 */

import type { PrismaClient } from "@prisma/client";

/** Long-form → canonical short token for the words that vary between sources. */
const CANONICAL_TOKEN: Record<string, string> = {
  saint: "st",
  street: "st",
  avenue: "ave",
  av: "ave",
  road: "rd",
  boulevard: "blvd",
  drive: "dr",
  lane: "ln",
  court: "ct",
  place: "pl",
  square: "sq",
  highway: "hwy",
  parkway: "pkwy",
  suite: "ste",
  apartment: "apt",
  building: "bldg",
  floor: "fl",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

/**
 * Normalize an address into a duplicate-detection fingerprint. Returns "" when
 * there is nothing to key on (so callers can treat an empty key as "no dedup
 * possible" and never block on it).
 */
export function parishAddressKey(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const raw = [input.address, input.city, input.state]
    .map((s) => (typeof s === "string" ? s : ""))
    .join(" ");
  const cleaned = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map((tok) => CANONICAL_TOKEN[tok] ?? tok)
    .join(" ");
}

/**
 * Find an already-published parish that shares this address fingerprint (i.e. a
 * duplicate). Optionally exclude one slug so a row never matches itself during a
 * refresh. Returns null when the key is empty or nothing matches. Fail-open.
 */
export async function findPublishedParishByAddressKey(
  prisma: PrismaClient,
  addressKey: string,
  opts: { excludeSlug?: string } = {},
): Promise<{ id: string; slug: string; title: string } | null> {
  if (!addressKey) return null;
  // The indexed column, not the JSON path: at 100k+ parishes a JSON-path
  // filter is a sequential scan per candidate (the old lane issued hundreds
  // per run), while this is one index probe.
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        addressKey,
        ...(opts.excludeSlug ? { slug: { not: opts.excludeSlug } } : {}),
      },
      select: { id: true, slug: true, title: true },
    })
    .catch(() => null);
  return row;
}
