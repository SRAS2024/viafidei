import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import { PageHero } from "@/components/PageHero";
import { JournalEditor } from "./JournalEditor";

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
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-2xl">{e.title}</h2>
                  <p className="vf-eyebrow mt-1">
                    {e.updatedAt.toISOString().slice(0, 10)} {e.isFavorite ? "· ★" : ""}
                  </p>
                </div>
                <form method="post" action={`/api/journal/${e.id}/delete`}>
                  <button className="vf-nav-link" type="submit">
                    {t("profile.journal.delete")}
                  </button>
                </form>
              </div>
              <p className="mt-4 whitespace-pre-wrap font-serif text-ink-soft">{e.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
