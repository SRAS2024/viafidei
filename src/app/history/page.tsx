import { PageHero } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

import { HistoryTimelineClient } from "./HistoryTimelineClient";
import { historyYearBounds, toHistoryEvents } from "./historyEvents";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History",
  description: "A timeline of the Catholic Church through her councils and magisterial documents.",
};

export default async function HistoryPage() {
  const { t } = await getTranslator();
  const documents = await listPublished("CHURCH_DOCUMENT");
  const events = toHistoryEvents(documents);
  const { minYear, maxYear } = historyYearBounds(events);
  return (
    <div>
      <PageHero
        eyebrow={t("nav.history")}
        title="Church History"
        subtitle="The Church's story told through her councils and magisterial documents — scroll the timeline from the early Church to today."
      />
      <div className="mx-auto max-w-3xl px-4 pb-12">
        <HistoryTimelineClient events={events} minYear={minYear} maxYear={maxYear} />
      </div>
    </div>
  );
}
