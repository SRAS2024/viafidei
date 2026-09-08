import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { ShareButton } from "@/components/ui";
import { ParishCard } from "@/components/ui/ParishCard";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PARISH", slug));
}

/** A trimmed payload string, or null — blank strings must not render a line. */
function text(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The parish page shows the name, the Diocese line, the address with
 * directions, and the website — and nothing else.
 *
 * It no longer goes through PublishedDetail: that renderer prints every
 * remaining payload key, which is exactly the wall of designation / phone /
 * mass times / confession times / background / summary the card is being cut
 * down from. Those fields are still in the payload and still published; this
 * page simply stops displaying them, so all 9,731 parishes changed the instant
 * this file did — no migration, no backfill, no worker republish.
 */
export default async function ParishDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("PARISH", slug);
  if (!item) notFound();

  const payload = item.payload as Record<string, unknown>;
  const latitude = typeof payload.latitude === "number" ? payload.latitude : null;
  const longitude = typeof payload.longitude === "number" ? payload.longitude : null;

  return (
    <ParishCard
      variant="detail"
      name={item.title}
      address={text(payload, "address")}
      city={text(payload, "city")}
      state={text(payload, "state")}
      country={text(payload, "country")}
      latitude={latitude}
      longitude={longitude}
      website={text(payload, "website")}
      // Controls, not parish information: saving and sharing stay available.
      action={
        <>
          <ShareButton title={item.title} />
          <SaveContentButton contentType="PARISH" slug={slug} />
        </>
      }
    />
  );
}
