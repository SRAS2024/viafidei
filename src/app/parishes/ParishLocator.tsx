"use client";

import { useState } from "react";

import { ParishCard } from "@/components/ui/ParishCard";
import {
  deviceMeasurementSystem,
  formatDistanceAway,
  formatRadius,
  parishDistanceMiles,
  type MeasurementSystem,
} from "@/lib/content-shared/distance";
import type { ParishListItem } from "@/lib/data/published";

/** What the button asks for first; the API widens from here on its own. */
const REQUESTED_RADIUS_MILES = 50;

type Located = {
  kind: "located";
  items: ParishListItem[];
  /** The visitor's own fix, kept only to label distances in this render. */
  origin: { latitude: number; longitude: number };
  /** Imperial or metric, decided once from the DEVICE's locale. */
  units: MeasurementSystem;
  requestedRadiusMiles: number;
  /** The radius that actually answered; null when the search was unlimited. */
  radiusMiles: number | null;
  widened: boolean;
};

type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | Located
  | { kind: "error"; message: string };

/**
 * What the visitor is told after a located search. Sparse coverage must never
 * present as a blank list: either the requested radius answered, or we say
 * plainly that it did not and that these are the nearest parishes instead.
 */
function locatedMessage(s: Located): string {
  if (s.items.length === 0) {
    return "We don't have any parishes in the directory yet. Check back soon.";
  }
  const asked = formatRadius(s.requestedRadiusMiles, s.units) ?? `${s.requestedRadiusMiles} miles`;
  if (!s.widened) return `The parishes nearest you, within ${asked}.`;
  const lead = `No parishes within ${asked} yet.`;
  if (s.radiusMiles === null) return `${lead} Here are the nearest ones we have.`;
  const widened = formatRadius(s.radiusMiles, s.units) ?? `${s.radiusMiles} miles`;
  return `${lead} Here are the nearest ones, within ${widened}.`;
}

/**
 * The parish directory page, with an optional "parishes near me" view.
 *
 * The component receives ONE page of the directory (thirty projected rows) —
 * it used to receive every published parish and sort the whole array in the
 * browser, which at the directory's 200,000-record goal is tens of megabytes
 * of client props per visitor. When the visitor grants location access the
 * fifty nearest parishes are fetched from `/api/parishes/near`, which does the
 * bounding-box + haversine work in SQL and widens the radius by itself when
 * nothing is close. The coordinate is sent to this site's own API and nowhere
 * else, is never written down, and is held in this component's state only for
 * as long as the "near me" view is on screen.
 */
export function ParishLocator({ parishes, total }: { parishes: ParishListItem[]; total?: number }) {
  const [state, setState] = useState<LocateState>({ kind: "idle" });

  const located = state.kind === "located" ? state : null;
  const shown = located ? located.items : parishes;

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "error", message: "Location isn't available on this device." });
      return;
    }
    // Read once, here rather than at render: the component is server-rendered
    // too, and there is no navigator on the server to hydrate against.
    const units = deviceMeasurementSystem(navigator);
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          try {
            const res = await fetch(
              `/api/parishes/near?lat=${encodeURIComponent(origin.latitude)}&lng=${encodeURIComponent(
                origin.longitude,
              )}&radiusMiles=${REQUESTED_RADIUS_MILES}`,
            );
            if (!res.ok) throw new Error("near lookup failed");
            const data = (await res.json()) as {
              items?: ParishListItem[];
              requestedRadiusMiles?: number;
              radiusMiles?: number | null;
              widened?: boolean;
            };
            setState({
              kind: "located",
              items: data.items ?? [],
              origin,
              units,
              requestedRadiusMiles: data.requestedRadiusMiles ?? REQUESTED_RADIUS_MILES,
              radiusMiles:
                data.radiusMiles === undefined ? REQUESTED_RADIUS_MILES : data.radiusMiles,
              widened: data.widened === true,
            });
          } catch {
            // Fail open: the visitor keeps the directory they already have.
            setState({
              kind: "error",
              message: "We couldn't load parishes near you. The directory below still works.",
            });
          }
        })();
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still browse the full directory below."
            : "We couldn't get your location. You can still browse the full directory below.";
        setState({ kind: "error", message });
      },
      // A real device needs longer than ten seconds for a cold high-accuracy
      // fix, and a half-minute-old fix is still accurate enough to label a
      // distance — but a stale one would mislabel every card after a drive.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={state.kind === "locating"}
          className="vf-btn vf-btn-primary inline-flex items-center gap-2"
        >
          <LocationIcon />
          {state.kind === "locating" ? "Finding parishes near you…" : "Use my location"}
        </button>
        {located ? (
          <p className="text-xs text-ink-soft">
            {locatedMessage(located)}{" "}
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="vf-nav-link underline-offset-2"
            >
              Show the full directory
            </button>
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p className="text-xs text-liturgical-red" role="status">
            {state.message}
          </p>
        ) : null}
        {!located && typeof total === "number" && total > parishes.length ? (
          <p className="text-xs text-ink-faint">
            {total.toLocaleString()} parishes in the directory.
          </p>
        ) : null}
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((p) => {
          // Only ever shown once the visitor has located themselves — the plain
          // directory has no origin to measure from and no distance to claim.
          const away = located ? distanceAway(located, p) : null;
          return (
            <li key={p.id}>
              <ParishCard
                name={p.title}
                href={`/parishes/${p.slug}`}
                address={p.address}
                city={p.city}
                state={p.state}
                country={p.country}
                latitude={p.latitude}
                longitude={p.longitude}
                website={p.website}
                distanceSlot={
                  away ? <span className="font-serif text-sm text-ink-soft">{away}</span> : null
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * "0.1 miles away" / "150 metres away", recomputed by haversine from the
 * visitor's own fix. The API's SQL distance is the fallback for a row whose
 * stored coordinate did not come back with the projection.
 */
function distanceAway(state: Located, p: ParishListItem): string | null {
  const miles =
    parishDistanceMiles(state.origin, {
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
    }) ?? p.distanceMiles;
  return formatDistanceAway(miles, state.units);
}

function LocationIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
