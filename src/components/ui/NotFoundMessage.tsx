import type { Metadata } from "next";
import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";

import { PageHero } from "./PageHero";

/**
 * What each not-found page calls the missing thing, and the way back from it. Our
 * Lady and the liturgy each hold two kinds of entry, so a missing one is a page. The
 * liturgy's way back is its own list, since /liturgy-history only redirects.
 */
const NOT_FOUND = {
  page: { title: "notFound.page.title", back: "notFound.page.back", href: "/" },
  prayer: { title: "notFound.prayer.title", back: "notFound.prayer.back", href: "/prayers" },
  saint: { title: "notFound.saint.title", back: "notFound.saint.back", href: "/saints" },
  novena: { title: "notFound.novena.title", back: "notFound.novena.back", href: "/novenas" },
  devotion: {
    title: "notFound.devotion.title",
    back: "notFound.devotion.back",
    href: "/devotions",
  },
  guide: { title: "notFound.guide.title", back: "notFound.guide.back", href: "/guides" },
  sacrament: {
    title: "notFound.sacrament.title",
    back: "notFound.sacrament.back",
    href: "/sacraments",
  },
  practice: {
    title: "notFound.practice.title",
    back: "notFound.practice.back",
    href: "/spiritual-life",
  },
  ourLady: { title: "notFound.page.title", back: "notFound.ourLady.back", href: "/our-lady" },
  liturgy: { title: "notFound.page.title", back: "notFound.liturgy.back", href: "/liturgy" },
  parish: { title: "notFound.parish.title", back: "notFound.parish.back", href: "/parishes" },
  pope: { title: "notFound.pope.title", back: "notFound.pope.back", href: "/popes" },
  doctor: { title: "notFound.doctor.title", back: "notFound.doctor.back", href: "/doctors" },
  rite: { title: "notFound.rite.title", back: "notFound.rite.back", href: "/rites" },
} as const;

export type NotFoundKind = keyof typeof NOT_FOUND;

/**
 * A missing page's browser title, the first thing a screen reader says on it. Next
 * marks every not-found answer noindex itself, so the only robots line to deal with
 * is the root layout's "index, follow", which would contradict it.
 */
export async function notFoundMetadata(kind: NotFoundKind): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t(NOT_FOUND[kind].title), robots: null };
}

/**
 * The one not-found message: what is missing, why that may be, and the way back, in
 * the reader's language. Every not-found.tsx is this with its own kind.
 */
export async function notFoundPage(kind: NotFoundKind) {
  const { t } = await getTranslator();
  const { title, back, href } = NOT_FOUND[kind];
  return (
    <div className="vf-message">
      <PageHero title={t(title)} subtitle={t("notFound.body")} />
      <Link href={href} className="vf-btn vf-btn-primary">
        {/* One run of text: the arrow wraps with the words rather than holding a column
            of its own, which a narrow screen at enlarged text cannot spare. */}
        <span>
          <span aria-hidden="true">←</span> {t(back)}
        </span>
      </Link>
    </div>
  );
}
