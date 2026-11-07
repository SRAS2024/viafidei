import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listCompletedGoalsForUser } from "@/lib/data/profile";
import { ProfileBackLink } from "@/components/profile/ProfileBackLink";
import { PageHero } from "@/components/ui/PageHero";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.completedGoals") };
}

function formatDate(d: Date | null | undefined, locale: string): string {
  if (!d) return "—";
  return d.toLocaleDateString(locale, {
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
  const { t, locale } = await getTranslator();

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
    <div className="vf-column">
      <ProfileBackLink label={t("profile.tab.goals")} href="/profile/goals" />
      <PageHero
        eyebrow={t("profile.title")}
        title={t("profile.tab.completedGoals")}
        subtitle="Your completed spiritual goals — a record of what God's grace has worked through your prayer, practice, and resolve. Each entry keeps the original checklist and the journal you wrote as you walked it."
      />

      {goals.length === 0 ? (
        <p className="vf-section-lede text-center">
          You have not completed any goals yet. Goals you finish on{" "}
          <Link href="/profile/goals" className="vf-link">
            My Goals
          </Link>{" "}
          will appear here.
        </p>
      ) : (
        <div className="vf-panel-list">
          {goals.map((g) => {
            const checklistDone = g.checklist.filter((c) => c.isCompleted).length;
            return (
              <article key={g.id} className="vf-panel">
                <h2 className="vf-entry-title">{g.title}</h2>
                <p className="vf-entry-meta">Completed {formatDate(g.completedAt, locale)}</p>
                {g.description ? <p className="vf-panel-text">{g.description}</p> : null}

                {g.checklist.length > 0 ? (
                  <>
                    <p className="vf-eyebrow mt-4">
                      Checklist · {checklistDone}/{g.checklist.length}
                    </p>
                    {/* A record, not a form: each box says whether the step was
                        done, to a screen reader as well as to the eye, and cannot
                        be changed. */}
                    <ul className="vf-checklist mt-1.5">
                      {g.checklist.map((c) => (
                        <li key={c.id}>
                          <label className="vf-check">
                            <input type="checkbox" checked={c.isCompleted} disabled readOnly />
                            <span className="min-w-0">{c.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {g.journalEntries.length > 0 ? (
                  <div className="vf-panel-inset">
                    <p className="vf-eyebrow">
                      Journal · {g.journalEntries.length}{" "}
                      {g.journalEntries.length === 1 ? "entry" : "entries"}
                    </p>
                    <ul className="vf-rows mt-1">
                      {g.journalEntries.map((j) => (
                        <li key={j.id} className="py-3 last:pb-0">
                          <h3 className="vf-row-title">{j.title}</h3>
                          <p className="vf-entry-meta">{formatDate(j.createdAt, locale)}</p>
                          <p className="vf-panel-text whitespace-pre-wrap">{j.body}</p>
                        </li>
                      ))}
                    </ul>
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
