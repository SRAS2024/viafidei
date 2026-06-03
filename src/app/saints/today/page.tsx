import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";
import { compareSaintsChronologically } from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
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
  const month = inRange(pm, 1, 12) ? pm : now.getMonth() + 1;
  const day = inRange(pd, 1, 31) ? pd : now.getDate();
  const todayMMDD = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const allSaints = await listPublished("SAINT");
  const todaySaints = allSaints
    .filter((s) => {
      if (typeof s.payload.feastDay === "string" && s.payload.feastDay === todayMMDD) return true;
      return Number(s.payload.feastMonth) === month && Number(s.payload.feastDayOfMonth) === day;
    })
    .sort(compareSaintsChronologically);

  return (
    <div>
      <PageHero eyebrow={t("saints.today.eyebrow")} title={t("saints.today.title")} />
      <TodayDateLabel serverMonth={month} serverDay={day} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {todaySaints.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            No published feast day saints for today.
          </div>
        ) : (
          todaySaints.map((saint) => (
            <Link key={saint.id} href={`/saints/${saint.slug}`}>
              <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-7">
                <p className="vf-eyebrow">Feast day</p>
                <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{saint.title}</h2>
                <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                  {(saint.payload.biography as string | undefined)?.slice(0, 280) ?? ""}
                </p>
              </article>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
