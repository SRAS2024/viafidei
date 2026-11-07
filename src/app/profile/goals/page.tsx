import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { countCompletedGoalsForUser, listGoalsForUser } from "@/lib/data/profile";
import { ProfileBackLink } from "@/components/profile/ProfileBackLink";
import { PageHero } from "@/components/ui/PageHero";
import { GoalManager } from "./GoalManager";
import { logPageError } from "@/lib/observability/page-errors";

// Reads the auth session (cookies), so it can never be statically prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.goals") };
}

export default async function GoalsPage() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/goals", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/goals");
  const { t, locale } = await getTranslator();
  let goals: Awaited<ReturnType<typeof listGoalsForUser>> = [];
  let completedCount = 0;
  try {
    [goals, completedCount] = await Promise.all([
      listGoalsForUser(user.id),
      countCompletedGoalsForUser(user.id),
    ]);
  } catch (err) {
    logPageError({ route: "/profile/goals", entityType: "Goal", error: err });
  }

  const serialized = goals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    status: g.status as string,
    dueDate: g.dueDate ? g.dueDate.toISOString() : null,
    checklist: g.checklist.map((c) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sortOrder,
      isCompleted: c.isCompleted,
    })),
  }));

  return (
    <div className="vf-column">
      <ProfileBackLink label={t("common.back")} />
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.goals")} />
      <GoalManager
        initialGoals={serialized}
        completedCount={completedCount}
        locale={locale}
        labels={{
          newGoal: t("profile.goals.new"),
          title: t("profile.goals.title"),
          description: t("profile.goals.description"),
          dueDate: t("profile.goals.dueDate"),
          save: t("common.save"),
          startGoal: t("profile.goals.startGoal"),
          alreadyCompleted: t("profile.goals.alreadyCompleted"),
          cancel: t("common.cancel"),
          edit: t("profile.goals.edit"),
          complete: t("profile.goals.complete"),
          archive: t("profile.goals.archive"),
          delete: t("profile.goals.delete"),
          addChecklist: t("profile.goals.addChecklist"),
          deleteTitle: t("profile.goals.deleteTitle"),
          deleteBody: t("profile.goals.deleteBody"),
          checklist: t("profile.goals.checklist"),
          remove: t("common.remove"),
        }}
      />
    </div>
  );
}
