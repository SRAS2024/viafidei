import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSaintBySlug } from "@/lib/data/saints";
import { getPublishedApparitionBySlug } from "@/lib/data/apparitions";
import { isSaved, type SavedKind } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { parseSaintBiography } from "@/lib/data/saint-sections";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function safeGetSaint(slug: string, locale: string) {
  try {
    return await getPublishedSaintBySlug(slug, locale as never);
  } catch (err) {
    logPageError({ route: "/saints/[slug]", entityType: "Saint", slug, error: err });
    return null;
  }
}

async function safeGetApparition(slug: string, locale: string) {
  try {
    return await getPublishedApparitionBySlug(slug, locale as never);
  } catch (err) {
    logPageError({
      route: "/saints/[slug]",
      entityType: "MarianApparition",
      slug,
      error: err,
    });
    return null;
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("saints.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

async function safeIsSaved(kind: SavedKind, userId: string, entityId: string): Promise<boolean> {
  try {
    return await isSaved(kind, userId, entityId);
  } catch (err) {
    logger.warn("saints.isSaved_failed", { kind, error: (err as Error).message });
    return false;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const saint = await safeGetSaint(params.slug, locale);
  if (saint) return { title: saint.canonicalName };
  const apparition = await safeGetApparition(params.slug, locale);
  if (apparition) return { title: apparition.title };
  return { title: "Not Found" };
}

export default async function SaintDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();

  // Try saint first, then apparition
  const saint = await safeGetSaint(params.slug, locale);
  if (saint) {
    const user = await safeRequireUser();
    const alreadySaved = user ? await safeIsSaved("saint", user.id, saint.id) : false;
    const tr = saint.translations[0];
    const biography = tr?.biography ?? saint.biography;
    const sections = parseSaintBiography(biography);
    const hasStructured =
      sections.story.length > 0 ||
      sections.background.length > 0 ||
      sections.importantDates.length > 0 ||
      sections.contributions.length > 0;

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/saints" className="vf-nav-link">
            ← {t("nav.saints")}
          </Link>
        </div>

        <section className="mb-10 text-center">
          {saint.feastDay ? (
            <p className="vf-eyebrow">
              {t("saints.feastDay")}: {saint.feastDay}
            </p>
          ) : null}
          <div className="vf-rule mx-auto my-5" />
          <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
            {saint.canonicalName}
          </h1>
        </section>

        <div className="mb-10 flex justify-center">
          <SaveButton
            kind="saints"
            entityId={saint.id}
            initiallySaved={alreadySaved}
            isAuthed={!!user}
          />
        </div>

        {/* At-a-glance metadata: feast day + patronages, surfaced as a clear
            quick-reference panel rather than buried in the biography prose. */}
        {(saint.feastDay || saint.patronages.length > 0) && (
          <div className="mb-8 vf-card rounded-sm p-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              {saint.feastDay ? (
                <div>
                  <dt className="vf-eyebrow mb-1.5">{t("saints.feastDay")}</dt>
                  <dd className="font-serif text-ink">{saint.feastDay}</dd>
                </div>
              ) : null}
              {saint.patronages.length > 0 ? (
                <div>
                  <dt className="vf-eyebrow mb-1.5">{t("saints.patronages")}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {saint.patronages.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-ink/15 px-2.5 py-0.5 font-serif text-sm text-ink-soft"
                      >
                        {p}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}

        {hasStructured ? (
          <div className="flex flex-col gap-6">
            {sections.story ? (
              <article className="vf-card rounded-sm p-8">
                <h2 className="mb-3 font-display text-2xl">Story</h2>
                <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                  {sections.story}
                </p>
              </article>
            ) : null}
            {sections.background ? (
              <article className="vf-card rounded-sm p-8">
                <h2 className="mb-3 font-display text-2xl">Historical background</h2>
                <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                  {sections.background}
                </p>
              </article>
            ) : null}
            {sections.importantDates ? (
              <article className="vf-card rounded-sm p-8">
                <h2 className="mb-3 font-display text-2xl">Important dates</h2>
                <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                  {sections.importantDates}
                </p>
              </article>
            ) : null}
            {sections.contributions ? (
              <article className="vf-card rounded-sm p-8">
                <h2 className="mb-3 font-display text-2xl">Major contributions to the Church</h2>
                <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                  {sections.contributions}
                </p>
              </article>
            ) : null}
          </div>
        ) : (
          <article className="vf-card rounded-sm p-8">
            <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
              {biography}
            </p>
          </article>
        )}

        {saint.officialPrayer ? (
          <div className="mt-10 vf-card rounded-sm p-8">
            <h2 className="mb-4 font-display text-2xl">{t("saints.officialPrayer")}</h2>
            <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
              {saint.officialPrayer}
            </p>
          </div>
        ) : null}

        <p className="mt-8 text-center font-serif text-xs text-ink-faint">
          Biography curated from approved Catholic sources via the content ingestion system. See{" "}
          <Link href="/admin/sources" className="underline">
            approved sources
          </Link>{" "}
          for details.
        </p>
      </div>
    );
  }

  // Try apparition
  const apparition = await safeGetApparition(params.slug, locale);
  if (!apparition) {
    logPageMissingContent({
      route: "/saints/[slug]",
      slug: params.slug,
      reason: "missing_record",
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved("apparition", user.id, apparition.id) : false;
  const tr = apparition.translations[0];
  const title = tr?.title ?? apparition.title;
  const summary = tr?.summary ?? apparition.summary;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/saints" className="vf-nav-link">
          ← {t("nav.saints")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        {apparition.location ? (
          <p className="vf-eyebrow">
            {apparition.location}
            {apparition.country ? `, ${apparition.country}` : ""}
          </p>
        ) : null}
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
        {apparition.approvedStatus ? (
          <p className="mt-4 font-serif text-ink-faint">{apparition.approvedStatus}</p>
        ) : null}
      </section>

      <div className="mb-10 flex justify-center">
        <SaveButton
          kind="apparitions"
          entityId={apparition.id}
          initiallySaved={alreadySaved}
          isAuthed={!!user}
        />
      </div>

      <article className="vf-card rounded-sm p-8">
        <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">{summary}</p>
      </article>

      {apparition.officialPrayer ? (
        <div className="mt-10 vf-card rounded-sm p-8">
          <h2 className="mb-4 font-display text-2xl">{t("saints.officialPrayer")}</h2>
          <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
            {apparition.officialPrayer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
