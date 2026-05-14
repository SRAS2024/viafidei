import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listCompletedGoalsForUser } from "@/lib/data/profile";
import { PageHero } from "@/components/ui/PageHero";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Completed Goals" };

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CompletedGoalsPage() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({
      route: "/profile/goals/completed",
      entityType: "User",
      error: err,
    });
  }
  if (!user) redirect("/login?next=/profile/goals/completed");
  const { t } = await getTranslator();

  let goals: Awaited<ReturnType<typeof listCompletedGoalsForUser>> = [];
  try {
    goals = await listCompletedGoalsForUser(user.id);
  } catch (err) {
    logPageError({
      route: "/profile/goals/completed",
      entityType: "Goal",
      error: err,
    });
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero
        eyebrow={t("profile.title")}
        title={t("profile.tab.completedGoals")}
        subtitle="Your completed spiritual goals — a record of what God's grace has worked through your prayer, practice, and resolve. Each entry keeps the original checklist and the journal you wrote as you walked it."
      />

      {goals.length === 0 ? (
        <p className="text-center font-serif text-ink-faint">
          You have not completed any goals yet. Goals you finish on{" "}
          <Link href="/profile/goals" className="vf-nav-link">
            My Goals
          </Link>{" "}
          will appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((g) => {
            const checklistDone = g.checklist.filter((c) => c.isCompleted).length;
            return (
              <article
                key={g.id}
                className="vf-card rounded-sm p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="break-words font-display text-xl sm:text-2xl">{g.title}</h2>
                  <p className="vf-eyebrow text-emerald-700">
                    Completed {formatDate(g.completedAt)}
                  </p>
                </div>
                {g.description ? (
                  <p className="mt-2 font-serif text-sm leading-relaxed text-ink-soft">
                    {g.description}
                  </p>
                ) : null}

                {g.checklist.length > 0 ? (
                  <div className="mt-4">
                    <p className="vf-eyebrow text-ink-faint">
                      Checklist · {checklistDone}/{g.checklist.length}
                    </p>
                    <ul className="mt-2 divide-y divide-ink/5">
                      {g.checklist.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start gap-3 py-2 font-serif text-sm"
                        >
                          <span
                            className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-sm border ${
                              c.isCompleted
                                ? "border-liturgical-gold bg-liturgical-gold/30"
                                : "border-ink/20"
                            }`}
                            aria-hidden
                          />
                          <span
                            className={
                              c.isCompleted
                                ? "text-ink-faint line-through"
                                : "text-ink-soft"
                            }
                          >
                            {c.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {g.journalEntries.length > 0 ? (
                  <div className="mt-5">
                    <p className="vf-eyebrow text-ink-faint">
                      Journal · {g.journalEntries.length}{" "}
                      {g.journalEntries.length === 1 ? "entry" : "entries"}
                    </p>
                    <div className="mt-2 flex flex-col gap-3">
                      {g.journalEntries.map((j) => (
                        <div
                          key={j.id}
                          className="rounded-sm border border-ink/10 bg-parchment/40 p-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-display text-base sm:text-lg">{j.title}</h3>
                            <p className="vf-eyebrow text-ink-faint">
                              {formatDate(j.createdAt)}
                            </p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-ink-soft">
                            {j.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
