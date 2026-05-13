import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import {
  loadTimeline,
  loadCouncilBuckets,
  PERIOD_LABELS,
  type CouncilBucket,
} from "@/lib/data/church-history";
import { logPageError } from "@/lib/observability/page-errors";
import { HistoryTimelineClient, type HistoryEvent } from "./HistoryTimelineClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History",
  description:
    "Two thousand years of Catholic Church history — slidable from Christ's ministry to today, filterable by Beginnings, Councils, Schisms, Doctrine, and Modern Era.",
};

const MIN_YEAR = 27; // Christ's public ministry
const MAX_YEAR = new Date().getUTCFullYear();

export default async function HistoryPage() {
  const { t, locale } = await getTranslator();
  let rawEvents: Awaited<ReturnType<typeof loadTimeline>> = [];
  let councilBuckets: CouncilBucket[] = [];
  try {
    [rawEvents, councilBuckets] = await Promise.all([
      loadTimeline(locale),
      loadCouncilBuckets(locale),
    ]);
  } catch (err) {
    logPageError({ route: "/history", entityType: "LiturgyEntry", error: err });
  }

  const events: HistoryEvent[] = rawEvents
    .map((e) => ({
      slug: e.slug,
      title: e.title,
      date: e.date,
      sortYear: e.sortYear,
      period: e.period,
      periodLabel: PERIOD_LABELS[e.period] ?? e.period,
      location: e.location,
      context: e.context,
      issues: e.issues,
      significance: e.significance,
      body: e.body,
    }))
    .sort((a, b) => a.sortYear - b.sortYear);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.history")}
        title="Church History"
        subtitle="Two thousand years of the Catholic Church — slide through the years from Christ's ministry to today, filter by Beginnings, Councils, Schisms, Doctrine, or the Modern Era, and expand any event to read the full account."
      />

      <HistoryTimelineClient events={events} minYear={MIN_YEAR} maxYear={MAX_YEAR} />

      {councilBuckets.length > 0 ? (
        <section className="mt-14" id="council-documents">
          <h2 className="mb-3 font-display text-3xl">Council documents</h2>
          <p className="mb-4 font-serif text-sm text-ink-soft">
            The texts of the ecumenical councils, grouped by council. Click a council to expand
            its documents.
          </p>
          <div className="flex flex-col gap-3">
            {councilBuckets.map((bucket) => (
              <details
                key={bucket.key}
                className="vf-card rounded-sm p-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-baseline justify-between gap-3 font-serif text-ink hover:text-ink-soft">
                  <span>
                    <span className="font-display text-xl">{bucket.label}</span>
                    <span className="ml-3 text-sm text-ink-faint">{bucket.year}</span>
                  </span>
                  <span className="text-xs text-ink-faint">
                    {bucket.documents.length} document
                    {bucket.documents.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <ol className="mt-4 flex flex-col gap-3">
                  {bucket.documents.map((d) => (
                    <li key={d.slug} className="border-t border-ink/5 pt-3">
                      <Link
                        href={`/liturgy-history/${d.slug}`}
                        className="font-display text-lg hover:underline"
                      >
                        {d.title}
                      </Link>
                      {d.body ? (
                        <p className="mt-1 line-clamp-2 font-serif text-sm text-ink-soft">
                          {d.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
