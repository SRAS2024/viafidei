import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { listJournalEntries } from "@/lib/data/journal";
import { ProfileBackLink } from "@/components/profile/ProfileBackLink";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHero } from "@/components/ui/PageHero";
import { JournalEditor } from "./JournalEditor";
import { JournalDeleteButton } from "./JournalDeleteButton";
import { JournalEditButton } from "./JournalEditButton";
import { JournalFavoriteButton } from "./JournalFavoriteButton";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.journal") };
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/journal", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/journal");
  const { t, locale } = await getTranslator();
  const { filter } = await searchParams;

  const favoritesOnly = filter === "favorites";
  let entries: Awaited<ReturnType<typeof listJournalEntries>> = [];
  try {
    entries = await listJournalEntries(user.id, { favoritesOnly });
  } catch (err) {
    logPageError({ route: "/profile/journal", entityType: "JournalEntry", error: err });
  }

  return (
    <div className="vf-column">
      <ProfileBackLink label={t("common.back")} />
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.journal")} />
      <div className="vf-toolbar">
        <JournalEditor
          labels={{
            title: t("profile.journal.title"),
            body: t("profile.journal.body"),
            save: t("profile.journal.save"),
            cancel: t("profile.journal.cancel"),
            newEntry: t("profile.journal.newEntry"),
          }}
        />
        {/* The dashboard links straight to the favorites view, so the page has to
            say which view it is showing, and offer the way back. */}
        <FilterChips
          ariaLabel={t("profile.tab.journal")}
          activeKey={favoritesOnly ? "favorites" : "all"}
          items={[
            { key: "all", label: t("profile.tab.journal"), href: "/profile/journal" },
            {
              key: "favorites",
              label: t("profile.tab.journalFavorites"),
              href: "/profile/journal?filter=favorites",
            },
          ]}
        />
      </div>
      {entries.length === 0 ? (
        <p className="vf-section-lede text-center">Your entries will appear here.</p>
      ) : (
        <div className="vf-panel-list">
          {entries.map((e) => (
            <article key={e.id} className="vf-panel">
              <h2 className="vf-entry-title">{e.title}</h2>
              <p className="vf-entry-meta">
                <time dateTime={e.updatedAt.toISOString()}>
                  {e.updatedAt.toLocaleDateString(locale, { dateStyle: "long" })}
                </time>
              </p>
              <p className="vf-panel-text whitespace-pre-wrap">{e.body}</p>
              <div className="vf-panel-actions">
                {/* First in the row: while open it takes a whole line above the
                    other actions. */}
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
                <JournalFavoriteButton
                  entryId={e.id}
                  entryTitle={e.title}
                  isFavorite={e.isFavorite}
                  favoriteLabel={t("profile.journal.favorite")}
                />
                <a
                  href={`/api/journal/${e.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vf-btn vf-btn-sm vf-btn-ghost"
                  aria-label={`Download ${e.title} as a PDF`}
                >
                  PDF
                </a>
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
