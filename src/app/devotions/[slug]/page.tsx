import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedDevotionBySlug } from "@/lib/data/devotions";
import { resolveGuidePrayers, type GuidePrayerEntry } from "@/lib/data/guide-prayers";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { ExpandablePrayer, OfficialSourceLink } from "@/components/ui";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";
import { buildDetailMetadata, notFoundMetadataFor } from "@/lib/metadata";
import { checkDevotionRender, notifyRenderGateFailure } from "@/lib/content-qa";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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

async function safeResolveSteps(slug: string, locale: string): Promise<GuidePrayerEntry[]> {
  try {
    return await resolveGuidePrayers(slug, locale as never);
  } catch (err) {
    logger.warn("devotion.resolve_steps_failed", { slug, error: (err as Error).message });
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const { slug } = await params;
  const d = await safeGetDevotion(slug, locale);
  if (!d) return notFoundMetadataFor("/devotions");
  const tr = d.translations[0];
  return buildDetailMetadata({
    path: `/devotions/${slug}`,
    title: tr?.title ?? d.title,
  });
}

type NovenaDay = {
  dayNumber?: number;
  title?: string;
  intention?: string;
  openingPrayer?: string;
  scripture?: string;
  reflection?: string;
  dayPrayer?: string;
  closingPrayer?: string;
};

function NovenaDaysSection({ metadata }: { metadata: Record<string, unknown> }) {
  const days = Array.isArray(metadata.days) ? (metadata.days as NovenaDay[]) : [];
  if (days.length === 0) return null;
  return (
    <section className="mt-10 vf-card rounded-sm p-6 sm:p-8">
      <h2 className="mb-6 font-display text-2xl">Novena days</h2>
      <div className="space-y-3">
        {days.map((day, idx) => (
          <details key={idx} className="rounded-sm border border-stone-200 p-3">
            <summary className="font-display text-lg cursor-pointer">
              Day {day.dayNumber ?? idx + 1}
              {day.title ? ` — ${day.title}` : ""}
            </summary>
            <div className="mt-3 space-y-3 font-serif text-sm text-ink-soft">
              {day.intention ? (
                <p>
                  <strong>Intention:</strong> {day.intention}
                </p>
              ) : null}
              {day.openingPrayer ? (
                <details className="rounded-sm border border-stone-100 p-2">
                  <summary className="cursor-pointer font-medium">Opening prayer</summary>
                  <p className="mt-2 whitespace-pre-wrap">{day.openingPrayer}</p>
                </details>
              ) : null}
              {day.scripture ? (
                <details className="rounded-sm border border-stone-100 p-2">
                  <summary className="cursor-pointer font-medium">Scripture</summary>
                  <p className="mt-2 whitespace-pre-wrap">{day.scripture}</p>
                </details>
              ) : null}
              {day.reflection ? (
                <p className="whitespace-pre-wrap">
                  <strong>Reflection:</strong> {day.reflection}
                </p>
              ) : null}
              {day.dayPrayer ? (
                <details className="rounded-sm border border-stone-100 p-2">
                  <summary className="cursor-pointer font-medium">Day prayer</summary>
                  <p className="mt-2 whitespace-pre-wrap">{day.dayPrayer}</p>
                </details>
              ) : null}
              {day.closingPrayer ? (
                <details className="rounded-sm border border-stone-100 p-2">
                  <summary className="cursor-pointer font-medium">Closing prayer</summary>
                  <p className="mt-2 whitespace-pre-wrap">{day.closingPrayer}</p>
                </details>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default async function DevotionDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const { slug } = await params;
  const devotion = await safeGetDevotion(slug, locale);
  if (!devotion) {
    logPageMissingContent({
      route: "/devotions/[slug]",
      entityType: "Devotion",
      slug,
      reason: "missing_record",
    });
    notFound();
  }

  const render = checkDevotionRender({
    devotionType: devotion.devotionType,
    title: devotion.title,
    background: devotion.background,
    practiceInstructions: devotion.practiceInstructions ?? devotion.practiceText,
    summary: devotion.summary,
  });
  if (!render.ready) {
    logger.warn("devotion.package_unready", { slug, missing: render.missing });
    logPageMissingContent({
      route: "/devotions/[slug]",
      entityType: "Devotion",
      slug,
      reason: "validation_error",
    });
    void notifyRenderGateFailure({
      contentType: "Devotion",
      slug,
      missingFields: render.missing,
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved(user.id, devotion.id) : false;

  const tr = devotion.translations[0];
  const title = tr?.title ?? devotion.title;
  const summary = tr?.summary ?? devotion.summary;
  const practiceText = tr?.practiceText ?? devotion.practiceText;
  const steps = await safeResolveSteps(devotion.slug, locale);

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

      {devotion.subtype === "novena" && devotion.packageMetadata ? (
        <NovenaDaysSection metadata={devotion.packageMetadata as Record<string, unknown>} />
      ) : null}

      {steps.length > 0 ? (
        <section className="mt-10 vf-card rounded-sm p-6 sm:p-8">
          <h2 className="mb-2 font-display text-2xl">Prayers in this devotion</h2>
          <p className="mb-4 font-serif text-sm text-ink-faint">
            Tap any prayer to read its full text.
          </p>
          <div>
            {steps.map((p) => (
              <ExpandablePrayer key={p.slug} title={p.title} body={p.body} />
            ))}
          </div>
        </section>
      ) : null}

      <OfficialSourceLink url={devotion.externalSourceKey} />
    </div>
  );
}
