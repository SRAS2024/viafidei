import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedPrayersForUser } from "@/lib/data/prayers";
import { PageHero } from "@/components/ui/PageHero";

export default async function MyPrayers() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/prayers");
  const { t, locale } = await getTranslator();

  const saves = await listSavedPrayersForUser(user.id, locale);

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.prayers")} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saves.length === 0 ? (
          <p className="col-span-full text-center font-serif text-ink-faint">
            No saved prayers yet.
          </p>
        ) : (
          saves.map((s) => {
            const tr = s.prayer.translations[0];
            return (
              <article key={s.prayerId} className="vf-card rounded-sm p-6">
                <p className="vf-eyebrow">{s.prayer.category}</p>
                <h2 className="mt-3 font-display text-2xl">{tr?.title ?? s.prayer.defaultTitle}</h2>
                <p className="mt-3 line-clamp-4 font-serif text-sm text-ink-soft">
                  {tr?.body ?? s.prayer.body}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
