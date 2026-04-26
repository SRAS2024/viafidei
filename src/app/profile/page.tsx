import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import { PageHero } from "@/components/PageHero";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile");
  const { t } = await getTranslator();

  const [journalCount, prayersSaved, saintsSaved, goalsCount, milestonesCount] = await Promise.all([
    prisma.journalEntry.count({ where: { userId: user.id } }),
    prisma.userSavedPrayer.count({ where: { userId: user.id } }),
    prisma.userSavedSaint.count({ where: { userId: user.id } }),
    prisma.goal.count({ where: { userId: user.id } }),
    prisma.milestone.count({ where: { userId: user.id } }),
  ]);

  const tabs: Array<{ href: string; key: string; count?: number }> = [
    { href: "/profile/prayers", key: "profile.tab.prayers", count: prayersSaved },
    { href: "/profile/journal", key: "profile.tab.journal", count: journalCount },
    { href: "/profile/milestones", key: "profile.tab.milestones", count: milestonesCount },
    { href: "/profile/goals", key: "profile.tab.goals", count: goalsCount },
    { href: "/profile/saints", key: "profile.tab.saints", count: saintsSaved },
    { href: "/profile/settings", key: "profile.tab.settings" },
  ];

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;

  return (
    <div>
      <section className="flex flex-col items-center pt-6 pb-10 text-center">
        <ProfileAvatar
          initials={initials || "VF"}
          editable
          tooltip={t("profile.avatar.editTooltip")}
        />
        <p className="vf-eyebrow mt-6">{t("profile.title")}</p>
        <div className="vf-rule mx-auto my-4" />
        <h1 className="font-display text-4xl text-ink sm:text-5xl">
          {`${user.firstName} ${user.lastName}`}
        </h1>
        <p className="mt-3 font-serif text-ink-soft">{user.email}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tabs.map((t0) => (
          <Link
            key={t0.href}
            href={t0.href}
            className="vf-card flex flex-col rounded-sm p-6 transition hover:border-ink/30"
          >
            <p className="vf-eyebrow">{typeof t0.count === "number" ? t0.count : "—"}</p>
            <h2 className="mt-3 font-display text-2xl">{t(t0.key)}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
