import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedSaintsForUser } from "@/lib/data/saints";
import { PageHero } from "@/components/ui/PageHero";
import { RemoveSavedButton } from "@/components/ui/RemoveSavedButton";
import { logPageError } from "@/lib/observability/page-errors";

export default async function MySaints() {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/saints", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/saints");
  const { t } = await getTranslator();
  let saves: Awaited<ReturnType<typeof listSavedSaintsForUser>> = [];
  try {
    saves = await listSavedSaintsForUser(user.id);
  } catch (err) {
    logPageError({ route: "/profile/saints", entityType: "UserSavedSaint", error: err });
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
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.saints")} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saves.length === 0 ? (
          <p className="col-span-full text-center font-serif text-ink-faint">
            No saved saints yet.
          </p>
        ) : (
          saves.map((s) => (
            <article key={s.saintId} className="vf-card rounded-sm p-6">
              <p className="vf-eyebrow">{s.saint.feastDay ?? "—"}</p>
              <h2 className="mt-3 font-display text-2xl">{s.saint.canonicalName}</h2>
              <div className="mt-4">
                <RemoveSavedButton
                  kind="saints"
                  entityId={s.saintId}
                  entityTitle={s.saint.canonicalName}
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
