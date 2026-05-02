/**
 * Hosts considered "Vatican-approved" for autofilling content tabs.
 *
 * The list is intentionally narrow: the Holy See's own properties, the official
 * Vatican news outlet, the Liturgy of the Hours / liturgical calendar service,
 * and the United States Conference of Catholic Bishops, which republishes
 * documents from the Holy See and the approved liturgical books.
 *
 * Anything not matching this allowlist must NEVER reach the database via the
 * autofill pipeline.
 */

const APPROVED_HOSTS: readonly string[] = [
  "vatican.va",
  "www.vatican.va",
  "w2.vatican.va",
  "press.vatican.va",
  "holyseepress.va",
  "press.holyseepress.va",
  "vaticannews.va",
  "www.vaticannews.va",
  "dicasteryforevangelization.va",
  "www.dicasteryforevangelization.va",
  "dicasterypromotionhumandev.va",
  "synod.va",
  "www.synod.va",
  "bibliavulgata.va",
  "usccb.org",
  "www.usccb.org",
  "liturgicalcalendar.org",
  "www.liturgicalcalendar.org",
];

const APPROVED_HOST_SET = new Set<string>(APPROVED_HOSTS.map((h) => h.toLowerCase()));

export function listApprovedHosts(): readonly string[] {
  return APPROVED_HOSTS;
}

export function isApprovedHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return APPROVED_HOST_SET.has(host.toLowerCase());
}

export function isApprovedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  return isApprovedHost(parsed.host);
}

/**
 * Returns the same URL string only if its host is approved; otherwise returns
 * null. Use at every fetch site so a malformed adapter cannot accidentally
 * reach an off-list source.
 */
export function gateUrl(url: string): string | null {
  return isApprovedUrl(url) ? url : null;
}
