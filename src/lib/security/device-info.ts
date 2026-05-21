/**
 * Best-effort User-Agent summariser.
 *
 * The admin emails and the Developer Audit report want a human-readable
 * "Chrome on Windows" rather than a raw User-Agent string. This is a
 * small, dependency-free heuristic — it is never used for a security
 * decision, only for display, so a missed match degrades gracefully to
 * "unavailable".
 */

export type DeviceInfo = {
  browser: string | null;
  operatingSystem: string | null;
  /** Short human-readable summary, or a clear "unavailable" string. */
  summary: string;
};

function detectOs(ua: string): string | null {
  if (/windows nt/i.test(ua)) return "Windows";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  if (/bot|crawler|spider/i.test(ua)) return "Automated client";
  return null;
}

/** Summarise a raw User-Agent into browser + OS for display. */
export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? "").trim();
  if (ua.length === 0) {
    return { browser: null, operatingSystem: null, summary: "Device details unavailable" };
  }
  const browser = detectBrowser(ua);
  const operatingSystem = detectOs(ua);
  let summary: string;
  if (browser && operatingSystem) {
    summary = `${browser} on ${operatingSystem}`;
  } else if (browser) {
    summary = browser;
  } else if (operatingSystem) {
    summary = operatingSystem;
  } else {
    summary = ua.length > 80 ? `${ua.slice(0, 77)}…` : ua;
  }
  return { browser, operatingSystem, summary };
}
