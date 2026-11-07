import { PageHero } from "@/components/ui/PageHero";

/**
 * The directory's opening, on the finished page and on its loading placeholder
 * alike, so the search row and the cards arrive exactly where the placeholder
 * held room for them.
 */
export function ParishesHero() {
  return (
    <PageHero
      eyebrow="Find a parish"
      title="Parishes"
      subtitle="Catholic parishes, chapels, shrines, cathedrals, and basilicas — use your location to find the nearest."
    />
  );
}
