import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listSavedSaintsForUser } from "@/lib/data/saints";
import { PageHero } from "@/components/ui/PageHero";

export default async function MySaints() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/saints");
  const { t } = await getTranslator();
  const saves = await listSavedSaintsForUser(user.id);
  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">← {t("common.back")}</Link>
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
            </article>
          ))
        )}
      </div>
    </div>
  );
}
