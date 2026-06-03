import type { FC } from "react";
import Link from "next/link";

import { PageHero } from "@/components/ui";
import {
  AnointingBadge,
  BaptismBadge,
  ConfessionBadge,
  ConfirmationBadge,
  EucharistBadge,
  HolyOrdersBadge,
  MatrimonyBadge,
} from "@/components/icons/SacramentBadges";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import {
  SEVEN_SACRAMENTS,
  matchSacrament,
  type SacramentIconKey,
} from "@/lib/content-shared/sacraments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sacraments" };

const ICONS: Record<SacramentIconKey, FC<{ size?: number; className?: string }>> = {
  baptism: BaptismBadge,
  eucharist: EucharistBadge,
  confirmation: ConfirmationBadge,
  confession: ConfessionBadge,
  anointing: AnointingBadge,
  matrimony: MatrimonyBadge,
  "holy-orders": HolyOrdersBadge,
};

export default async function SacramentsPage() {
  const { t } = await getTranslator();
  const published = await listPublished("SACRAMENT");

  // Pair each published sacrament row with its canonical card so the tab shows
  // exactly the seven sacraments, each linking to its content when present.
  const slugByKey = new Map<string, string>();
  for (const item of published) {
    const match = matchSacrament(
      item.slug,
      item.title,
      (item.payload as Record<string, unknown>).sacramentKey as string | undefined,
    );
    if (match && !slugByKey.has(match.key)) slugByKey.set(match.key, item.slug);
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.sacraments")}
        title={t("sacraments.title")}
        subtitle={t("sacraments.subtitle")}
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SEVEN_SACRAMENTS.map((s) => {
          const Icon = ICONS[s.iconKey];
          const slug = slugByKey.get(s.key);
          const inner = (
            <span className="flex items-center gap-4">
              <Icon size={44} className="shrink-0 text-liturgical-gold" />
              <span className="font-display text-xl text-ink">{s.title}</span>
            </span>
          );
          return (
            <li key={s.key}>
              {slug ? (
                <Link
                  href={`/sacraments/${slug}`}
                  className="vf-card flex rounded-sm p-5 transition hover:border-ink/30"
                >
                  {inner}
                </Link>
              ) : (
                <div className="vf-card flex rounded-sm p-5 opacity-60" aria-disabled="true">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
