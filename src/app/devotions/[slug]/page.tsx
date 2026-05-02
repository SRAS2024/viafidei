import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedDevotionBySlug } from "@/lib/data/devotions";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const d = await getPublishedDevotionBySlug(params.slug, locale);
  if (!d) return { title: "Not Found" };
  const tr = d.translations[0];
  return { title: tr?.title ?? d.title };
}

export default async function DevotionDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const devotion = await getPublishedDevotionBySlug(params.slug, locale);
  if (!devotion) notFound();

  const user = await requireUser();
  const alreadySaved = user ? await isSaved("devotion", user.id, devotion.id) : false;

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

      {user ? (
        <div className="mb-10 flex justify-center">
          <SaveButton kind="devotions" entityId={devotion.id} initiallySaved={alreadySaved} />
        </div>
      ) : null}

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
