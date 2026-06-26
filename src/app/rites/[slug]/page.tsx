import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("RITE", slug));
}

export default async function RiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("RITE", slug);
  if (!item) notFound();
  return <PublishedDetail item={item} primaryFields={["history", "background", "summary"]} />;
}
