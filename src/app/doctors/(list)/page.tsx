import type { Metadata } from "next";
import { cache } from "react";

import {
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  PublishedList,
  entryPayload,
} from "@/components/ui";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * The name the Church knows a Doctor by ("Angelic Doctor"), for the card's line. Some
 * records say only "Doctor of the Church", which the page's own title has already said.
 */
function doctorEpithet(payload: Record<string, unknown>): string | undefined {
  const epithet = typeof payload.doctorTitle === "string" ? payload.doctorTitle.trim() : "";
  return epithet && !/^doctor of the church$/i.test(epithet) ? epithet : undefined;
}

// A closed list (37 Doctors), and each card shows the Doctor's epithet from
// the payload, so the type is read whole. It runs only just past one page of
// cards, so it stays on one: a second page would hold two Doctors and nothing
// else. A search reads the name and the epithet ("Angelic Doctor") first. One read
// per request: the tab's title and the page both need the answer.
const loadDoctors = cache(async (query: string) => {
  const doctors = await listPublished("DOCTOR");
  const visible = query ? rankBySearch(doctors, query, (d) => publishedSearchFields(d)) : doctors;
  return { doctors, visible };
});

type SearchParams = Promise<{ q?: string | string[] }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const query = parseSearchQuery((await searchParams).q);
  return {
    title: await listPageTitleFor(
      { name: t("nav.doctors"), query, t, locale },
      false,
      async () => ({
        total: (await loadDoctors(query)).visible.length,
      }),
    ),
  };
}

export default async function DoctorsPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const { doctors, visible } = await loadDoctors(query);

  return (
    <div>
      <PageHero
        eyebrow="The Church's great teachers"
        title="Doctors of the Church"
        subtitle="A Doctor of the Church is a saint recognized by the Church for an eminent contribution to theology or doctrine through their writing, teaching, and holiness."
      />

      <ListControls>
        <ListSearch
          action="/doctors"
          query={query}
          label={t("listSearch.doctors")}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
      </ListControls>

      {doctors.length === 0 ? (
        <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
          The Doctors of the Church will appear here as records are approved and published through
          the checklist-first worker.
        </div>
      ) : query && visible.length === 0 ? (
        <ListSearchNoResults action="/doctors" query={query} t={t} />
      ) : (
        // The Doctor's name leads; the epithet is a line beneath it.
        <PublishedList
          items={visible}
          baseHref="/doctors"
          showSummary={false}
          eyebrowFor={(item) => doctorEpithet(entryPayload(item))}
        />
      )}
    </div>
  );
}
