import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { localizeItem } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DOCTOR", slug));
}

/**
 * A Doctor of the Church: the name, the subtitle ("Bishop · Doctor of the
 * Church — Universal Doctor · Feast November 15", which already carries the
 * title and the feast), then the life. The summary restated the subtitle and
 * was printed twice; "Feast month: 11", "Feast day of month: 15" and
 * "Ecclesial role: bishop" are gone.
 */
export default async function DoctorDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("DOCTOR", slug));
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      lede={false}
      primaryFields={["background"]}
      headings={{ background: null }}
    />
  );
}
