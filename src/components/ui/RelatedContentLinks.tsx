import Link from "next/link";
import type { ChecklistContentType } from "@prisma/client";

import { publicRouteFor } from "@/lib/admin-worker/public-routes";
import { contentTypeLabel, getPublishedBySlug } from "@/lib/data/published";

/**
 * "See also" links between published content.
 *
 * Payloads store cross-references as slugs (`relatedPrayers: ["our-father"]`),
 * and a slug is not content: rendered raw it printed "apostles-creed,
 * our-father" under a heading. `resolveRelatedLinks` looks each slug up and
 * keeps only the ones that are actually published, so a link on the page
 * always leads somewhere — an unresolvable reference silently disappears
 * rather than becoming a dead link or a naked slug.
 */
export interface RelatedLink {
  slug: string;
  title: string;
  subtitle: string;
  typeLabel: string;
  href: string;
}

/**
 * Resolve reference slugs to published titles + hrefs, in the order given.
 * Unpublished or unknown slugs are dropped. Never throws: a failed lookup
 * costs a link, not the page.
 */
export async function resolveRelatedLinks(
  contentType: ChecklistContentType,
  slugs: unknown,
): Promise<RelatedLink[]> {
  const list = Array.isArray(slugs)
    ? slugs.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  if (list.length === 0) return [];
  const resolved = await Promise.all(
    list.map((slug) => getPublishedBySlug(contentType, slug).catch(() => null)),
  );
  return resolved
    .map((item) =>
      item
        ? {
            slug: item.slug,
            title: item.title,
            subtitle: item.subtitle ?? "",
            typeLabel: contentTypeLabel(
              item.contentType,
              typeof item.payload.prayerType === "string" ? item.payload.prayerType : null,
            ),
            href: publicRouteFor(item.contentType, item.slug).slugPath,
          }
        : null,
    )
    .filter((l): l is RelatedLink => l != null);
}

/** A titled row of related-content links. Renders nothing when empty. */
export function RelatedContentLinks({ title, links }: { title: string; links: RelatedLink[] }) {
  if (links.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={`${link.typeLabel}:${link.slug}`}>
            <Link
              href={link.href}
              className="inline-flex items-baseline gap-2 rounded-full border border-ink/15 px-3 py-1 font-serif text-sm text-ink transition hover:border-ink/40"
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
