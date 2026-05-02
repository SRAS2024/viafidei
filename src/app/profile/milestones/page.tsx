import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listMilestonesForUser } from "@/lib/data/profile";
import { PageHero } from "@/components/ui/PageHero";
import { MilestoneCreator } from "./MilestoneCreator";
import { MilestoneDeleteButton } from "./MilestoneDeleteButton";

const MILESTONE_TIERS = ["SACRAMENT", "SPIRITUAL", "PERSONAL"] as const;
type Tier = (typeof MILESTONE_TIERS)[number];

export default async function MilestonesPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/milestones");
  const { t } = await getTranslator();
  const milestones = await listMilestonesForUser(user.id);
  const existingSlugs = milestones.map((m) => m.slug);

  const tierLabels: Record<Tier, string> = {
    SACRAMENT: t("profile.milestones.sacraments"),
    SPIRITUAL: t("profile.milestones.spiritual"),
    PERSONAL: t("profile.milestones.personal"),
  };

  const grouped: Record<Tier, typeof milestones> = {
    SACRAMENT: milestones.filter((m) => m.tier === "SACRAMENT"),
    SPIRITUAL: milestones.filter((m) => m.tier === "SPIRITUAL"),
    PERSONAL: milestones.filter((m) => m.tier === "PERSONAL"),
  };

  const deleteLabels = {
    delete: t("profile.milestones.delete"),
    cancel: t("common.cancel"),
    deleteTitle: t("profile.milestones.deleteTitle"),
    deleteBody: t("profile.milestones.deleteBody"),
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.milestones")} />

      <MilestoneCreator
        existingSlugs={existingSlugs}
        labels={{
          sacraments: t("profile.milestones.sacraments"),
          spiritual: t("profile.milestones.spiritual"),
          personal: t("profile.milestones.personal"),
          record: t("profile.milestones.record"),
          alreadyRecorded: t("profile.milestones.alreadyRecorded"),
          addCustom: t("profile.milestones.addCustom"),
          customTitle: t("profile.milestones.customTitle"),
          customDesc: t("profile.milestones.customDesc"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />

      <div className="vf-rule mb-8" />

      {MILESTONE_TIERS.map((tier) => (
        <section key={tier} className="mb-10">
          <h2 className="font-display text-2xl">{tierLabels[tier]}</h2>
          <div className="vf-rule my-3" />
          {grouped[tier].length === 0 ? (
            <p className="font-serif text-ink-faint">None recorded yet.</p>
          ) : (
            <ul className="vf-card divide-y divide-ink/10 rounded-sm">
              {grouped[tier].map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <span className="font-display text-lg">{m.title}</span>
                    {m.description ? (
                      <p className="mt-1 font-serif text-sm text-ink-soft">{m.description}</p>
                    ) : null}
                  </div>
                  <MilestoneDeleteButton
                    milestoneId={m.id}
                    milestoneTitle={m.title}
                    labels={deleteLabels}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
