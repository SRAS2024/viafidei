import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("POPE", slug));
}

/**
 * The birth name worth a line under a pope's name: one his papal name does not
 * already say. 34 of the 128 recorded are the papal name itself ("Gregory"
 * under "Pope Saint Gregory the Great"), and "Born Gregory" adds nothing.
 */
function birthNameLine(title: string, value: unknown): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i").test(title) ? null : `Born ${name}`;
}

/**
 * A pope: the name, the papacy (the subtitle, "Pope from 1958 to 1963"), the
 * birth name, then his life. The summary ("Pope John, who reigned as Roman
 * Pontiff from 1958–1963.") only restated the subtitle and was printed twice,
 * and "Papacy began", "Papacy ended" and "Content subtype" rows are gone.
 */
export default async function PopeDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("POPE", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      lede={false}
      facts={[birthNameLine(item.title, item.payload.birthName)]}
      primaryFields={["background"]}
      headings={{ background: null }}
    />
  );
}
