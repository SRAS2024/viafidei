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
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX, formatJournalCount } from "./limits";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.journal") };
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; error?: string }>;
}) {
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/journal", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/journal");
  const { t, locale } = await getTranslator();
  const { filter, error } = await searchParams;

  const favoritesOnly = filter === "favorites";
  const saveLabels = {
    titleTooLong: t("profile.journal.titleTooLong"),
    bodyTooLong: t("profile.journal.bodyTooLong"),
    signedOut: t("profile.journal.signedOut"),
    logInNewTab: t("profile.journal.logInNewTab"),
    rateLimited: t("profile.journal.rateLimited"),
    saveFailed: t("profile.journal.saveFailed"),
    serverFailed: t("profile.journal.serverFailed"),
    draftBack: t("profile.journal.draftBack"),
    leaveWarning: t("profile.journal.leaveWarning"),
    locale,
  };
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
      {/* The form saves by fetch and stays open when that fails. This is for a plain
          post, which only a client without script can send: all that is left to do for
          it is to say what happened. */}
      {error === "not_saved" ? (
        <p role="alert" className="vf-notice vf-notice-error mb-4">
          {t("profile.journal.notSaved", {
            titleMax: formatJournalCount(JOURNAL_TITLE_MAX, locale),
            bodyMax: formatJournalCount(JOURNAL_BODY_MAX, locale),
          })}
        </p>
      ) : null}
      <div className="vf-toolbar">
        <JournalEditor
          draftKey={`new:${user.id}`}
          labels={{
            title: t("profile.journal.title"),
            body: t("profile.journal.body"),
            save: t("profile.journal.save"),
            cancel: t("profile.journal.cancel"),
            newEntry: t("profile.journal.newEntry"),
            saved: t("profile.journal.saved"),
            ...saveLabels,
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
        <p className="vf-section-lede text-center">
          {favoritesOnly ? t("profile.journal.emptyFavorites") : t("profile.journal.empty")}
        </p>
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
                    ...saveLabels,
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
                  // A function, so a "$" in the reader's title stays a plain character.
                  aria-label={t("profile.journal.pdfLabel").replace("{title}", () => e.title)}
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
