import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedApparitions } from "@/lib/data/saved";
import { PageHero } from "@/components/ui/PageHero";
import { RemoveSavedButton } from "@/components/ui/RemoveSavedButton";
import { logPageError } from "@/lib/observability/page-errors";

export default async function MyApparitions() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/apparitions", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/apparitions");
  const { t, locale } = await getTranslator();
  let saves: Awaited<ReturnType<typeof listSavedApparitions>> = [];
  try {
    saves = await listSavedApparitions(user.id, locale);
  } catch (err) {
    logPageError({
      route: "/profile/apparitions",
      entityType: "UserSavedApparition",
      error: err,
    });
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
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.apparitions")} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saves.length === 0 ? (
          <p className="col-span-full text-center font-serif text-ink-faint">
            No saved apparitions yet.
          </p>
        ) : (
          saves.map((s) => {
            const tr = s.apparition.translations[0];
            const title = tr?.title ?? s.apparition.title;
            return (
              <article key={s.apparitionId} className="vf-card rounded-sm p-6">
                <p className="vf-eyebrow">{s.apparition.location ?? "—"}</p>
                <h2 className="mt-3 font-display text-2xl">{title}</h2>
                {s.apparition.country ? (
                  <p className="mt-2 font-serif text-sm text-ink-faint">{s.apparition.country}</p>
                ) : null}
                <div className="mt-4">
                  <RemoveSavedButton
                    kind="apparitions"
                    entityId={s.apparitionId}
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
