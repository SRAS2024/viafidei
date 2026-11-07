import type { FC } from "react";

import { ContentCard } from "@/components/ui/ContentCard";
import {
  AnointingBadge,
  BaptismBadge,
  ConfessionBadge,
  ConfirmationBadge,
  EucharistBadge,
  HolyOrdersBadge,
  MatrimonyBadge,
} from "@/components/icons/SacramentBadges";
import {
  SEVEN_SACRAMENTS,
  type CanonicalSacrament,
  type SacramentIconKey,
} from "@/lib/content-shared/sacraments";

const ICONS: Record<SacramentIconKey, FC<{ size?: number; className?: string }>> = {
  baptism: BaptismBadge,
  eucharist: EucharistBadge,
  confirmation: ConfirmationBadge,
  confession: ConfessionBadge,
  anointing: AnointingBadge,
  matrimony: MatrimonyBadge,
  "holy-orders": HolyOrdersBadge,
};

/**
 * The Catechism's three groups, under the Catechism's own names and in its order
 * (CCC 1212, 1421, 1534).
 */
export const SACRAMENT_GROUPS = [
  {
    key: "initiation",
    titleKey: "sacraments.group.initiation",
    title: "Sacraments of Christian Initiation",
    across: 3,
    sacraments: ["BAPTISM", "CONFIRMATION", "EUCHARIST"],
  },
  {
    key: "healing",
    titleKey: "sacraments.group.healing",
    title: "Sacraments of Healing",
    across: 2,
    sacraments: ["RECONCILIATION", "ANOINTING"],
  },
  {
    key: "service",
    titleKey: "sacraments.group.service",
    title: "Sacraments at the Service of Communion",
    across: 2,
    sacraments: ["HOLY_ORDERS", "MATRIMONY"],
  },
] as const;

/** A group's cards, each with the canonical sacrament it shows, in the group's order. */
export function sacramentsOf(group: (typeof SACRAMENT_GROUPS)[number]): CanonicalSacrament[] {
  return group.sacraments
    .map((key) => SEVEN_SACRAMENTS.find((sacrament) => sacrament.key === key))
    .filter((sacrament): sacrament is CanonicalSacrament => sacrament != null);
}

export function sacramentGridClass(group: (typeof SACRAMENT_GROUPS)[number]): string {
  return group.across === 3 ? "vf-sacrament-grid vf-sacrament-grid--3" : "vf-sacrament-grid";
}

/**
 * One sacrament's card. The badge is decoration, so it sits after the title in the
 * reading order and the card puts it first on the page (.vf-sacrament-badge). With
 * no page to open, the card is there but it is not a link, and it reads as quieter.
 */
export function SacramentCard({
  sacrament,
  slug,
}: {
  sacrament: CanonicalSacrament;
  slug?: string;
}) {
  const Icon = ICONS[sacrament.iconKey];
  const badge = <Icon size={44} className="vf-sacrament-badge text-liturgical-gold" />;
  if (slug) {
    return (
      <ContentCard href={`/sacraments/${slug}`} title={sacrament.title} titleAs="h3">
        {badge}
      </ContentCard>
    );
  }
  return (
    <article className="vf-entry">
      <h3 className="vf-entry-title text-ink-faint">{sacrament.title}</h3>
      {badge}
    </article>
  );
}
