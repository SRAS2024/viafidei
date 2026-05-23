import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prayers" };

export default async function PrayersPage() {
  const { t } = await getTranslator();
  const prayers = await listPublished("PRAYER");

  return (
    <div>
      <PageHero
        eyebrow={t("nav.prayers")}
        title={t("prayers.title")}
        subtitle={t("prayers.subtitle")}
      />

      {prayers.length > 0 && (
        <p className="mb-6 text-center font-serif text-sm text-ink-faint">
          {prayers.length} {prayers.length === 1 ? "prayer" : "prayers"}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {prayers.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            The prayer library will appear here as items are approved and published through the
            checklist-first worker.
          </div>
        ) : (
          prayers.map((p) => {
            const body = (p.payload.body as string | undefined) ?? "";
            const category = (p.payload.category as string | undefined) ?? "";
            return (
              <Link key={p.id} href={`/prayers/${p.slug}`}>
                <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-7">
                  {category && <p className="vf-eyebrow">{category}</p>}
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                  <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                    {body}
                  </p>
                </article>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
