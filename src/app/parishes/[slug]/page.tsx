import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { ShareButton } from "@/components/ui";
import { ParishCard } from "@/components/ui/ParishCard";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { localizeParishes } from "@/lib/translation/localize";

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
 * A church's page — parish, cathedral, basilica, shrine or chapel — shows the
 * name, what the church is ("Minor Basilica"), and its address with directions,
 * and nothing else.
 *
 * It does not go through PublishedDetail: that renderer is for content with
 * prose, and a church's card is the shared ParishCard. Phone, Mass and
 * confession times, the website, background and summary are still in the
 * payload and still published; this page simply does not display them, so every
 * published parish changed the instant this file did — no migration, no
 * backfill, no worker republish.
 */
export default async function ParishDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("PARISH", slug);
  if (!item) notFound();

  const payload = item.payload as Record<string, unknown>;
  // The name and country as this reader should see them (rule b: a name in
  // another script is transliterated, with the original beside it), in memory:
  // no cache lookup, no model. A country named in the reader's language keeps
  // its code, which places the postal code in the address.
  const [shown] = await localizeParishes([
    {
      title: item.title,
      country: text(payload, "country"),
      countryCode: text(payload, "countryCode"),
      payload,
    },
  ]);
  const latitude = typeof payload.latitude === "number" ? payload.latitude : null;
  const longitude = typeof payload.longitude === "number" ? payload.longitude : null;

  return (
    <ParishCard
      variant="detail"
      name={shown!.title}
      designation={text(payload, "designation")}
      address={text(payload, "address")}
      postalCode={text(payload, "postalCode")}
      city={text(payload, "city")}
      state={text(payload, "state")}
      country={shown!.country}
      countryCode={shown!.countryCode}
      latitude={latitude}
      longitude={longitude}
      // Controls, not parish information: saving and sharing stay available.
      action={
        <>
          <ShareButton title={shown!.title} />
          <SaveContentButton contentType="PARISH" slug={slug} />
        </>
      }
    />
  );
}
