import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedLiturgyEntries } from "@/lib/data/liturgy";
import { matchesRite, RITE_LABEL_KEYS } from "@/lib/content/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy" };

const PAGE_SIZE = 12;

const SECTION_ORDER: Array<{
  id: string;
  label: string;
  kinds: ReadonlyArray<string>;
  description: string;
}> = [
  {
    id: "mass",
    label: "The Holy Mass",
    kinds: ["MASS_STRUCTURE"],
    description:
      "The Order of the Mass — the central liturgy of the Catholic Church, from the Introductory Rites through the Liturgy of the Word, the Liturgy of the Eucharist, and the Concluding Rite.",
  },
  {
    id: "liturgical-year",
    label: "The Liturgical Year",
    kinds: ["LITURGICAL_YEAR"],
    description:
      "Seasons, solemnities, and feasts — Advent, Christmas, Lent, the Sacred Triduum, Easter, and Ordinary Time.",
  },
  {
    id: "sacraments-rites",
    label: "Rites of the Sacraments",
    kinds: ["MARRIAGE_RITE", "FUNERAL_RITE", "ORDINATION_RITE"],
    description:
      "The proper ritual forms for Christian marriage, Christian funerals, and ordination to Holy Orders.",
  },
  {
    id: "symbolism",
    label: "Liturgical Symbolism",
    kinds: ["SYMBOLISM"],
    description: "Vestments, gestures, vessels, and the symbolic vocabulary of Catholic worship.",
  },
  {
    id: "glossary",
    label: "Glossary",
    kinds: ["GLOSSARY"],
    description: "Definitions of key liturgical and catechetical terms.",
  },
];

const HISTORY_OR_DOCUMENT_PREFIXES = [
  "council-",
  "church-history-",
  "encyclical-",
  "catechism-",
  "code-of-canon-law-",
  "code-of-canons-of-the-eastern-churches",
  "vatican-council-",
  "synod-",
];

function isHistoryOrDocument(slug: string): boolean {
  return HISTORY_OR_DOCUMENT_PREFIXES.some((p) => slug.startsWith(p));
}

export default async function LiturgyPage({ searchParams }: { searchParams: { page?: string } }) {
  const { t, locale } = await getTranslator();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  let entries: Awaited<ReturnType<typeof listPublishedLiturgyEntries>> = [];
  try {
    entries = await listPublishedLiturgyEntries(locale);
  } catch (err) {
    logPageError({ route: "/liturgy", entityType: "LiturgyEntry", error: err });
  }
  const rite = await getRiteCookieValue();
  // Liturgy tab shows only true liturgy content — Mass, liturgical year,
  // rite of marriage/funeral/ordination, symbolism, glossary. Council
  // documents and historical chronology live in /history.
  const liturgy = entries.filter((e) => matchesRite(e.slug, rite) && !isHistoryOrDocument(e.slug));

  const sectioned = SECTION_ORDER.map((section) => ({
    section,
    items: liturgy.filter((e) => section.kinds.includes(e.kind)),
  })).filter((s) => s.items.length > 0);

  const totalItems = sectioned.reduce((a, s) => a + s.items.length, 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgy")}
        title="The Sacred Liturgy"
        subtitle="The public worship of the Church — the Mass, the seasons of the liturgical year, the rites of the sacraments, and the symbolism of Catholic worship."
      />

      <p className="mb-8 font-serif text-sm text-ink-faint">
        {t("rite.label")}: <span className="text-ink">{t(RITE_LABEL_KEYS[rite])}</span>
      </p>

      {sectioned.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          Liturgical entries will appear here as they are ingested and published.
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {sectioned.map(({ section, items }) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="break-words font-display text-2xl sm:text-3xl">{section.label}</h2>
              <p className="mt-2 mb-5 max-w-reading font-serif text-sm text-ink-soft">
                {section.description}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((e) => {
                  const tr = e.translations[0];
                  return (
                    <Link key={e.id} href={`/liturgy-history/${e.slug}`}>
                      <article className="vf-card flex h-full flex-col rounded-sm p-5 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-6">
                        <h3 className="break-words font-display text-lg sm:text-xl">
                          {tr?.title ?? e.title}
                        </h3>
                        {(tr?.summary ?? e.summary) ? (
                          <p className="mt-3 line-clamp-4 font-serif text-sm leading-relaxed text-ink-soft">
                            {tr?.summary ?? e.summary}
                          </p>
                        ) : null}
                      </article>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Pagination basePath="/liturgy" page={safePage} totalPages={totalPages} />
    </div>
  );
}
