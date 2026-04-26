import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import { PageHero } from "@/components/PageHero";
import { JournalEditor } from "./JournalEditor";
import { JournalDeleteButton } from "./JournalDeleteButton";

export default async function JournalPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/journal");
  const { t } = await getTranslator();

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">← {t("common.back")}</Link>
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
                  <p className="vf-eyebrow mt-1">
                    {e.updatedAt.toISOString().slice(0, 10)} {e.isFavorite ? "· ★" : ""}
                  </p>
                </div>
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
              <p className="mt-4 max-w-reading whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                {e.body}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
