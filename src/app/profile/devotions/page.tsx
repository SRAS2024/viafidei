import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedDevotions } from "@/lib/data/saved";
import { PageHero } from "@/components/ui/PageHero";
import { RemoveSavedButton } from "@/components/ui/RemoveSavedButton";
import { logPageError } from "@/lib/observability/page-errors";

export default async function MyDevotions() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/devotions", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/devotions");
  const { t, locale } = await getTranslator();
  let saves: Awaited<ReturnType<typeof listSavedDevotions>> = [];
  try {
    saves = await listSavedDevotions(user.id, locale);
  } catch (err) {
    logPageError({ route: "/profile/devotions", entityType: "UserSavedDevotion", error: err });
  }
  const removeLabels = {
    remove: t("profile.saved.remove"),
    cancel: t("common.cancel"),
    removeTitle: t("profile.saved.removeTitle"),
    removeBody: t("profile.saved.removeBody"),
  };

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
            const title = tr?.title ?? s.devotion.title;
            return (
              <article key={s.devotionId} className="vf-card rounded-sm p-6">
                {s.devotion.durationMinutes ? (
                  <p className="vf-eyebrow">{s.devotion.durationMinutes} min</p>
                ) : null}
                <h2 className="mt-3 font-display text-2xl">{title}</h2>
                <p className="mt-3 line-clamp-3 font-serif text-sm text-ink-soft">
                  {tr?.summary ?? s.devotion.summary}
                </p>
                <div className="mt-4">
                  <RemoveSavedButton
                    kind="devotions"
                    entityId={s.devotionId}
                    entityTitle={title}
                    labels={removeLabels}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
