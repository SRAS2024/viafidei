import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedParishes } from "@/lib/data/parishes";
import { tagsForList, withCacheTags } from "@/lib/cache/cached-data";
import { ParishList } from "./_components/ParishList";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Guidance" };

export default async function GuidancePage() {
  const { t } = await getTranslator();
  let parishes: Awaited<ReturnType<typeof listPublishedParishes>> = [];
  try {
    // Spec §19: cached strict-public parishes query scoped by tab tag.
    const cfg = tagsForList({ contentType: "Parish", tab: "parishes" });
    const cached = await withCacheTags<
      Parameters<typeof listPublishedParishes>,
      Awaited<ReturnType<typeof listPublishedParishes>>
    >({
      keyParts: ["parishes", "list"],
      tags: cfg.tags,
      revalidateSeconds: cfg.revalidateSeconds,
      fn: listPublishedParishes,
    });
    parishes = await cached();
  } catch (err) {
    logPageError({ route: "/spiritual-guidance", entityType: "Parish", error: err });
  }
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualGuidance")}
        title={t("guidance.title")}
        subtitle={t("guidance.subtitle")}
      />
      <ParishList parishes={parishes} placeholder={t("guidance.searchPlaceholder")} />
    </div>
  );
}
