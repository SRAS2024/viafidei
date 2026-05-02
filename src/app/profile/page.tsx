import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { getProfileCounts } from "@/lib/data/profile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type ProfileTab = { href: string; key: string; count?: number };

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile");
  const { t } = await getTranslator();

  const counts = await getProfileCounts(user.id);

  const tabs: ProfileTab[] = [
    { href: "/profile/prayers", key: "profile.tab.prayers", count: counts.prayersSaved },
    { href: "/profile/saints", key: "profile.tab.saints", count: counts.saintsSaved },
    {
      href: "/profile/apparitions",
      key: "profile.tab.apparitions",
      count: counts.apparitionsSaved,
    },
    { href: "/profile/devotions", key: "profile.tab.devotions", count: counts.devotionsSaved },
    { href: "/profile/parishes", key: "profile.tab.parishes", count: counts.parishesSaved },
    { href: "/profile/journal", key: "profile.tab.journal", count: counts.journalCount },
    { href: "/profile/milestones", key: "profile.tab.milestones", count: counts.milestonesCount },
    { href: "/profile/goals", key: "profile.tab.goals", count: counts.goalsCount },
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
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="vf-card flex flex-col rounded-sm p-6 transition hover:border-ink/30"
          >
            <p className="vf-eyebrow">{typeof tab.count === "number" ? tab.count : "—"}</p>
            <h2 className="mt-3 font-display text-2xl">{t(tab.key)}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
