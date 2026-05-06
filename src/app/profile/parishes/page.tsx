import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedParishes } from "@/lib/data/saved";
import { PageHero } from "@/components/ui/PageHero";
import { RemoveSavedButton } from "@/components/ui/RemoveSavedButton";
import { logPageError } from "@/lib/observability/page-errors";

export default async function MyParishes() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/parishes", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/parishes");
  const { t } = await getTranslator();
  let saves: Awaited<ReturnType<typeof listSavedParishes>> = [];
  try {
    saves = await listSavedParishes(user.id);
  } catch (err) {
    logPageError({ route: "/profile/parishes", entityType: "UserSavedParish", error: err });
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
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.parishes")} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saves.length === 0 ? (
          <p className="col-span-full text-center font-serif text-ink-faint">
            No saved parishes yet.
          </p>
        ) : (
          saves.map((s) => (
            <article key={s.parishId} className="vf-card rounded-sm p-6">
              <h2 className="font-display text-2xl">{s.parish.name}</h2>
              <p className="mt-2 font-serif text-ink-soft">
                {[s.parish.city, s.parish.country].filter(Boolean).join(", ") || "—"}
              </p>
              {s.parish.diocese ? (
                <p className="mt-1 font-serif text-sm text-ink-faint">{s.parish.diocese}</p>
              ) : null}
              <div className="mt-4">
                <RemoveSavedButton
                  kind="parishes"
                  entityId={s.parishId}
                  entityTitle={s.parish.name}
                  labels={removeLabels}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
