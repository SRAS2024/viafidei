import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { factLabel, translateFacts } from "@/lib/content-shared/detail-labels";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItem } from "@/lib/translation/localize";

import { doctorEyebrow, doctorFactItems } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DOCTOR", slug));
}

/**
 * A Doctor of the Church: the name, the facts (title, feast day, dates, when they
 * were declared a Doctor), then the life. The stored subtitle ("Bishop · Doctor of
 * the Church — Universal Doctor · Feast November 15") said the same as those facts
 * and the label over the name, and the summary restated it again. "Feast month:
 * 11", "Feast day of month: 15" and "Ecclesial role: bishop" are gone.
 */
export default async function DoctorDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("DOCTOR", slug));
  if (!item) notFound();
  const { t } = await getTranslator();
  return (
    <PublishedDetail
      t={t}
      item={item}
      eyebrow={doctorEyebrow(item.payload)}
      showSubtitle={false}
      lede={false}
      factItems={translateFacts(
        doctorFactItems({
          ...item.payload,
          feastMonth: item.feastMonth,
          feastDayOfMonth: item.feastDayOfMonth,
        }),
        t,
      )}
      factsInSubtitle={["Title", "Feast day"].map((label) => factLabel(label, t))}
      primaryFields={["background"]}
      headings={{ background: null }}
    />
  );
}
