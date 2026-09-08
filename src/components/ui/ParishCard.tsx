import Link from "next/link";
import type { ReactNode } from "react";

import {
  parishDioceseLine,
  parishDirectionsAddress,
  parishWebsite,
} from "@/lib/content-shared/parish";

import { MapsAddressLink } from "./MapsAddressLink";

export type ParishCardProps = {
  /** The parish name — the only thing rendered in title type. */
  name: string;
  /**
   * Where the name links (directory cards). Omitted on the detail page, where
   * the parish IS the page. The card is deliberately not one big anchor: it
   * contains a "Get directions" button, and a button inside a link is invalid
   * HTML and swallows the directions tap.
   */
  href?: string | null;
  /** Street address only — city/state/country belong on the Diocese line. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  /**
   * Rendered directly under the name, before the Diocese line. This is the
   * distance slot the locator fills in ("0.4 mi from you"); this component
   * neither computes nor formats a distance.
   */
  distanceSlot?: ReactNode;
  /** Controls beside the name (Share / Save). Not parish information. */
  action?: ReactNode;
  /** "list" is a directory card (h2); "detail" is the parish page (h1). */
  variant?: "list" | "detail";
  className?: string;
};

/**
 * The one and only parish presentation.
 *
 * The parish card used to carry designation, phone, mass and confession times,
 * background, summary and a separate row per place field. It now shows the
 * name, a "Diocese" line, the postal address with directions, and the website
 * — nothing else. Because this is rendering and not data, every published
 * parish changed the moment this component did: no migration, no backfill, no
 * worker pass over 9,731 rows.
 *
 * The other fields are untouched in the payload; they simply stop being shown.
 */
export function ParishCard({
  name,
  href,
  address,
  city,
  state,
  country,
  latitude,
  longitude,
  website,
  distanceSlot,
  action,
  variant = "list",
  className,
}: ParishCardProps) {
  const detail = variant === "detail";
  const place = { city, state, country };
  const diocese = parishDioceseLine(place);
  const street = typeof address === "string" && address.trim() ? address.trim() : null;
  const destination = parishDirectionsAddress({ ...place, address: street });
  const site = parishWebsite(website);

  // The directory card sits in a list under the page's h1, so it is an h2
  // there and an h1 on the parish's own page.
  const Heading = detail ? "h1" : "h2";
  const heading = (
    <Heading
      className={
        detail
          ? "font-display text-4xl text-ink"
          : "break-words font-display text-xl text-ink sm:text-2xl"
      }
    >
      {href ? (
        <Link href={href} className="underline-offset-4 hover:underline">
          {name}
        </Link>
      ) : (
        name
      )}
    </Heading>
  );

  return (
    <article
      className={
        className ??
        (detail
          ? "mx-auto max-w-3xl px-4 py-10"
          : "vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30")
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {heading}
          {distanceSlot ? <div className="mt-1">{distanceSlot}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2 pt-1">{action}</div> : null}
      </div>

      {/* Omitted entirely when the record has no city/state/country — the
          common case — so the card never shows an empty labelled row. */}
      {diocese ? (
        <p className="mt-3 font-serif leading-relaxed text-ink">
          <span className="vf-eyebrow mr-2">Diocese</span> {diocese}
        </p>
      ) : null}

      {street ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="font-serif leading-relaxed text-ink">{street}</p>
          <MapsAddressLink
            variant="block"
            address={destination || street}
            latitude={latitude ?? undefined}
            longitude={longitude ?? undefined}
            className="vf-btn vf-btn-ghost inline-flex shrink-0 items-center gap-2 self-start !px-3 !py-1.5 text-sm"
          />
        </div>
      ) : null}

      {site ? (
        <p className="mt-3 font-serif leading-relaxed">
          <a
            href={site.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-liturgical-blue underline-offset-2 hover:underline"
          >
            {site.label}
          </a>
        </p>
      ) : null}
    </article>
  );
}
