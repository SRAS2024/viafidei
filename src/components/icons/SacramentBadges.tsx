import type { SVGProps } from "react";

/**
 * Hand-drawn-style SVG badges for the seven sacraments and four personal
 * consecrations. Each badge is monochrome (uses `currentColor`) so it
 * inherits the parent text colour — that way the same icon reads on a
 * light card, a dark card, or inside a primary button without needing
 * per-mode variants. All icons are 64×64 and centered.
 *
 * Map keys match goal-template slugs so a profile can look up the badge
 * for a completed goal in one O(1) lookup.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Wrap({ size = 64, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

// ── Sacraments ───────────────────────────────────────────────────────

/** Baptism — flowing water over a shell. */
export const BaptismBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M14 36c4-6 10-6 14 0s10 6 14 0 6-6 8-2" />
    <path d="M22 22h20l-2 8H24z" />
    <path d="M28 22v-4c0-2 1-4 4-4s4 2 4 4v4" />
  </Wrap>
);

/** Confirmation — descending dove with rays. */
export const ConfirmationBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M32 14v6M22 18l4 4M42 18l-4 4M32 50v-4" />
    <path d="M20 36c4-6 12-8 18-4 2 2 4 2 6 0" />
    <path d="M20 36c0 4 2 8 6 10 4 1 8-1 10-4 1-2 2-2 4-1" />
    <circle cx="38" cy="32" r="0.8" fill="currentColor" />
  </Wrap>
);

/** Eucharist / First Holy Communion — chalice with host above. */
export const EucharistBadge = (p: IconProps) => (
  <Wrap {...p}>
    <circle cx="32" cy="18" r="6" />
    <path d="M28 18h8M32 14v8" />
    <path d="M22 28h20l-2 10c-1 4-4 6-8 6s-7-2-8-6z" />
    <path d="M30 50v4h4v-4M24 54h16" />
  </Wrap>
);

/** Reconciliation / Confession — confessional grille. */
export const ConfessionBadge = (p: IconProps) => (
  <Wrap {...p}>
    <rect x="16" y="14" width="32" height="36" rx="2" />
    <path d="M16 22h32M16 32h32M16 42h32M24 14v36M40 14v36" />
    <path d="M32 18v4M32 28v6M32 38v4" />
  </Wrap>
);

/** Anointing of the Sick — vial of holy oil. */
export const AnointingBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M26 14h12v6c0 2 4 4 4 10v18c0 3-2 4-4 4H26c-2 0-4-1-4-4V30c0-6 4-8 4-10z" />
    <path d="M26 14h12M28 20h8" />
    <path d="M30 36c0-2 2-2 2-4s-2-2-2-4M34 40c0-2 2-2 2-4" />
  </Wrap>
);

/** Holy Orders — chasuble / vestment. */
export const HolyOrdersBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M22 14c4 4 16 4 20 0v36c0 2-2 4-4 4H26c-2 0-4-2-4-4z" />
    <path d="M32 14v40M28 26h8M28 38h8" />
  </Wrap>
);

/** Matrimony — interlocking rings. */
export const MatrimonyBadge = (p: IconProps) => (
  <Wrap {...p}>
    <circle cx="24" cy="32" r="10" />
    <circle cx="40" cy="32" r="10" />
    <path d="M30 32c2-2 4-2 6 0" />
    <path d="M22 22l2-4M42 22l-2-4" />
  </Wrap>
);

// ── Consecrations ────────────────────────────────────────────────────

/** Marian consecration — crowned M with star. */
export const MarianConsecrationBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M20 46V20l6 12 6-14 6 14 6-12v26" />
    <path d="M32 12v-4M28 10l4-2 4 2" />
    <path d="M32 50l1.5 4 4 0.5-3 3 1 4-3.5-2-3.5 2 1-4-3-3 4-0.5z" />
  </Wrap>
);

/** St. Joseph consecration — lily + carpenter's square. */
export const StJosephBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M32 14c-2 2-4 4-4 8s4 6 4 6 4-2 4-6-2-6-4-8z" />
    <path d="M28 28c-2 0-4 2-4 4s2 4 4 4M36 28c2 0 4 2 4 4s-2 4-4 4" />
    <path d="M32 28v22" />
    <path d="M22 50h20M22 50v-6M42 50v-6" />
  </Wrap>
);

/** Holy Family consecration — three radiating hearts. */
export const HolyFamilyBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M32 22c-4-6-12-2-12 4 0 6 12 12 12 12s12-6 12-12c0-6-8-10-12-4z" />
    <circle cx="20" cy="40" r="4" />
    <circle cx="32" cy="44" r="4" />
    <circle cx="44" cy="40" r="4" />
    <path d="M20 44v6M32 48v4M44 44v6" />
  </Wrap>
);

/** Sacred Heart consecration — heart wreathed with thorns, cross above. */
export const SacredHeartBadge = (p: IconProps) => (
  <Wrap {...p}>
    <path d="M32 50s-14-8-14-20 8-14 14-6c6-8 14-2 14 6s-14 20-14 20z" />
    <path d="M32 16v-6M28 12h8" />
    <path d="M22 36c2 2 6 2 8 0M36 36c2 2 6 2 8 0M28 30c-2-2-4-2-6 0M36 30c2-2 4-2 6 0" />
  </Wrap>
);

// ── Lookup table ─────────────────────────────────────────────────────

export const SACRAMENT_BADGE_BY_SLUG: Record<string, React.FC<IconProps>> = {
  "sacrament-baptism": BaptismBadge,
  "sacrament-confirmation": ConfirmationBadge,
  "sacrament-first-communion": EucharistBadge,
  "sacrament-eucharist": EucharistBadge,
  "sacrament-confession": ConfessionBadge,
  "monthly-confession": ConfessionBadge,
  "sacrament-anointing-of-the-sick": AnointingBadge,
  "sacrament-holy-orders": HolyOrdersBadge,
  "sacrament-matrimony": MatrimonyBadge,
  "consecration-de-montfort": MarianConsecrationBadge,
  "marian-consecration": MarianConsecrationBadge,
  "consecration-st-joseph": StJosephBadge,
  "consecration-holy-family": HolyFamilyBadge,
  "consecration-sacred-heart": SacredHeartBadge,
};

export function getBadgeForGoalSlug(slug: string | null | undefined): React.FC<IconProps> | null {
  if (!slug) return null;
  return SACRAMENT_BADGE_BY_SLUG[slug] ?? null;
}
