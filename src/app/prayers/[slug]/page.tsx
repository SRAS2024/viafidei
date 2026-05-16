import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { resolveGuidePrayers, type GuidePrayerEntry } from "@/lib/data/guide-prayers";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { ExpandablePrayer, OfficialSourceLink } from "@/components/ui";
import { logger } from "@/lib/observability/logger";
import { buildDetailMetadata, notFoundMetadataFor } from "@/lib/metadata";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";
import { checkPrayerRender } from "@/lib/content-qa";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function safeGetPrayer(slug: string, locale: string) {
  try {
    return await getPublishedPrayerBySlug(slug, locale as never);
  } catch (err) {
    logPageError({ route: "/prayers/[slug]", entityType: "Prayer", slug, error: err });
    return null;
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("prayer.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

async function safeIsSaved(userId: string, prayerId: string): Promise<boolean> {
  try {
    return await isSaved("prayer", userId, prayerId);
  } catch (err) {
    logger.warn("prayer.isSaved_failed", { error: (err as Error).message });
    return false;
  }
}

async function safeResolveSteps(slug: string, locale: string): Promise<GuidePrayerEntry[]> {
  try {
    return await resolveGuidePrayers(slug, locale as never);
  } catch (err) {
    logger.warn("prayer.resolve_steps_failed", { slug, error: (err as Error).message });
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const { slug } = await params;
  const prayer = await safeGetPrayer(slug, locale);
  if (!prayer) return notFoundMetadataFor("/prayers");
  const tr = prayer.translations[0];
  const title = tr?.title ?? prayer.defaultTitle;
  return buildDetailMetadata({
    path: `/prayers/${slug}`,
    title,
  });
}

export default async function PrayerDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const { slug } = await params;
  const prayer = await safeGetPrayer(slug, locale);
  if (!prayer) {
    logPageMissingContent({
      route: "/prayers/[slug]",
      entityType: "Prayer",
      slug,
      reason: "missing_record",
    });
    notFound();
  }

  // Strict render-readiness gate (belt-and-suspenders): even though
  // getPublishedPrayerBySlug filters on the strict where clause, an
  // admin-edited row could have flags but missing fields. Refuse to
  // render in that case.
  const render = checkPrayerRender({
    prayerType: prayer.prayerType,
    defaultTitle: prayer.defaultTitle,
    body: prayer.body,
  });
  if (!render.ready) {
    logger.warn("prayer.package_unready", { slug, missing: render.missing });
    logPageMissingContent({
      route: "/prayers/[slug]",
      entityType: "Prayer",
      slug,
      reason: "validation_error",
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved(user.id, prayer.id) : false;

  const tr = prayer.translations[0];
  const title = tr?.title ?? prayer.defaultTitle;
  const body = tr?.body ?? prayer.body;
  const steps = await safeResolveSteps(prayer.slug, locale);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/prayers" className="vf-nav-link">
          ← {t("nav.prayers")}
        </Link>
      </div>

      <section className="mb-10 px-2 text-center">
        <p className="vf-eyebrow">{prayer.category}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="break-words font-display text-3xl leading-tight text-ink sm:text-5xl md:text-6xl">
          {title}
        </h1>
      </section>

      <div className="mb-10 flex justify-center">
        <SaveButton
          kind="prayers"
          entityId={prayer.id}
          initiallySaved={alreadySaved}
          isAuthed={!!user}
          labels={{
            save: t("prayers.save"),
            saved: t("prayers.saved"),
            remove: t("common.remove"),
          }}
        />
      </div>

      <article className="vf-card rounded-sm p-6 sm:p-8">
        <p className="whitespace-pre-wrap break-words font-serif text-base leading-loose text-ink-soft sm:text-lg">
          {body}
        </p>
      </article>

      {prayer.officialPrayer ? (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-xl">{t("saints.officialPrayer")}</h2>
          <p className="font-serif leading-relaxed text-ink-soft">{prayer.officialPrayer}</p>
        </div>
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

      <OfficialSourceLink url={prayer.externalSourceKey} />
    </div>
  );
}
