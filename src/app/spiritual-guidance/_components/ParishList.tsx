"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Parish = {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type NearbyParish = { parish: Parish; distanceKm: number };

type Props = {
  parishes: Parish[];
  placeholder: string;
};

const STORAGE_PERMISSION_KEY = "vf-parish-location-permission";
type StoredPermission = "granted" | "denied" | "prompt";

function readStoredPermission(): StoredPermission {
  if (typeof window === "undefined") return "prompt";
  const v = window.localStorage.getItem(STORAGE_PERMISSION_KEY);
  if (v === "granted" || v === "denied") return v;
  return "prompt";
}

function writeStoredPermission(value: StoredPermission) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PERMISSION_KEY, value);
}

/**
 * Parish finder.
 *
 * Two modes that work together:
 *   - Nearby: requests the device's native location (only when the user
 *     opts in, and only once — the answer is remembered locally so the
 *     prompt isn't shown on every visit) and queries `/api/parishes/near`.
 *   - Search: lets the user type a parish name, city, region, or country
 *     and filters the in-memory parish set, with substring + word-boundary
 *     matching. The same input drives both modes so the page stays simple.
 *
 * Designed to be useful when the database has only a handful of parishes
 * (filters the local list) and when it has thousands (server-side
 * `/api/parishes/near` returns the closest 40 within the chosen radius).
 */
export function ParishList({ parishes, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyParish[] | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [storedPermission, setStoredPermission] = useState<StoredPermission>("prompt");

  // On first render, read the persisted permission and (if previously
  // granted) silently fetch nearby — so we don't re-prompt on each visit.
  useEffect(() => {
    const stored = readStoredPermission();
    setStoredPermission(stored);
    if (stored !== "granted") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        // If permission was revoked at the OS level, downgrade gracefully.
        writeStoredPermission("prompt");
        setStoredPermission("prompt");
      },
      { maximumAge: 5 * 60 * 1000, timeout: 7000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/parishes/near?lat=${coords.lat}&lon=${coords.lon}&radiusKm=50`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items?: NearbyParish[] };
        if (Array.isArray(data.items)) setNearby(data.items);
      } catch {
        /* swallow abort/network errors */
      }
    })();
    return () => controller.abort();
  }, [coords]);

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Your browser does not support geolocation.");
      return;
    }
    setLoadingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeStoredPermission("granted");
        setStoredPermission("granted");
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoadingLocation(false);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        writeStoredPermission(denied ? "denied" : "prompt");
        setStoredPermission(denied ? "denied" : "prompt");
        setLocationError(
          denied
            ? "Location permission was declined. You can still search by name or city below."
            : "Could not determine your location. Try again or search manually.",
        );
        setLoadingLocation(false);
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10000 },
    );
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return parishes;
    return parishes.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.city ?? "").toLowerCase().includes(term) ||
        (p.region ?? "").toLowerCase().includes(term) ||
        (p.country ?? "").toLowerCase().includes(term) ||
        (p.address ?? "").toLowerCase().includes(term)
      );
    });
  }, [parishes, q]);

  // Nearby section is shown only while the user has not started typing a
  // search and we have a result set (not "we asked but got zero").
  const showNearby = !!nearby && !q.trim();
  // Show the "use my location" affordance only when the user has not yet
  // chosen — once they say yes (granted) or no (denied) we don't ask again.
  const showNearbyPrompt = !coords && storedPermission === "prompt";

  return (
    <>
      <div className="mx-auto mb-6 max-w-lg">
        <input
          className="vf-input"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search parishes by name, city, or region"
        />
      </div>

      {showNearbyPrompt ? (
        <div className="mx-auto mb-8 max-w-lg vf-card rounded-sm p-4 text-center">
          <p className="font-serif text-sm text-ink-soft">
            Find parishes near you. We&rsquo;ll only ask for location once.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              onClick={requestLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? "Locating…" : "Use my location"}
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-cancel"
              onClick={() => {
                writeStoredPermission("denied");
                setStoredPermission("denied");
                setLocationError(null);
              }}
            >
              Not now
            </button>
          </div>
          {locationError ? (
            <p className="mt-3 font-serif text-xs text-ink-faint">{locationError}</p>
          ) : null}
        </div>
      ) : null}

      {showNearby && nearby && nearby.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Parishes near you</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {nearby.map((entry) => (
              <Link key={entry.parish.id} href={`/spiritual-guidance/${entry.parish.slug}`}>
                <article className="vf-card h-full rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-2xl">{entry.parish.name}</h3>
                    <span className="shrink-0 font-serif text-xs text-ink-faint">
                      {entry.distanceKm.toFixed(1)} km
                    </span>
                  </div>
                  <p className="mt-2 font-serif text-ink-soft">
                    {[
                      entry.parish.address,
                      entry.parish.city,
                      entry.parish.region,
                      entry.parish.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-faint">
                    {entry.parish.phone ? <span>{entry.parish.phone}</span> : null}
                    {entry.parish.websiteUrl ? (
                      <span className="underline underline-offset-4">Website ↗</span>
                    ) : null}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            {q.trim() ? (
              <>
                <p>No parishes match your search.</p>
                <p className="mt-2 text-xs">
                  Parishes are pulled in dynamically from approved Catholic directories. If you
                  don&rsquo;t see a parish here yet, try a broader search or use your device&rsquo;s
                  location.
                </p>
              </>
            ) : (
              "Parish index will appear here after ingestion from approved official Catholic directories."
            )}
          </div>
        ) : (
          filtered.map((p) => (
            <Link key={p.id} href={`/spiritual-guidance/${p.slug}`}>
              <article className="vf-card h-full rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                <h2 className="font-display text-2xl">{p.name}</h2>
                <p className="mt-2 font-serif text-ink-soft">
                  {[p.address, p.city, p.region, p.country].filter(Boolean).join(", ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-faint">
                  {p.phone ? <span>{p.phone}</span> : null}
                  {p.websiteUrl ? (
                    <span className="underline underline-offset-4">Website ↗</span>
                  ) : null}
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
