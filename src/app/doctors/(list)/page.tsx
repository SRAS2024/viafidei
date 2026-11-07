import {
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  PublishedList,
  entryPayload,
} from "@/components/ui";
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Doctors of the Church" };

/** The name the Church knows a Doctor by ("Angelic Doctor"), for the card's line. */
function doctorEpithet(payload: Record<string, unknown>): string | undefined {
  return typeof payload.doctorTitle === "string" ? payload.doctorTitle : undefined;
}

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // A closed list (37 Doctors), and each card shows the Doctor's epithet from
  // the payload, so the type is read whole. It runs only just past one page of
  // cards, so it stays on one: a second page would hold two Doctors and nothing
  // else. A search reads the name and the epithet ("Angelic Doctor") first.
  const doctors = await listPublished("DOCTOR");
  const visible = query ? rankBySearch(doctors, query, (d) => publishedSearchFields(d)) : doctors;

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
