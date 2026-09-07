import {
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novenas" };

export default async function NovenasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  // Novena cards show the novena's summary from the payload, so the type is
  // read whole and paged here rather than through the projection.
  const items = await listPublished("NOVENA");
  const page = pageSlice(items, parsePageParam(pageParam), LIST_PAGE_SIZE);
  return (
    <div>
      <PageHero
        eyebrow="Nine days of prayer"
        title="Novenas"
        subtitle="Nine-day novenas — each day opens in its own dropdown with the full prayer."
      />
      <PublishedList items={page.items} baseHref="/novenas" eyebrowField="intentionTheme" />
      <Pagination basePath="/novenas" page={page.page} totalPages={page.pageCount} />
    </div>
  );
}
