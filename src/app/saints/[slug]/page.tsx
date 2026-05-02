import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSaintBySlug } from "@/lib/data/saints";
import { getPublishedApparitionBySlug } from "@/lib/data/apparitions";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const saint = await getPublishedSaintBySlug(params.slug, locale);
  if (saint) return { title: saint.canonicalName };
  const apparition = await getPublishedApparitionBySlug(params.slug, locale);
  if (apparition) return { title: apparition.title };
  return { title: "Not Found" };
}

export default async function SaintDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();

  // Try saint first, then apparition
  const saint = await getPublishedSaintBySlug(params.slug, locale);
  if (saint) {
    const user = await requireUser();
    const alreadySaved = user ? await isSaved("saint", user.id, saint.id) : false;
    const tr = saint.translations[0];
    const biography = tr?.biography ?? saint.biography;

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/saints" className="vf-nav-link">
            ← {t("nav.saints")}
          </Link>
        </div>

        <section className="mb-10 text-center">
          {saint.feastDay ? <p className="vf-eyebrow">{t("saints.feastDay")}: {saint.feastDay}</p> : null}
          <div className="vf-rule mx-auto my-5" />
          <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
            {saint.canonicalName}
          </h1>
        </section>

        {user ? (
          <div className="mb-10 flex justify-center">
            <SaveButton kind="saints" entityId={saint.id} initiallySaved={alreadySaved} />
          </div>
        ) : null}

        {saint.patronages.length > 0 ? (
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            <span className="vf-eyebrow mr-2">{t("saints.patronages")}:</span>
            {saint.patronages.map((p) => (
              <span key={p} className="rounded-full border border-ink/15 px-3 py-1 font-serif text-sm text-ink-soft">
                {p}
              </span>
            ))}
          </div>
        ) : null}

        <article className="vf-card rounded-sm p-8">
          <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">{biography}</p>
        </article>

        {saint.officialPrayer ? (
          <div className="mt-10 vf-card rounded-sm p-8">
            <h2 className="mb-4 font-display text-2xl">{t("saints.officialPrayer")}</h2>
            <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
              {saint.officialPrayer}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  // Try apparition
  const apparition = await getPublishedApparitionBySlug(params.slug, locale);
  if (!apparition) notFound();

  const user = await requireUser();
  const alreadySaved = user ? await isSaved("apparition", user.id, apparition.id) : false;
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
          <p className="vf-eyebrow">{apparition.location}{apparition.country ? `, ${apparition.country}` : ""}</p>
        ) : null}
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
        {apparition.approvedStatus ? (
          <p className="mt-4 font-serif text-ink-faint">{apparition.approvedStatus}</p>
        ) : null}
      </section>

      {user ? (
        <div className="mb-10 flex justify-center">
          <SaveButton kind="apparitions" entityId={apparition.id} initiallySaved={alreadySaved} />
        </div>
      ) : null}

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
