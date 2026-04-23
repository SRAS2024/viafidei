import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";

export default async function MilestonesPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/milestones");
  const { t } = await getTranslator();
  const milestones = await prisma.milestone.findMany({
    where: { userId: user.id },
    orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
  });

  const tiers = {
    SACRAMENT: t("profile.milestones.sacraments"),
    SPIRITUAL: t("profile.milestones.spiritual"),
    PERSONAL: t("profile.milestones.personal"),
  } as const;

  const grouped = {
    SACRAMENT: milestones.filter((m) => m.tier === "SACRAMENT"),
    SPIRITUAL: milestones.filter((m) => m.tier === "SPIRITUAL"),
    PERSONAL: milestones.filter((m) => m.tier === "PERSONAL"),
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">← {t("common.back")}</Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.milestones")} />
      {(["SACRAMENT", "SPIRITUAL", "PERSONAL"] as const).map((tier) => (
        <section key={tier} className="mb-10">
          <h2 className="font-display text-2xl">{tiers[tier]}</h2>
          <div className="vf-rule my-3" />
          {grouped[tier].length === 0 ? (
            <p className="font-serif text-ink-faint">None yet.</p>
          ) : (
            <ul className="vf-card divide-y divide-ink/10 rounded-sm">
              {grouped[tier].map((m) => (
                <li key={m.id} className="px-5 py-4 font-serif">
                  <span className="font-display text-lg">{m.title}</span>
                  {m.description ? (
                    <p className="mt-1 text-sm text-ink-soft">{m.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
