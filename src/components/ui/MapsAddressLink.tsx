"use client";

import { useCallback } from "react";

type Props = {
  /** Human-readable address (shown as the link text in inline mode). */
  address: string;
  /** Exact coordinates — used as the destination when present (most accurate). */
  latitude?: number;
  longitude?: number;
  /**
   * "inline" renders a clickable span (safe inside a parent <a>, e.g. a card);
   * "block" renders a button-styled "Get directions" control for a detail page.
   */
  variant?: "inline" | "block";
  className?: string;
  /** Button label for the block variant. */
  label?: string;
};

/** iOS / iPadOS detection so we deep-link to Apple Maps on Apple devices. */
function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone / iPod / iPad, plus iPadOS (which reports as "MacIntel" with touch).
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/**
 * Build a directions URL to the parish. The destination is the exact
 * coordinates when we have them (so the pin lands on the right building) and
 * the postal address otherwise. Apple Maps for Apple devices, Google Maps for
 * everything else — both open directions from the user's current location.
 */
function directionsUrl(address: string, latitude?: number, longitude?: number): string {
  const dest =
    typeof latitude === "number" && typeof longitude === "number"
      ? `${latitude},${longitude}`
      : address;
  const enc = encodeURIComponent(dest);
  return isAppleDevice()
    ? `https://maps.apple.com/?daddr=${enc}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
}

/**
 * Opens a parish address in the native maps app for directions: Apple Maps on
 * iPhone/iPad, Google Maps elsewhere. In `inline` mode it is a span so it can
 * live inside a card that is itself a link — clicking the address opens Maps and
 * does not follow the card link.
 */
export function MapsAddressLink({
  address,
  latitude,
  longitude,
  variant = "inline",
  className,
  label,
}: Props) {
  const open = useCallback(
    (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      e.preventDefault();
      e.stopPropagation();
      const url = directionsUrl(address, latitude, longitude);
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    },
    [address, latitude, longitude],
  );

  if (!address || !address.trim()) return null;

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={open}
        className={
          className ?? "vf-btn vf-btn-ghost inline-flex items-center gap-2 !py-1.5 !px-3 text-sm"
        }
        title="Open in Maps for directions"
      >
        <PinIcon />
        {label ?? "Get directions"}
      </button>
    );
  }

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") open(e);
      }}
      className={
        className ??
        "mt-3 inline-flex items-start gap-1.5 font-serif leading-relaxed text-liturgical-blue underline-offset-2 hover:underline"
      }
      title="Open in Maps for directions"
    >
      <PinIcon className="mt-1 shrink-0" />
      {address}
    </span>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
