import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import { TodayDateLabel } from "./TodayDateLabel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's Feast Day Saints" };

export default async function SaintsTodayPage() {
  const { t } = await getTranslator();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayMMDD = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const allSaints = await listPublished("SAINT");
  const todaySaints = allSaints.filter((s) => s.payload.feastDay === todayMMDD);

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
