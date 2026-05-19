import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedSaintsPaginated, type SaintCategory } from "@/lib/data/saints";
import { listPublishedApparitionsPaginated } from "@/lib/data/apparitions";
import { tagsForList, withCacheTags } from "@/lib/cache/cached-data";
import { SaintsGrid, ApparitionsGrid } from "./_components";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints & Our Lady" };

type Props = {
  searchParams: Promise<{ page?: string; apparitionsPage?: string; filter?: string }>;
};

const VALID_FILTERS: ReadonlyArray<SaintCategory> = ["saint", "our-lady", "angel"];

function parseFilter(raw: string | undefined): SaintCategory {
  return VALID_FILTERS.includes(raw as SaintCategory) ? (raw as SaintCategory) : "saint";
}

const FILTER_LABEL: Record<SaintCategory, string> = {
  saint: "Saints",
  "our-lady": "Our Lady",
  angel: "Angels",
};

export default async function SaintsPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const sp = await searchParams;
  const saintsPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const apparitionsPage = Math.max(1, parseInt(sp.apparitionsPage ?? "1", 10) || 1);
  const filter = parseFilter(sp.filter);

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
    // Spec §19: cached strict-public queries scoped by tab tags.
    const saintsTags = tagsForList({ contentType: "Saint", tab: "saints" });
    const apparitionsTags = tagsForList({
      contentType: "MarianApparition",
      tab: "apparitions",
    });
    const cachedSaints = await withCacheTags<
      Parameters<typeof listPublishedSaintsPaginated>,
      Awaited<ReturnType<typeof listPublishedSaintsPaginated>>
    >({
      keyParts: ["saints", "list", locale, String(saintsPage), filter],
      tags: saintsTags.tags,
      revalidateSeconds: saintsTags.revalidateSeconds,
      fn: listPublishedSaintsPaginated,
    });
    const cachedApparitions = await withCacheTags<
      Parameters<typeof listPublishedApparitionsPaginated>,
      Awaited<ReturnType<typeof listPublishedApparitionsPaginated>>
    >({
      keyParts: ["apparitions", "list", locale, String(apparitionsPage)],
      tags: apparitionsTags.tags,
      revalidateSeconds: apparitionsTags.revalidateSeconds,
      fn: listPublishedApparitionsPaginated,
    });
    [saintsResult, apparitionsResult] = await Promise.all([
      cachedSaints(locale, saintsPage, undefined, filter),
      cachedApparitions(locale, apparitionsPage),
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

      {/* Filter pills: Saints / Our Lady / Angels. Selecting one keeps
          the apparitions section visible underneath. The row wraps on
          narrow screens so the chips never overflow. */}
      <div className="mb-6 flex flex-wrap justify-center gap-2 px-2">
        {VALID_FILTERS.map((f) => {
          const active = f === filter;
          const href = f === "saint" ? "/saints" : `/saints?filter=${f}`;
          return (
            <Link
              key={f}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`vf-btn !py-1.5 !px-4 text-xs ${
                active ? "vf-btn-primary" : "vf-btn-ghost"
              }`}
            >
              {FILTER_LABEL[f]}
            </Link>
          );
        })}
      </div>

      <SaintsGrid
        saints={saintsResult.items}
        feastDayLabel={t("saints.feastDay")}
        patronagesLabel={t("saints.patronages")}
        emptyMessage={
          filter === "our-lady"
            ? "Our Lady entries will appear here as new titles are published."
            : filter === "angel"
              ? "Angel entries will appear here as new entries are published."
              : "Saints will appear here as new entries are published."
        }
      />
      <Pagination
        basePath="/saints"
        page={saintsResult.page}
        totalPages={saintsResult.totalPages}
        searchParams={{
          apparitionsPage: apparitionsPage > 1 ? String(apparitionsPage) : undefined,
          filter: filter === "saint" ? undefined : filter,
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
          filter: filter === "saint" ? undefined : filter,
        }}
      />
    </div>
  );
}
