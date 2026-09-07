import Link from "next/link";

import {
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devotions" };

export default async function DevotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t } = await getTranslator();
  const { page: pageParam } = await searchParams;
  // Devotion cards show the devotion's summary from the payload, so the type
  // is read whole and paged here rather than through the projection.
  const items = await listPublished("DEVOTION");
  const page = pageSlice(items, parsePageParam(pageParam), LIST_PAGE_SIZE);
  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />
      <p className="mb-8 text-center font-serif text-sm text-ink-soft">
        Looking for a nine-day novena?{" "}
        <Link href="/novenas" className="vf-nav-link">
          Browse novenas →
        </Link>
      </p>
      {/* The eyebrow is the humanised devotion type — never the stored value. */}
      <PublishedList items={page.items} baseHref="/devotions" eyebrowField="devotionType" />
      <Pagination basePath="/devotions" page={page.page} totalPages={page.pageCount} />
    </div>
  );
}
