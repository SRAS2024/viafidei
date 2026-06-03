import Link from "next/link";

import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devotions" };

export default async function DevotionsPage() {
  const { t } = await getTranslator();
  const items = await listPublished("DEVOTION");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />
      <p className="mb-8 text-center font-serif text-sm text-ink-soft">
        Looking for a nine-day novena?{" "}
        <Link href="/novenas" className="vf-nav-link">
          Browse novenas →
        </Link>
      </p>
      <PublishedList items={items} baseHref="/devotions" eyebrowField="devotionType" />
    </div>
  );
}
