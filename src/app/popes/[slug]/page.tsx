import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { factLabel, translateFacts } from "@/lib/content-shared/detail-labels";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItem } from "@/lib/translation/localize";

import { popeFactItems } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("POPE", slug));
}

/**
 * A pope: the name, the facts (his pontificate, the name he was born with), then
 * his life. The stored subtitle ("Pope from 1958 to 1963") said the same as the
 * first fact and the summary ("Pope John, who reigned as Roman Pontiff from
 * 1958–1963.") restated it again. "Pope" over a name that opens with it says nothing.
 */
export default async function PopeDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("POPE", slug));
  if (!item) notFound();
  const { t } = await getTranslator();
  return (
    <PublishedDetail
      t={t}
      item={item}
      eyebrow={/^pope\b/i.test(item.title) ? null : undefined}
      showSubtitle={false}
      lede={false}
      factItems={translateFacts(popeFactItems(item.title, item.payload), t)}
      factsInSubtitle={[factLabel("Pontificate", t)]}
      primaryFields={["background"]}
      headings={{ background: null }}
    />
  );
}
