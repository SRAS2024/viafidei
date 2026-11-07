import Link from "next/link";
import type { ReactNode } from "react";

import {
  parishAddressLines,
  parishDesignationLabel,
  parishDirectionsAddress,
  parishTextLanguage,
} from "@/lib/content-shared/parish";

import { MapsAddressLink } from "./MapsAddressLink";

export type ParishCardProps = {
  /** The church's name — the only thing rendered in title type. */
  name: string;
  /**
   * Where the name links (directory cards). Omitted on the detail page, where
   * the parish IS the page. The link stretches over the whole card rather than
   * wrapping it: the card contains a "Get directions" button, and a button
   * inside a link is invalid HTML and swallows the directions tap.
   */
  href?: string | null;
  /**
   * Stored designation: parish, cathedral, shrine, chapel, oratory,
   * minor-basilica, major-basilica.
   */
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
  /** The parish page's controls beside Get directions (Share / Save). */
  action?: ReactNode;
  /** "list" is a directory card (h2); "detail" is the parish page (h1). */
  variant?: "list" | "detail";
};

/**
 * A church's name in its own language and direction. A name in another script
 * is shown beside its transliteration ("Dae Seongdang (대성당)"); the original is
 * marked on its own, so the transliteration is read in the page's voice and the
 * original in its language's.
 */
function ParishName({ name, countryCode }: { name: string; countryCode?: string | null }) {
  const language = parishTextLanguage(name, countryCode);
  const beside = language ? null : /^(.+ \()([^()]+)\)$/.exec(name);
  const originalLanguage = beside ? parishTextLanguage(beside[2], countryCode) : undefined;
  return (
    <span dir="auto" lang={language}>
      {beside && originalLanguage ? (
        <>
          {beside[1]}
          <span lang={originalLanguage}>{beside[2]}</span>)
        </>
      ) : (
        name
      )}
    </span>
  );
}

/**
 * The one and only church presentation — parish, cathedral, basilica, shrine,
 * chapel or oratory, on its own page and on the directory.
 *
 * It shows what the owner asked for and nothing else: the name, then what the
 * church is ("Minor Basilica" — a basilica always says minor or major), then
 * its address (street, postal code, town, region, country, as the record has
 * them) with Get directions beneath it. The website and the "Diocese" label
 * (which sat on a line that was really the town) are gone. Directions aim at
 * the record's coordinates when it has them, so a church with no street (most
 * of them) can still be reached; the street address is the fallback
 * destination. Because this is rendering and not data, every published parish
 * changes the moment this component does: no migration, no backfill, no worker
 * pass. Phone, Mass and confession times, the website and the rest stay in the
 * payload; they are simply not shown.
 *
 * The directory holds records in every script, so each line says its own
 * language and direction: a Hangul street is read in a Korean voice, and a
 * Hebrew one runs right to left while keeping the card's left edge.
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
}: ParishCardProps) {
  const detail = variant === "detail";
  const parts = { address, postalCode, city, state, country, countryCode };
  const kind = parishDesignationLabel(designation);
  const lines = parishAddressLines(parts);
  const street = typeof address === "string" && address.trim() ? address.trim() : null;
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  // A town alone is no destination; a street or the exact coordinates are.
  const directions = street != null || hasCoordinates;
  const nameText = <ParishName name={name} countryCode={countryCode} />;

  // Omitted entirely when the record has no address part, so the card never
  // shows an empty row.
  const addressBlock =
    lines.length > 0 ? (
      <address className="vf-address">
        {lines.map((line, i) => (
          <span key={i} dir="auto" lang={parishTextLanguage(line, countryCode)}>
            {line}
          </span>
        ))}
      </address>
    ) : null;

  const directionsButton = directions ? (
    <MapsAddressLink
      variant="block"
      address={parishDirectionsAddress(parts) || name}
      destination={name}
      latitude={hasCoordinates ? (latitude as number) : undefined}
      longitude={hasCoordinates ? (longitude as number) : undefined}
      // The parish page's one main action; on a directory of cards it stays
      // quiet, above the card's stretched link.
      className={
        detail
          ? "vf-btn vf-btn-sm vf-btn-primary"
          : "vf-btn vf-btn-sm vf-btn-ghost vf-entry-control"
      }
    />
  ) : null;

  if (detail) {
    return (
      <article className="vf-detail">
        <header className="vf-detail-header">
          <h1 className="vf-detail-title vf-parish-name text-ink">{nameText}</h1>
          {kind ? <p className="vf-detail-subtitle">{kind}</p> : null}
          {addressBlock}
          {directionsButton || action ? (
            <div className="vf-detail-actions">
              {directionsButton}
              {action}
            </div>
          ) : null}
        </header>
      </article>
    );
  }

  // The directory card sits in a list under the page's h1, so it is an h2.
  return (
    <article className="vf-entry">
      <h2 className="vf-entry-title vf-parish-name">
        {href ? (
          <Link href={href} className="vf-entry-link">
            {nameText}
          </Link>
        ) : (
          nameText
        )}
      </h2>
      {kind ? <p className="vf-entry-meta">{kind}</p> : null}
      {distanceSlot ? <p className="vf-entry-meta">{distanceSlot}</p> : null}
      {addressBlock}
      {directionsButton ? <div className="vf-entry-action">{directionsButton}</div> : null}
    </article>
  );
}
