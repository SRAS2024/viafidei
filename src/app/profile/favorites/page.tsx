import { redirect } from "next/navigation";

import { PageHero } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  listSavedApparitions,
  listSavedDevotions,
  listSavedPrayers,
  listSavedSaints,
} from "@/lib/data/saved";

import { FavoritesBrowser, type FavoriteItem } from "./FavoritesBrowser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Favorites" };

type SavedRow = { id: string; slug: string; title: string; savedAt: Date };

function toItems(
  rows: SavedRow[],
  contentType: FavoriteItem["contentType"],
  kind: FavoriteItem["kind"],
  basePath: string,
  typeLabel: string,
): FavoriteItem[] {
  return rows.map((r) => ({
    id: r.id,
    contentType,
    kind,
    slug: r.slug,
    title: r.title,
    href: `${basePath}/${r.slug}`,
    typeLabel,
    savedAt: r.savedAt.toISOString(),
  }));
}

export default async function FavoritesPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/favorites");

  const [prayers, saints, apparitions, devotions] = await Promise.all([
    listSavedPrayers(user.id),
    listSavedSaints(user.id),
    listSavedApparitions(user.id),
    listSavedDevotions(user.id),
  ]);

  const items: FavoriteItem[] = [
    ...toItems(prayers, "PRAYER", "prayers", "/prayers", "Prayer"),
    ...toItems(saints, "SAINT", "saints", "/saints", "Saint"),
    ...toItems(apparitions, "APPARITION", "apparitions", "/our-lady", "Our Lady"),
    ...toItems(devotions, "DEVOTION", "devotions", "/devotions", "Devotion"),
  ].sort((a, b) => +new Date(b.savedAt) - +new Date(a.savedAt));

  return (
    <div>
      <PageHero
        eyebrow="Your profile"
        title="Favorites"
        subtitle="Everything you've favorited, filterable by type."
      />
      <FavoritesBrowser items={items} />
    </div>
  );
}
