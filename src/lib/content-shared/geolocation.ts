/**
 * The device side of "Use my location": which platform the visitor is on (so
 * a refusal can say where the switch actually is), what the Permissions API
 * has on record, and the two sets of options the locator asks with.
 *
 * Nothing here decides WHETHER to ask the device. The locator calls
 * `getCurrentPosition` on every tap, because that call is the only thing that
 * makes iOS show its Allow / Don't Allow sheet, and because a remembered
 * refusal goes stale the moment the visitor changes a setting. The Permissions
 * API is read only after the device has said no, to choose the words.
 */

/** Where the visitor would go to turn location back on. */
export type LocationPlatform = "ios-safari" | "ios-other" | "android" | "mac-safari" | "desktop";

/** The parts of `navigator` this module reads; all optional, as on old browsers. */
export type NavigatorLike = {
  userAgent?: string;
  maxTouchPoints?: number;
  permissions?: { query?: (descriptor: { name: string }) => Promise<{ state?: string }> };
};

/** Browsers on iOS that are not Safari (they carry Safari's token too). */
const IOS_NON_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|Instagram|FBAN|FBAV/i;

/** Mac browsers that are not Safari; Chrome, Edge and Opera carry "Safari/" too. */
const MAC_NON_SAFARI = /Chrome|Chromium|Edg\/|OPR\/|Firefox/i;

/**
 * The visitor's platform, from the user agent. iPadOS reports itself as a Mac,
 * so a "Macintosh" with a touch screen is an iPad. An in-app web view on iOS
 * (no "Safari/" token) counts as "ios-other": its switch is under that app's
 * own name in Settings, not under Safari Websites. Safari on a Mac is told
 * apart from the other desktop browsers because it has no address-bar icon
 * for a site's permissions: its switch is in Safari's own Settings window.
 */
export function detectLocationPlatform(nav: NavigatorLike | undefined): LocationPlatform {
  const ua = nav?.userAgent ?? "";
  const touchMac = /Macintosh/i.test(ua) && (nav?.maxTouchPoints ?? 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || touchMac) {
    return /Safari\//.test(ua) && !IOS_NON_SAFARI.test(ua) ? "ios-safari" : "ios-other";
  }
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !MAC_NON_SAFARI.test(ua)) {
    return "mac-safari";
  }
  return "desktop";
}

/**
 * What the browser has on record for this site: "granted", "prompt", "denied",
 * or null when it will not say (no Permissions API, Safari before 16, or a
 * query that throws). Never throws.
 */
export async function readGeolocationPermission(
  nav: NavigatorLike | undefined,
): Promise<"granted" | "prompt" | "denied" | null> {
  try {
    const query = nav?.permissions?.query;
    if (typeof query !== "function") return null;
    const status = await query.call(nav?.permissions, { name: "geolocation" });
    const state = status?.state;
    return state === "granted" || state === "prompt" || state === "denied" ? state : null;
  } catch {
    return null;
  }
}

/**
 * The first ask: the best fix the device can give. A real phone needs longer
 * than ten seconds for a cold high-accuracy fix, and a half-minute-old fix is
 * still accurate enough to label a distance — but a stale one would mislabel
 * every card after a drive.
 */
export const PRECISE_FIX: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
};

/**
 * The one automatic retry, after the first ask timed out or found no position:
 * indoors there may be no GPS at all, but Wi-Fi and the cell network can still
 * place the visitor well enough to find the nearest parishes. Coarser, more
 * patient, and happy with a fix from the last two minutes.
 */
export const COARSE_FIX: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 30_000,
  maximumAge: 120_000,
};

/** GeolocationPositionError codes. Fixed by the spec, so read as plain numbers. */
export const GEO_PERMISSION_DENIED = 1;
export const GEO_POSITION_UNAVAILABLE = 2;
export const GEO_TIMEOUT = 3;

/** True for the failures a second, coarser ask can fix. */
export function isRetryableGeoError(code: number | undefined): boolean {
  return code === GEO_TIMEOUT || code === GEO_POSITION_UNAVAILABLE;
}
