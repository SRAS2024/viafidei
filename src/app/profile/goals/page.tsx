import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listGoalsForUser } from "@/lib/data/profile";
import { PageHero } from "@/components/ui/PageHero";

export default async function GoalsPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/goals");
  const { t } = await getTranslator();
  const now = new Date();
  const goals = await listGoalsForUser(user.id);
  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.goals")} />
      <div className="grid gap-4">
        {goals.length === 0 ? (
          <p className="text-center font-serif text-ink-faint">No goals yet.</p>
        ) : (
          goals.map((g) => {
            const overdue = g.dueDate && g.dueDate < now && g.status !== "COMPLETED";
            return (
              <article key={g.id} className="vf-card rounded-sm p-6">
                <p className="vf-eyebrow">{overdue ? "Overdue" : g.status}</p>
                <h2 className="mt-3 font-display text-2xl">{g.title}</h2>
                {g.description ? (
                  <p className="mt-3 font-serif text-ink-soft">{g.description}</p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
