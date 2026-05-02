import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedDevotions } from "@/lib/data/saved";
import { PageHero } from "@/components/ui/PageHero";

export default async function MyDevotions() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/devotions");
  const { t, locale } = await getTranslator();
  const saves = await listSavedDevotions(user.id, locale);

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.devotions")} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saves.length === 0 ? (
          <p className="col-span-full text-center font-serif text-ink-faint">
            No saved devotions yet.
          </p>
        ) : (
          saves.map((s) => {
            const tr = s.devotion.translations[0];
            return (
              <article key={s.devotionId} className="vf-card rounded-sm p-6">
                {s.devotion.durationMinutes ? (
                  <p className="vf-eyebrow">{s.devotion.durationMinutes} min</p>
                ) : null}
                <h2 className="mt-3 font-display text-2xl">
                  {tr?.title ?? s.devotion.title}
                </h2>
                <p className="mt-3 line-clamp-3 font-serif text-sm text-ink-soft">
                  {tr?.summary ?? s.devotion.summary}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
