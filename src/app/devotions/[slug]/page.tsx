import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedDevotionBySlug } from "@/lib/data/devotions";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function safeGetDevotion(slug: string, locale: string) {
  try {
    return await getPublishedDevotionBySlug(slug, locale as never);
  } catch (err) {
    logPageError({ route: "/devotions/[slug]", entityType: "Devotion", slug, error: err });
    return null;
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("devotion.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

async function safeIsSaved(userId: string, devotionId: string): Promise<boolean> {
  try {
    return await isSaved("devotion", userId, devotionId);
  } catch (err) {
    logger.warn("devotion.isSaved_failed", { error: (err as Error).message });
    return false;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const d = await safeGetDevotion(params.slug, locale);
  if (!d) return { title: "Not Found" };
  const tr = d.translations[0];
  return { title: tr?.title ?? d.title };
}

export default async function DevotionDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const devotion = await safeGetDevotion(params.slug, locale);
  if (!devotion) {
    logPageMissingContent({
      route: "/devotions/[slug]",
      entityType: "Devotion",
      slug: params.slug,
      reason: "missing_record",
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved(user.id, devotion.id) : false;

  const tr = devotion.translations[0];
  const title = tr?.title ?? devotion.title;
  const summary = tr?.summary ?? devotion.summary;
  const practiceText = tr?.practiceText ?? devotion.practiceText;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/devotions" className="vf-nav-link">
          ← {t("nav.devotions")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        {devotion.durationMinutes ? (
          <p className="vf-eyebrow">{devotion.durationMinutes} min</p>
        ) : null}
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
          {summary}
        </p>
      </section>

      <div className="mb-10 flex justify-center">
        <SaveButton
          kind="devotions"
          entityId={devotion.id}
          initiallySaved={alreadySaved}
          isAuthed={!!user}
        />
      </div>

      {practiceText ? (
        <article className="vf-card rounded-sm p-8">
          <h2 className="mb-6 font-display text-2xl">How to practice</h2>
          <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
            {practiceText}
          </p>
        </article>
      ) : null}
    </div>
  );
}
