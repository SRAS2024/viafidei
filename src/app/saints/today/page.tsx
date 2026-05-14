import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { listSaintsForFeastDate } from "@/lib/data/saints";
import { getTranslator } from "@/lib/i18n/server";
import { logPageError } from "@/lib/observability/page-errors";
import { TodayDateLabel } from "./TodayDateLabel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's Feast Day Saints" };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = { searchParams: { month?: string; day?: string } };

function parseDate(searchParams: Props["searchParams"]) {
  const now = new Date();
  const monthRaw = Number(searchParams.month ?? "");
  const dayRaw = Number(searchParams.day ?? "");
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.getUTCMonth() + 1;
  const day =
    Number.isInteger(dayRaw) && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : now.getUTCDate();
  return { month, day };
}

export default async function TodayFeastDayPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const { month, day } = parseDate(searchParams);

  let saints: Awaited<ReturnType<typeof listSaintsForFeastDate>> = [];
  try {
    saints = await listSaintsForFeastDate(locale, month, day);
  } catch (err) {
    logPageError({ route: "/saints/today", entityType: "Saint", error: err });
  }

  const monthName = MONTH_NAMES[month - 1] ?? "—";

  return (
    <div>
      <div className="mb-4">
        <Link href="/saints" className="vf-nav-link">
          ← {t("nav.saints")}
        </Link>
      </div>
      <PageHero
        eyebrow="Today's feast"
        title="Today's Feast Day Saints"
        subtitle={`Saints whose feast falls on ${monthName} ${day}, ordered with the most widely venerated first.`}
      />
      <TodayDateLabel serverMonth={month} serverDay={day} />

      {saints.length === 0 ? (
        <p className="mx-auto max-w-reading text-center font-serif text-ink-faint">
          No saints in our catalog have a feast on this date yet. Browse the full{" "}
          <Link href="/saints" className="vf-nav-link">
            Saints catalog
          </Link>{" "}
          to discover others.
        </p>
      ) : (
        <ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {saints.map((s) => {
            const tr = s.translations[0];
            const name = tr?.name ?? s.canonicalName;
            const biography = tr?.biography ?? s.biography;
            return (
              <li key={s.id}>
                <Link
                  href={`/saints/${s.slug}`}
                  className="vf-card block rounded-sm p-5 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-6"
                >
                  <h2 className="break-words font-display text-xl sm:text-2xl">{name}</h2>
                  {s.feastDay ? (
                    <p className="vf-eyebrow mt-1 truncate">{s.feastDay}</p>
                  ) : null}
                  <p className="mt-3 line-clamp-3 font-serif leading-relaxed text-ink-soft">
                    {biography}
                  </p>
                  {s.patronages.length > 0 ? (
                    <p className="mt-3 break-words font-serif text-xs text-ink-faint">
                      <span className="font-medium text-ink-soft">Patron of:</span>{" "}
                      {s.patronages.join(", ")}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
