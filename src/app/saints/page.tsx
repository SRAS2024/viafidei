import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedSaintsPaginated } from "@/lib/data/saints";
import { listPublishedApparitionsPaginated } from "@/lib/data/apparitions";
import { SaintsGrid, ApparitionsGrid } from "./_components";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints & Our Lady" };

type Props = {
  searchParams: { page?: string; apparitionsPage?: string };
};

export default async function SaintsPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const saintsPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const apparitionsPage = Math.max(
    1,
    parseInt(searchParams.apparitionsPage ?? "1", 10) || 1,
  );

  let saintsResult: Awaited<ReturnType<typeof listPublishedSaintsPaginated>> = {
    items: [],
    total: 0,
    page: saintsPage,
    pageSize: 0,
    totalPages: 0,
  };
  let apparitionsResult: Awaited<ReturnType<typeof listPublishedApparitionsPaginated>> = {
    items: [],
    total: 0,
    page: apparitionsPage,
    pageSize: 0,
    totalPages: 0,
  };

  try {
    [saintsResult, apparitionsResult] = await Promise.all([
      listPublishedSaintsPaginated(locale, saintsPage),
      listPublishedApparitionsPaginated(locale, apparitionsPage),
    ]);
  } catch (err) {
    logPageError({ route: "/saints", entityType: "Saint", error: err });
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <SaintsGrid
        saints={saintsResult.items}
        feastDayLabel={t("saints.feastDay")}
        emptyMessage="Saints will appear here as new entries are published."
      />
      <Pagination
        basePath="/saints"
        page={saintsResult.page}
        totalPages={saintsResult.totalPages}
        searchParams={{
          apparitionsPage:
            apparitionsPage > 1 ? String(apparitionsPage) : undefined,
        }}
      />
      <ApparitionsGrid
        apparitions={apparitionsResult.items}
        heading="Approved Marian apparitions"
        emptyMessage="Approved apparition entries will appear here."
      />
      <Pagination
        basePath="/saints"
        page={apparitionsResult.page}
        totalPages={apparitionsResult.totalPages}
        pageParam="apparitionsPage"
        searchParams={{
          page: saintsPage > 1 ? String(saintsPage) : undefined,
        }}
      />
    </div>
  );
}
