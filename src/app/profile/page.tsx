import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { getProfileCounts } from "@/lib/data/profile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { UnverifiedEmailNotice } from "@/components/profile/UnverifiedEmailNotice";
import { prisma } from "@/lib/db/client";

type ProfileTab = { href: string; key: string; count?: number };
type ProfileSection = {
  key: string;
  tabs: ProfileTab[];
};

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile");
  const { t } = await getTranslator();

  const counts = await getProfileCounts(user.id);
  const favoriteJournalCount = await prisma.journalEntry.count({
    where: { userId: user.id, isFavorite: true },
  });

  // Sections group user-specific content into clear categories so the page
  // surfaces what is meaningful — goals, journals, favorites, saved prayers,
  // saved liturgical content, and saved Catholic learning guides.
  const sections: ProfileSection[] = [
    {
      key: "profile.section.goals",
      tabs: [
        { href: "/profile/goals", key: "profile.tab.goals", count: counts.goalsCount },
        {
          href: "/profile/milestones",
          key: "profile.tab.milestones",
          count: counts.milestonesCount,
        },
      ],
    },
    {
      key: "profile.section.journals",
      tabs: [{ href: "/profile/journal", key: "profile.tab.journal", count: counts.journalCount }],
    },
    {
      key: "profile.section.favorites",
      tabs: [
        {
          href: "/profile/journal?filter=favorites",
          key: "profile.tab.favorites",
          count: favoriteJournalCount,
        },
      ],
    },
    {
      key: "profile.section.savedPrayers",
      tabs: [
        { href: "/profile/prayers", key: "profile.tab.prayers", count: counts.prayersSaved },
        { href: "/profile/devotions", key: "profile.tab.devotions", count: counts.devotionsSaved },
      ],
    },
    {
      key: "profile.section.savedLiturgy",
      tabs: [
        { href: "/profile/parishes", key: "profile.tab.parishes", count: counts.parishesSaved },
        {
          href: "/profile/apparitions",
          key: "profile.tab.apparitions",
          count: counts.apparitionsSaved,
        },
      ],
    },
    {
      key: "profile.section.savedLearning",
      tabs: [{ href: "/profile/saints", key: "profile.tab.saints", count: counts.saintsSaved }],
    },
  ];

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;

  return (
    <div>
      {!user.emailVerifiedAt ? (
        <div className="mx-auto mb-6 max-w-2xl">
          <UnverifiedEmailNotice
            labels={{
              notice: t("auth.verify.unverifiedNotice"),
              resend: t("auth.verify.resend"),
              sent: t("auth.verify.resendSent"),
              rateLimited: t("auth.verify.resendRateLimited"),
              error: t("auth.verify.resendError"),
            }}
          />
        </div>
      ) : null}
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
        <Link href="/profile/settings" className="vf-nav-link mt-5">
          {t("profile.tab.settings")}
        </Link>
      </section>

      <div className="flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.key}>
            <header className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">{t(section.key)}</h2>
              <div className="hidden h-px flex-1 bg-ink/10 sm:block" aria-hidden="true" />
            </header>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="vf-card flex flex-col rounded-sm p-6 transition hover:border-ink/30"
                >
                  <p className="vf-eyebrow">{typeof tab.count === "number" ? tab.count : "—"}</p>
                  <h3 className="mt-3 font-display text-2xl">{t(tab.key)}</h3>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
