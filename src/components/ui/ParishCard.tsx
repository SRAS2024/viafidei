import Link from "next/link";
import type { ReactNode } from "react";

import {
  parishDirectionsAddress,
  parishPlaceLine,
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
  /** Street line only — postal code, city, state and country render below it. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  /** Postal code as the country writes it. */
  postalCode?: string | null;
  /** ISO-3166 alpha-2: decides whether the postal code precedes the city. */
  countryCode?: string | null;
  /** The diocese, only when the record names one (`payload.diocese`). */
  diocese?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  /**
   * Rendered directly under the name, before the address. This is the
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
 * The card shows the name, the diocese when the record names one, the full
 * postal address (street, then postal code / city / state / country in the
 * country's order) with directions, and the website — nothing else. The
 * place line used to be labelled "Diocese" although it was city/state/country;
 * a diocese is now shown only from `payload.diocese`. Directions are offered
 * from the street address, or from the coordinates when there is no street —
 * every parish has coordinates, most have no street. Because this is
 * rendering and not data, every published parish changes the moment this
 * component does: no migration, no backfill, no worker pass.
 */
export function ParishCard({
  name,
  href,
  address,
  city,
  state,
  country,
  postalCode,
  countryCode,
  diocese,
  latitude,
  longitude,
  website,
  distanceSlot,
  action,
  variant = "list",
  className,
}: ParishCardProps) {
  const detail = variant === "detail";
  const parts = { city, state, country, postalCode, countryCode };
  const place = parishPlaceLine(parts);
  const street = typeof address === "string" && address.trim() ? address.trim() : null;
  const dioceseName = typeof diocese === "string" && diocese.trim() ? diocese.trim() : null;
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
  const destination = parishDirectionsAddress({ ...parts, address: street });
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

      {dioceseName ? (
        <p className="mt-3 font-serif leading-relaxed text-ink">
          <span className="vf-eyebrow mr-2">Diocese</span> {dioceseName}
        </p>
      ) : null}

      {/* Omitted entirely when there is nothing to show, so the card never
          prints an empty row. Directions need a street or coordinates: a city
          alone is no destination. */}
      {street || place || hasCoordinates ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {street || place ? (
            <p className="font-serif leading-relaxed text-ink">
              {street ? <span className="block">{street}</span> : null}
              {place ? <span className="block">{place}</span> : null}
            </p>
          ) : null}
          {street || hasCoordinates ? (
            <MapsAddressLink
              variant="block"
              address={destination || name}
              latitude={latitude ?? undefined}
              longitude={longitude ?? undefined}
              className="vf-btn vf-btn-ghost inline-flex shrink-0 items-center gap-2 self-start !px-3 !py-1.5 text-sm"
            />
          ) : null}
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
