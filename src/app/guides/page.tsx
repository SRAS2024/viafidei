import { PageHero, PublishedList } from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guides" };

export default async function GuidesPage() {
  const guides = await listPublished("GUIDE");
  return (
    <div>
      <PageHero
        eyebrow="How to pray & practice"
        title="Guides"
        subtitle="Step-by-step guides to the Rosary, the Divine Mercy Chaplet, Confession, and the spiritual life — steps first, then each prayer in a dropdown."
      />
      <PublishedList items={guides} baseHref="/guides" eyebrowField="kind" />
    </div>
  );
}
