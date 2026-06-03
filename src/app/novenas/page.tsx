import { PageHero, PublishedList } from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novenas" };

export default async function NovenasPage() {
  const items = await listPublished("NOVENA");
  return (
    <div>
      <PageHero
        eyebrow="Nine days of prayer"
        title="Novenas"
        subtitle="Nine-day novenas — each day opens in its own dropdown with the full prayer."
      />
      <PublishedList items={items} baseHref="/novenas" eyebrowField="intentionTheme" />
    </div>
  );
}
