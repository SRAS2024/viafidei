import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listMilestonesForUser } from "@/lib/data/profile";
import { ProfileBackLink } from "@/components/profile/ProfileBackLink";
import { PageHero } from "@/components/ui/PageHero";
import { MilestoneCreator } from "./MilestoneCreator";
import { MilestoneDeleteButton } from "./MilestoneDeleteButton";
import { logPageError } from "@/lib/observability/page-errors";

// Reads the auth session (cookies), so it can never be statically prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.milestones") };
}

const MILESTONE_TIERS = ["SACRAMENT", "SPIRITUAL", "PERSONAL"] as const;
type Tier = (typeof MILESTONE_TIERS)[number];

export default async function MilestonesPage() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/milestones", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/milestones");
  const { t } = await getTranslator();
  let milestones: Awaited<ReturnType<typeof listMilestonesForUser>> = [];
  try {
    milestones = await listMilestonesForUser(user.id);
  } catch (err) {
    logPageError({ route: "/profile/milestones", entityType: "Milestone", error: err });
  }
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

  const creatorLabels = {
    record: t("profile.milestones.record"),
    alreadyRecorded: t("profile.milestones.alreadyRecorded"),
    addCustom: t("profile.milestones.addCustom"),
    customTitle: t("profile.milestones.customTitle"),
    customDesc: t("profile.milestones.customDesc"),
    save: t("common.save"),
    cancel: t("common.cancel"),
  };

  return (
    <div className="vf-column">
      <ProfileBackLink label={t("common.back")} />
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.milestones")} />

      {/* One section per kind of milestone: what can be recorded, then what has
          been. Headings would otherwise appear twice, once for each. */}
      <div className="vf-stack-related">
        {MILESTONE_TIERS.map((tier) => (
          <section key={tier}>
            <h2 className="vf-subhead">{tierLabels[tier]}</h2>
            <MilestoneCreator
              tier={tier}
              heading={tierLabels[tier]}
              existingSlugs={existingSlugs}
              labels={creatorLabels}
            />
            {grouped[tier].length === 0 ? (
              <p className="vf-fineprint mt-3">None recorded yet.</p>
            ) : (
              <ul className="vf-rows vf-card mt-3">
                {grouped[tier].map((m) => (
                  <li key={m.id} className="vf-row">
                    <div className="vf-row-body">
                      <p className="vf-row-title">{m.title}</p>
                      {m.description ? <p className="vf-panel-text">{m.description}</p> : null}
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
    </div>
  );
}
