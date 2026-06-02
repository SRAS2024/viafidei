import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import {
  getProfileCounts,
  getProfileForUser,
  listBadgesForUser,
  type ProfileCounts,
} from "@/lib/data/profile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileBadgeStrip } from "@/components/profile/ProfileBadgeStrip";
import { UnverifiedEmailNotice } from "@/components/profile/UnverifiedEmailNotice";
import { prisma } from "@/lib/db/client";
import { logPageError } from "@/lib/observability/page-errors";
import { logoutAction } from "@/app/_actions/auth";

// Reads the auth session (cookies), so it can never be statically prerendered.
export const dynamic = "force-dynamic";

const EMPTY_COUNTS: ProfileCounts = {
  journalCount: 0,
  prayersSaved: 0,
  saintsSaved: 0,
  apparitionsSaved: 0,
  devotionsSaved: 0,
  goalsCount: 0,
  completedGoalsCount: 0,
  milestonesCount: 0,
};

type ProfileTab = { href: string; key: string; count?: number };
type ProfileSection = {
  key: string;
  tabs: ProfileTab[];
};

export default async function ProfilePage() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile");
  const { t } = await getTranslator();

  let counts: ProfileCounts = EMPTY_COUNTS;
  let favoriteJournalCount = 0;
  let profile: Awaited<ReturnType<typeof getProfileForUser>> = null;
  let badges: Awaited<ReturnType<typeof listBadgesForUser>> = [];
  try {
    [counts, favoriteJournalCount, profile, badges] = await Promise.all([
      getProfileCounts(user.id),
      prisma.journalEntry.count({ where: { userId: user.id, isFavorite: true } }),
      getProfileForUser(user.id),
      listBadgesForUser(user.id),
    ]);
  } catch (err) {
    logPageError({ route: "/profile", entityType: "Profile", error: err });
  }
  const avatarSrc = profile?.avatarMedia?.url ?? null;

  // Sections group user-specific content into clear categories so the page
  // surfaces what is meaningful — goals, journals, favorites, saved prayers,
  // saved liturgical content, and saved Catholic learning guides.
  // Saved content (prayers, saints, Our Lady, devotions) is now a single
  // Favorites section with per-type tab filters on /profile/favorites — the
  // old per-type /profile/{prayers,saints,apparitions,devotions} pages never
  // existed, so those dashboard links 404'd.
  const favoritesTotal =
    counts.prayersSaved + counts.saintsSaved + counts.apparitionsSaved + counts.devotionsSaved;
  const sections: ProfileSection[] = [
    {
      key: "profile.section.goals",
      tabs: [
        { href: "/profile/goals", key: "profile.tab.goals", count: counts.goalsCount },
        {
          href: "/profile/goals/completed",
          key: "profile.tab.completedGoals",
          count: counts.completedGoalsCount,
        },
        {
          href: "/profile/milestones",
          key: "profile.tab.milestones",
          count: counts.milestonesCount,
        },
      ],
    },
    {
      key: "profile.section.favorites",
      tabs: [
        { href: "/profile/favorites", key: "profile.tab.allFavorites", count: favoritesTotal },
      ],
    },
    {
      key: "profile.section.journals",
      tabs: [
        { href: "/profile/journal", key: "profile.tab.journal", count: counts.journalCount },
        {
          href: "/profile/journal?filter=favorites",
          key: "profile.tab.journalFavorites",
          count: favoriteJournalCount,
        },
      ],
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
              deliveryFailed: t("auth.verify.resendDeliveryFailed"),
              error: t("auth.verify.resendError"),
            }}
          />
        </div>
      ) : null}
      <section className="flex flex-col items-center pt-6 pb-10 text-center">
        <ProfileAvatar
          initials={initials || "VF"}
          src={avatarSrc}
          editable
          tooltip={t("profile.avatar.editTooltip")}
          labels={{
            saving: t("profile.avatar.saving"),
            saved: t("profile.avatar.saved"),
            error: t("profile.avatar.error"),
            unsupported: t("profile.avatar.unsupported"),
            tooLarge: t("profile.avatar.tooLarge"),
          }}
        />
        <p className="vf-eyebrow mt-6">{t("profile.title")}</p>
        <div className="vf-rule mx-auto my-4" />
        <h1 className="font-display text-4xl text-ink sm:text-5xl">
          {`${user.firstName} ${user.lastName}`}
        </h1>
        <p className="mt-3 font-serif text-ink-soft">{user.email}</p>
        <ProfileBadgeStrip
          badges={badges.map((b) => ({
            id: b.id,
            title: b.title,
            templateSlug: b.templateSlug,
          }))}
        />
        <Link href="/profile/settings" className="vf-nav-link mt-5">
          {t("profile.tab.settings")}
        </Link>
        {/*
          Sign-out is also available in the mobile hamburger menu, but
          desktop users had no way to sign out without re-using the
          mobile menu — adding it here puts it within reach on every
          screen. Server Action so the Router Cache invalidates on the
          way out (see logoutAction in src/app/_actions/auth.ts).
        */}
        <form action={logoutAction} className="mt-3">
          <button type="submit" className="vf-nav-link">
            {t("nav.logout")}
          </button>
        </form>
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
