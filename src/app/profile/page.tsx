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

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.title") };
}

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
  let favoritesTotal = 0;
  let profile: Awaited<ReturnType<typeof getProfileForUser>> = null;
  let badges: Awaited<ReturnType<typeof listBadgesForUser>> = [];
  try {
    [counts, favoriteJournalCount, favoritesTotal, profile, badges] = await Promise.all([
      getProfileCounts(user.id),
      prisma.journalEntry.count({ where: { userId: user.id, isFavorite: true } }),
      // Every saved kind, parishes and novenas included, to match the page it links to.
      prisma.userSavedContent.count({ where: { userId: user.id } }),
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
  const sections: ProfileSection[] = [
    {
      key: "profile.section.goals",
      tabs: [
        {
          // The page this opens lists goals still in hand; completed ones have their own.
          href: "/profile/goals",
          key: "profile.tab.goals",
          count: Math.max(counts.goalsCount - counts.completedGoalsCount, 0),
        },
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
        <div className="vf-column mb-[var(--space-related)]">
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
      <section className="vf-profile-hero">
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
        <h1 className="vf-page-hero-title">{`${user.firstName} ${user.lastName}`}</h1>
        <p className="vf-profile-email">{user.email}</p>
        <ProfileBadgeStrip
          badges={badges.map((b) => ({
            id: b.id,
            title: b.title,
            templateSlug: b.templateSlug,
          }))}
        />
        <div className="vf-profile-actions">
          <Link href="/profile/settings" className="vf-btn vf-btn-sm vf-btn-ghost">
            {t("profile.tab.settings")}
          </Link>
          {/*
            Sign-out is also available in the mobile hamburger menu, but
            desktop users had no way to sign out without re-using the
            mobile menu — adding it here puts it within reach on every
            screen. Server Action so the Router Cache invalidates on the
            way out (see logoutAction in src/app/_actions/auth.ts).
          */}
          <form action={logoutAction}>
            <button type="submit" className="vf-btn vf-btn-sm vf-btn-ghost">
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </section>

      <div className="vf-dash-frame">
        <div className="vf-dash">
          {sections.map((section) => (
            <section key={section.key} className="vf-panel">
              <h2 className="vf-subhead">{t(section.key)}</h2>
              <ul className="vf-rows">
                {section.tabs.map((tab) => (
                  <li key={tab.href}>
                    <Link href={tab.href} className="vf-dash-link">
                      <span className="min-w-0">{t(tab.key)}</span>
                      {typeof tab.count === "number" ? (
                        <span className="vf-dash-count">{tab.count}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
