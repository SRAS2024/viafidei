import { PageHero, PublishedList } from "@/components/ui";
import { apparitionEyebrow } from "@/lib/content-shared/apparitions";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our Lady" };

export default async function OurLadyPage() {
  const items = await listPublished("MARIAN_TITLE");
  const apparitions = await listPublished("APPARITION");
  return (
    <div>
      <PageHero
        eyebrow="The Blessed Virgin Mary"
        title="Our Lady"
        subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
      />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Marian Titles</h2>
      <PublishedList items={items} baseHref="/our-lady" />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Approved Apparitions</h2>
      <PublishedList
        items={apparitions}
        baseHref="/our-lady"
        eyebrowFor={(item) => apparitionEyebrow(item.payload)}
      />
    </div>
  );
}
