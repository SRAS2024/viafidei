import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedParishes } from "@/lib/data/parishes";

export const metadata = { title: "Spiritual Guidance" };

export default async function GuidancePage() {
  const { t } = await getTranslator();
  const parishes = await listPublishedParishes();
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualGuidance")}
        title={t("guidance.title")}
        subtitle={t("guidance.subtitle")}
      />
      <div className="mx-auto mb-10 max-w-lg">
        <input className="vf-input" placeholder={t("guidance.searchPlaceholder")} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {parishes.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            Parish index will appear here after ingestion from approved official Catholic directories.
          </div>
        ) : (
          parishes.map((p) => (
            <article key={p.id} className="vf-card rounded-sm p-7">
              <h2 className="font-display text-2xl">{p.name}</h2>
              <p className="mt-2 font-serif text-ink-soft">
                {[p.address, p.city, p.region, p.country].filter(Boolean).join(", ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-faint">
                {p.phone ? <span>{p.phone}</span> : null}
                {p.websiteUrl ? (
                  <a href={p.websiteUrl} className="underline underline-offset-4">
                    Website
                  </a>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
