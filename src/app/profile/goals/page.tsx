import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listGoalsForUser } from "@/lib/data/profile";
import { PageHero } from "@/components/ui/PageHero";
import { GoalManager } from "./GoalManager";

export default async function GoalsPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/goals");
  const { t } = await getTranslator();
  const goals = await listGoalsForUser(user.id);

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
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.goals")} />
      <GoalManager
        initialGoals={serialized}
        labels={{
          newGoal: t("profile.goals.new"),
          title: t("profile.goals.title"),
          description: t("profile.goals.description"),
          dueDate: t("profile.goals.dueDate"),
          save: t("common.save"),
          cancel: t("common.cancel"),
          edit: t("profile.goals.edit"),
          complete: t("profile.goals.complete"),
          archive: t("profile.goals.archive"),
          delete: t("profile.goals.delete"),
          addChecklist: t("profile.goals.addChecklist"),
          deleteTitle: t("profile.goals.deleteTitle"),
          deleteBody: t("profile.goals.deleteBody"),
          checklist: t("profile.goals.checklist"),
        }}
      />
    </div>
  );
}
