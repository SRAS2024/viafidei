import Link from "next/link";
import { getBadgeForGoalSlug } from "@/components/icons/SacramentBadges";

export type ProfileBadge = {
  id: string;
  title: string;
  templateSlug: string | null;
};

type Props = {
  /**
   * Badges earned by the user — typically the result of
   * `listBadgesForUser()`. Order is preserved; the caller decides
   * whether sacraments or consecrations come first.
   */
  badges: ProfileBadge[];
  /**
   * Optional empty-state copy. Defaults to a quiet line directing the
   * user to the sacraments page. Pass `null` to suppress the empty
   * state entirely.
   */
  emptyMessage?: string | null;
};

/**
 * The achievement strip rendered directly under the user's name and
 * avatar on /profile. Each badge is the canonical sacrament or
 * consecration icon from `getBadgeForGoalSlug`, hover-titled with the
 * goal title so a user can confirm which sacrament / consecration the
 * row represents. Tapping a badge jumps to /profile/milestones for the
 * full history. Badges persist for the lifetime of the user account —
 * `Milestone` rows are created in `completeGoal()` and only removed by
 * the admin.
 */
export function ProfileBadgeStrip({
  badges,
  emptyMessage = "Complete a sacrament or consecration goal to earn your first badge.",
}: Props) {
  if (badges.length === 0) {
    if (emptyMessage === null) return null;
    return (
      <p className="mt-2 font-serif text-xs text-ink-faint">
        {emptyMessage}{" "}
        <Link href="/sacraments" className="vf-nav-link">
          Browse sacraments
        </Link>
      </p>
    );
  }
  return (
    <Link
      href="/profile/milestones"
      aria-label="View your sacrament and consecration badges"
      className="mt-3 inline-flex flex-wrap items-center justify-center gap-3 rounded-sm px-2 py-1 transition hover:bg-ink/5"
    >
      {badges.map((b) => {
        const Badge = getBadgeForGoalSlug(b.templateSlug);
        if (!Badge) return null;
        return (
          <span
            key={b.id}
            title={b.title}
            aria-label={b.title}
            className="text-ink"
          >
            <Badge size={36} />
          </span>
        );
      })}
    </Link>
  );
}
