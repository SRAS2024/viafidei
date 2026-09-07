import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui";
import { searchPublishedPage } from "@/lib/data/published";
import { SearchInput, SearchResultGroup } from "./_components";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const PAGE_SIZE = 25;

function pageNumber(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

/**
 * The /search page renders the SAME grouped results the header dropdown shows,
 * but server-side for a `?q=` URL — so a search result is a real, shareable,
 * crawlable page rather than something that only exists after typing. Paging
 * is `?page=` links for the same reason.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { t } = await getTranslator();
  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim();
  const page = pageNumber(rawPage);

  // A failed search must not 500 the page — an empty result set with the box
  // still usable is the graceful degradation.
  const results = q
    ? await searchPublishedPage(q, { page, pageSize: PAGE_SIZE }).catch(() => null)
    : null;

  const pageHref = (n: number) => `/search?q=${encodeURIComponent(q)}&page=${n}`;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.search")}
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <SearchInput
        defaultValue={q}
        placeholder={t("search.placeholder")}
        ariaLabel={t("nav.search")}
        submitLabel={t("nav.search")}
      />

      <div className="mx-auto max-w-3xl px-4">
        {!q ? (
          <p className="text-center font-serif text-ink-faint">
            Search prayers, saints, guides, devotions, parishes and Church documents.
          </p>
        ) : results == null ? (
          <p className="text-center font-serif text-ink-faint">
            Search is unavailable right now. Please try again in a moment.
          </p>
        ) : results.total === 0 ? (
          <p className="text-center font-serif text-ink-faint">
            No results for &ldquo;{q}&rdquo;. Try a different spelling, or fewer words.
          </p>
        ) : (
          <>
            <p aria-live="polite" className="mb-8 text-center font-serif text-ink-faint">
              {results.total} {results.total === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;
              {results.pageCount > 1 ? ` · page ${results.page} of ${results.pageCount}` : ""}
            </p>

            <div className="space-y-10">
              {results.groups.map((group) => (
                <SearchResultGroup key={group.contentType} group={group} query={q} />
              ))}
            </div>

            {results.pageCount > 1 ? (
              <nav
                aria-label="Search result pages"
                className="mt-10 flex items-center justify-center gap-4"
              >
                {results.page > 1 ? (
                  <Link href={pageHref(results.page - 1)} className="vf-btn vf-btn-ghost">
                    ← Previous
                  </Link>
                ) : null}
                {results.page < results.pageCount ? (
                  <Link href={pageHref(results.page + 1)} className="vf-btn vf-btn-ghost">
                    Next →
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
