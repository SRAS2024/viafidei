import { PublishedList, entryPayload } from "@/components/ui/PublishedList";
import { saintSubtypeLabel } from "@/lib/content-shared/saint-categories";
import { saintCardDetailLines, saintCardDetails } from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";
import { listSaintsForFeast } from "@/lib/data/published";
import { TodayDateLabel } from "./TodayDateLabel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's Feast Day Saints" };

type Props = { searchParams: Promise<{ month?: string; day?: string }> };

const inRange = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

export default async function SaintsTodayPage({ searchParams }: Props) {
  const { t } = await getTranslator();
  const { month: qMonth, day: qDay } = await searchParams;
  const now = new Date();
  // Honor the visitor's local month/day passed from the homepage block; fall
  // back to the server date only when they're absent or invalid.
  const pm = Number(qMonth);
  const pd = Number(qDay);
  const dateFromUrl = inRange(pm, 1, 12) && inRange(pd, 1, 31);
  const month = inRange(pm, 1, 12) ? pm : now.getMonth() + 1;
  const day = inRange(pd, 1, 31) ? pd : now.getDate();
  // The indexed feast lookup (memoised ten minutes per calendar day), the same
  // one the homepage's Today block reads through /api/saints/today — so both
  // cycle on the day's date instead of scanning every saint's payload.
  const todaySaints = await listSaintsForFeast(month, day);

  return (
    <div>
      {/* The page's opening, with the date as its sentence: the same shape as
          PageHero, whose subtitle cannot hold the date's client component. */}
      <section className="vf-page-hero">
        <p className="vf-eyebrow">{t("saints.today.eyebrow")}</p>
        <h1 className="vf-page-hero-title text-ink">{t("saints.today.title")}</h1>
        <TodayDateLabel serverMonth={month} serverDay={day} dateFromUrl={dateFromUrl} />
      </section>
      {/* The same card as /saints: the name, then the patronage, then the feast
          day — not a clipped biography under a "Feast day" eyebrow. These
          rows carry their payload, so the summary is switched off explicitly:
          /saints shows none because its projected rows have none. A day's few
          saints stand centred under the heading rather than off to one side. */}
      <div className="vf-grid-centred">
        <PublishedList
          items={todaySaints}
          baseHref="/saints"
          showSummary={false}
          emptyMessage="No published feast day saints for today."
          eyebrowFor={(item) =>
            saintSubtypeLabel(entryPayload(item).saintType as string | undefined)
          }
          detailLinesFor={(item) => saintCardDetailLines(saintCardDetails(entryPayload(item)), t)}
        />
      </div>
    </div>
  );
}
