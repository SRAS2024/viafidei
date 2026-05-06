import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listJournalEntries } from "@/lib/data/journal";
import { PageHero } from "@/components/ui/PageHero";
import { JournalEditor } from "./JournalEditor";
import { JournalDeleteButton } from "./JournalDeleteButton";
import { JournalEditButton } from "./JournalEditButton";
import { JournalFavoriteButton } from "./JournalFavoriteButton";
import { logPageError } from "@/lib/observability/page-errors";

export default async function JournalPage({ searchParams }: { searchParams: { filter?: string } }) {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/journal", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/journal");
  const { t } = await getTranslator();

  const favoritesOnly = searchParams.filter === "favorites";
  let entries: Awaited<ReturnType<typeof listJournalEntries>> = [];
  try {
    entries = await listJournalEntries(user.id, { favoritesOnly });
  } catch (err) {
    logPageError({ route: "/profile/journal", entityType: "JournalEntry", error: err });
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.journal")} />
      <JournalEditor
        labels={{
          title: t("profile.journal.title"),
          body: t("profile.journal.body"),
          save: t("profile.journal.save"),
          cancel: t("profile.journal.cancel"),
          newEntry: t("profile.journal.newEntry"),
        }}
      />
      <div className="mt-10 flex flex-col gap-4">
        {entries.length === 0 ? (
          <p className="text-center font-serif text-ink-faint">Your entries will appear here.</p>
        ) : (
          entries.map((e) => (
            <article key={e.id} className="vf-card rounded-sm p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl text-ink">{e.title}</h2>
                  <p className="vf-eyebrow mt-1">{e.updatedAt.toISOString().slice(0, 10)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <JournalFavoriteButton
                    entryId={e.id}
                    isFavorite={e.isFavorite}
                    favoriteLabel={t("profile.journal.favorite")}
                    unfavoriteLabel={t("profile.journal.unfavorite")}
                  />
                  <JournalDeleteButton
                    entryId={e.id}
                    entryTitle={e.title}
                    labels={{
                      delete: t("profile.journal.delete"),
                      cancel: t("profile.journal.cancel"),
                      confirmTitle: t("profile.journal.deleteTitle"),
                      confirmBody: t("profile.journal.deleteBody"),
                    }}
                  />
                </div>
              </div>
              <p className="mt-4 max-w-reading whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                {e.body}
              </p>
              <JournalEditButton
                entryId={e.id}
                initialTitle={e.title}
                initialBody={e.body}
                labels={{
                  edit: t("profile.journal.edit"),
                  title: t("profile.journal.title"),
                  body: t("profile.journal.body"),
                  save: t("profile.journal.save"),
                  cancel: t("profile.journal.cancel"),
                }}
              />
            </article>
          ))
        )}
      </div>
    </div>
  );
}
