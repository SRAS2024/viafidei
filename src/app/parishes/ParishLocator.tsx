"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatMiles, haversineMiles } from "@/lib/content-shared/geo";

export type ParishCard = {
  id: string;
  slug: string;
  title: string;
  designationLabel: string;
  location: string;
  latitude?: number;
  longitude?: number;
};

type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "located"; lat: number; lon: number }
  | { kind: "error"; message: string };

/**
 * Parish directory with an optional "use my location" sort. When the visitor
 * grants location access (a standard device permission prompt), parishes that
 * carry geocoordinates are ranked nearest-first with the distance shown; the
 * rest keep their original order below. Nothing is sent anywhere — the distance
 * math runs entirely in the browser.
 */
export function ParishLocator({ parishes }: { parishes: ParishCard[] }) {
  const [state, setState] = useState<LocateState>({ kind: "idle" });

  const anyGeocoded = useMemo(
    () => parishes.some((p) => typeof p.latitude === "number" && typeof p.longitude === "number"),
    [parishes],
  );

  const ordered = useMemo(() => {
    if (state.kind !== "located") return parishes.map((p) => ({ parish: p, miles: undefined }));
    const here = state;
    const withDistance = parishes.map((p) => ({
      parish: p,
      miles:
        typeof p.latitude === "number" && typeof p.longitude === "number"
          ? haversineMiles(here.lat, here.lon, p.latitude, p.longitude)
          : undefined,
    }));
    // Geocoded parishes sorted nearest-first; un-geocoded keep their order, last.
    return withDistance.sort((a, b) => {
      if (a.miles === undefined && b.miles === undefined) return 0;
      if (a.miles === undefined) return 1;
      if (b.miles === undefined) return -1;
      return a.miles - b.miles;
    });
  }, [parishes, state]);

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "error", message: "Location isn't available on this device." });
      return;
    }
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ kind: "located", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still browse the full directory below."
            : "We couldn't get your location. You can still browse the full directory below.";
        setState({ kind: "error", message });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
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
        {state.kind === "located" ? (
          <p className="text-xs text-ink-soft">Sorted by distance from your location.</p>
        ) : null}
        {state.kind === "error" ? (
          <p className="text-xs text-liturgical-red" role="status">
            {state.message}
          </p>
        ) : null}
        {state.kind === "idle" && !anyGeocoded ? (
          <p className="text-xs text-ink-faint">
            Distances appear once parishes in the directory include map coordinates.
          </p>
        ) : null}
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ordered.map(({ parish: p, miles }) => (
          <li key={p.id}>
            <Link
              href={`/parishes/${p.slug}`}
              className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="vf-eyebrow">{p.designationLabel}</p>
                {typeof miles === "number" ? (
                  <span className="shrink-0 rounded-sm bg-liturgical-gold/15 px-2 py-0.5 text-[11px] font-medium text-ink">
                    {formatMiles(miles)}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
              {p.location ? (
                <p className="mt-3 font-serif leading-relaxed text-ink-soft">{p.location}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
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
