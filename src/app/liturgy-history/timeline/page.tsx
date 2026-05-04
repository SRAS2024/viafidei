import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { ExpandableTimelineEvent } from "@/components/ui";
import {
  loadTimeline,
  groupByPeriod,
  PERIOD_ORDER,
  PERIOD_LABELS,
} from "@/lib/data/church-history";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History Timeline",
  description:
    "A complete chronological timeline of Catholic Church history — from Christ's ministry through 2025, with every major council and era.",
};

export default async function ChurchHistoryTimelinePage() {
  const { t, locale } = await getTranslator();
  const events = await loadTimeline(locale);
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

      <p className="mt-10 text-center font-serif text-xs text-ink-faint">
        Timeline content is curated through the dynamic content injection system from approved
        Catholic sources (Holy See, conferences of bishops, pontifical institutes). See{" "}
        <Link href="/admin/sources" className="underline">
          approved sources
        </Link>{" "}
        for the current allowlist.
      </p>
    </div>
  );
}
