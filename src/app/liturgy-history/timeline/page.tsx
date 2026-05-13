import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { ExpandableTimelineEvent } from "@/components/ui";
import {
  loadTimeline,
  loadCouncilBuckets,
  groupByPeriod,
  PERIOD_ORDER,
  PERIOD_LABELS,
  type CouncilBucket,
} from "@/lib/data/church-history";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History Timeline",
  description:
    "A complete chronological timeline of Catholic Church history — from Christ's ministry through 2025, with every major council and era.",
};

export default async function ChurchHistoryTimelinePage() {
  const { t, locale } = await getTranslator();
  let events: Awaited<ReturnType<typeof loadTimeline>> = [];
  let councilBuckets: CouncilBucket[] = [];
  try {
    [events, councilBuckets] = await Promise.all([
      loadTimeline(locale),
      loadCouncilBuckets(locale),
    ]);
  } catch (err) {
    logPageError({ route: "/liturgy-history/timeline", entityType: "LiturgyEntry", error: err });
  }
  const grouped = groupByPeriod(events);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgyHistory")}
        title="Church History Timeline"
        subtitle="Two thousand years of the Catholic Church, organised chronologically — every major period, council, and turning point. Tap any entry to read the full account."
      />

      <div className="mb-6">
        <Link href="/liturgy-history" className="vf-nav-link">
          ← {t("nav.liturgyHistory")}
        </Link>
      </div>

      <nav aria-label="Timeline periods" className="mb-10 vf-card rounded-sm p-5 sm:p-6">
        <p className="vf-eyebrow mb-3">Periods</p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PERIOD_ORDER.map((period) => {
            const count = grouped.get(period)?.length ?? 0;
            if (count === 0) return null;
            return (
              <li key={period}>
                <a
                  href={`#period-${period}`}
                  className="block font-serif text-sm text-ink-soft hover:text-ink"
                >
                  <span>{PERIOD_LABELS[period]}</span>
                  <span className="ml-2 text-ink-faint">({count})</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {councilBuckets.length > 0 ? (
        <section className="mb-10" id="council-documents">
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

      <div className="flex flex-col gap-10">
        {PERIOD_ORDER.map((period) => {
          const items = grouped.get(period) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={period} id={`period-${period}`} className="scroll-mt-24">
              <h2 className="mb-4 font-display text-3xl">{PERIOD_LABELS[period]}</h2>
              <div className="vf-card rounded-sm p-2 sm:p-4">
                {items.map((event) => (
                  <ExpandableTimelineEvent
                    key={event.slug}
                    title={event.title}
                    date={event.date}
                    location={event.location}
                    context={event.context}
                    issues={event.issues}
                    significance={event.significance}
                    body={event.body}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

    </div>
  );
}
