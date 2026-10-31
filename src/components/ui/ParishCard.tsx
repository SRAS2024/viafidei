import Link from "next/link";
import type { ReactNode } from "react";

import {
  parishAddressLines,
  parishDesignationLabel,
  parishDirectionsAddress,
} from "@/lib/content-shared/parish";

import { MapsAddressLink } from "./MapsAddressLink";

export type ParishCardProps = {
  /** The church's name — the only thing rendered in title type. */
  name: string;
  /**
   * Where the name links (directory cards). Omitted on the detail page, where
   * the parish IS the page. The card is deliberately not one big anchor: it
   * contains a "Get directions" button, and a button inside a link is invalid
   * HTML and swallows the directions tap.
   */
  href?: string | null;
  /** Stored designation: parish, cathedral, shrine, chapel, minor-basilica, major-basilica. */
  designation?: string | null;
  /** The street line ("6135 South Austin Avenue"). */
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  /** ISO 3166-1 alpha-2; decides whether the postal code leads or follows the town. */
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Rendered under the name and designation. This is the distance slot the
   * locator fills in ("0.4 mi from you"); this component neither computes nor
   * formats a distance.
   */
  distanceSlot?: ReactNode;
  /** Controls beside the name (Share / Save). Not parish information. */
  action?: ReactNode;
  /** "list" is a directory card (h2); "detail" is the parish page (h1). */
  variant?: "list" | "detail";
  className?: string;
};

/**
 * The one and only church presentation — parish, cathedral, basilica, shrine
 * or chapel, on its own page and on the directory.
 *
 * It shows what the owner asked for and nothing else: the name, then what the
 * church is ("Minor Basilica" — a basilica always says minor or major), then
 * its address (street, postal code, town, region, country, as the record has
 * them) with Get directions. The website and the "Diocese" label (which sat on
 * a line that was really the town) are gone. Because this is rendering and not
 * data, every published parish changes the moment this component does: no
 * migration, no backfill, no worker pass. Phone, Mass and confession times,
 * the website and the rest stay in the payload; they are simply not shown.
 */
export function ParishCard({
  name,
  href,
  designation,
  address,
  postalCode,
  city,
  state,
  country,
  countryCode,
  latitude,
  longitude,
  distanceSlot,
  action,
  variant = "list",
  className,
}: ParishCardProps) {
  const detail = variant === "detail";
  const parts = { address, postalCode, city, state, country, countryCode };
  const kind = parishDesignationLabel(designation);
  const lines = parishAddressLines(parts);
  const street = typeof address === "string" && address.trim() ? address.trim() : null;

  // The directory card sits in a list under the page's h1, so it is an h2
  // there and an h1 on the parish's own page.
  const Heading = detail ? "h1" : "h2";
  const heading = (
    <Heading
      className={
        detail
          ? "break-words font-display text-4xl text-ink"
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
          {kind ? <p className="mt-1 font-serif text-ink-soft">{kind}</p> : null}
          {distanceSlot ? <div className="mt-1">{distanceSlot}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2 pt-1">{action}</div> : null}
      </div>

      {/* Omitted entirely when the record has no address part at all, so the
          card never shows an empty row. Directions need a street to aim at. */}
      {lines.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <address className="font-serif not-italic leading-relaxed text-ink">
            {lines.map((line, i) => (
              <span key={i} className="block break-words">
                {line}
              </span>
            ))}
          </address>
          {street ? (
            <MapsAddressLink
              variant="block"
              address={parishDirectionsAddress(parts)}
              latitude={latitude ?? undefined}
              longitude={longitude ?? undefined}
              className="vf-btn vf-btn-ghost inline-flex shrink-0 items-center gap-2 self-start !px-3 !py-1.5 text-sm"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
