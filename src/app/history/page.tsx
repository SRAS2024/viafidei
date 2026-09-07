import { PageHero } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { loadHistoryTimeline } from "@/lib/data/history-timeline";

import { HistoryTimelineClient } from "./HistoryTimelineClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History",
  description:
    "A timeline of the Catholic Church from Pentecost to today — councils, saints and martyrs, schisms and reform, the Magisterium, and Our Lady.",
};

export default async function HistoryPage() {
  const { t } = await getTranslator();
  // Server-rendered from the cached, body-free timeline (static dataset
  // merged with published documents) — nothing but the list props reaches
  // the client.
  const timeline = await loadHistoryTimeline();
  const { events, eras, minYear, maxYear } = timeline;
  // The opening label comes from the first event itself ("c. 33"), so the
  // subtitle never asserts a precision the dataset does not claim.
  const firstLabel = events[0]?.dateLabel;
  const subtitle = `${events.length} events from ${firstLabel ?? "the early Church"} to today — councils, saints and martyrs, schisms and reform, and the Magisterium. Scroll the timeline from Pentecost forward.`;
  return (
    <div>
      <PageHero eyebrow={t("nav.history")} title="Church History" subtitle={subtitle} />
      <div className="mx-auto max-w-3xl px-4 pb-12">
        <HistoryTimelineClient events={events} eras={eras} minYear={minYear} maxYear={maxYear} />
      </div>
    </div>
  );
}
