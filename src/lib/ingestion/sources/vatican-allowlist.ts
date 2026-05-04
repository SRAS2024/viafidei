/**
 * Hosts considered "Vatican-approved" or otherwise reliable Catholic sources
 * for autofilling content tabs.
 *
 * Tier 1 — The Holy See's own properties and direct Vatican news/press
 * outlets. These are the canonical sources for doctrine, liturgy,
 * apostolic exhortations, encyclicals, and synod material.
 *
 * Tier 2 — Bishops' conferences and dicastery sites. The USCCB, the
 * Bishops' Conference of England and Wales, the CCCB, the CBCEW, and
 * the German Bishops' Conference all republish documents from the Holy
 * See, official liturgical books, the Catechism, and approved catechetical
 * material in their respective languages.
 *
 * Tier 3 — Vatican-curated or pontifical academic / liturgical resource
 * sites: the Vatican Apostolic Library, the Vatican Observatory, the
 * Pontifical Liturgical Institute, and the official Liturgy of the Hours
 * / liturgical calendar service. These are explicitly Vatican-affiliated
 * and acceptable for theology, liturgy, and Church history.
 *
 * Anything not matching this allowlist must NEVER reach the database via
 * the autofill pipeline. The list is intentionally narrow and is the
 * single point of truth for which sources may populate doctrine, liturgy,
 * Church history, prayers, or catechetical content.
 */

const APPROVED_HOSTS: readonly string[] = [
  // ── Tier 1 — Holy See & Vatican press ──
  "vatican.va",
  "www.vatican.va",
  "w2.vatican.va",
  "press.vatican.va",
  "holyseepress.va",
  "press.holyseepress.va",
  "vaticannews.va",
  "www.vaticannews.va",
  "osservatoreromano.va",
  "www.osservatoreromano.va",
  "synod.va",
  "www.synod.va",
  "synod2018.va",
  "synod2021-2024.va",

  // ── Tier 1 — Vatican dicasteries ──
  "dicasteryforevangelization.va",
  "www.dicasteryforevangelization.va",
  "dicasterypromotionhumandev.va",
  "doctrineoffaith.va",
  "www.doctrineoffaith.va",
  "laityfamilylife.va",
  "www.laityfamilylife.va",
  "culturaeducazione.va",
  "www.culturaeducazione.va",
  "dicasteryeasternchurches.va",
  "www.dicasteryeasternchurches.va",
  "dicasterydivineworship.va",
  "www.dicasterydivineworship.va",
  "clerus.va",
  "www.clerus.va",
  "saintsiervidi.va",

  // ── Tier 1 — Vatican-affiliated academic / cultural ──
  "vaticanobservatory.va",
  "vaticanlibrary.va",
  "www.vaticanlibrary.va",
  "vaticanstate.va",
  "www.vaticanstate.va",
  "bibliavulgata.va",
  "museivaticani.va",
  "www.museivaticani.va",

  // ── Tier 2 — Bishops' Conferences (English-speaking) ──
  "usccb.org",
  "www.usccb.org",
  "cccb.ca",
  "www.cccb.ca",
  "cbcew.org.uk",
  "www.cbcew.org.uk",
  "catholicbishops.ie",
  "www.catholicbishops.ie",
  "catholic.org.au",
  "www.catholic.org.au",
  "catholic.org.nz",
  "www.catholic.org.nz",
  "cbcp.net",
  "www.cbcp.net",
  "sacbc.org.za",
  "www.sacbc.org.za",
  "cbcindia.com",
  "www.cbcindia.com",

  // ── Tier 2 — Bishops' Conferences (other languages) ──
  "dbk.de",
  "www.dbk.de",
  "conferenciaepiscopal.es",
  "www.conferenciaepiscopal.es",
  "chiesacattolica.it",
  "www.chiesacattolica.it",
  "eglise.catholique.fr",
  "www.eglise.catholique.fr",
  "episcopado.pt",
  "www.episcopado.pt",
  "episkopat.pl",
  "www.episkopat.pl",
  "celam.org",
  "www.celam.org",
  "cebmexico.org",
  "www.cebmexico.org",
  "cnbb.org.br",
  "www.cnbb.org.br",
  "episcopadoargentino.cea.org.ar",
  "www.episcopadoargentino.cea.org.ar",
  "katolsk.no",
  "www.katolsk.no",

  // ── Tier 2 — Major archdioceses (with strong English-language catechetical
  //     content), included for parish-finder and saint biographies ──
  "archny.org", // Archdiocese of New York
  "www.archny.org",
  "archchicago.org",
  "www.archchicago.org",
  "rcab.org", // Boston
  "www.rcab.org",
  "archmil.org", // Milwaukee
  "www.archmil.org",
  "rcdow.org.uk", // Westminster
  "www.rcdow.org.uk",
  "rcaola.org", // Los Angeles
  "lacatholics.org",
  "www.lacatholics.org",

  // ── Tier 2 — Catechism / Bible / liturgical reference (Vatican-republishing) ──
  "ewtn.com",
  "www.ewtn.com",
  "biblegateway.com",
  "www.biblegateway.com",
  "biblia.com",
  "www.biblia.com",
  "drbo.org", // Douay-Rheims Bible Online
  "www.drbo.org",

  // ── Tier 3 — Liturgical calendars and pontifical institutes ──
  "liturgicalcalendar.org",
  "www.liturgicalcalendar.org",
  "ibreviary.com",
  "www.ibreviary.com",
  "universalis.com",
  "www.universalis.com",
  "ccwatershed.org",
  "www.ccwatershed.org",
  "icel.org",
  "www.icel.org",
  "magnificat.net",
  "www.magnificat.net",

  // ── Tier 3 — Pontifical universities and institutes ──
  "pul.urbe.it", // Pontifical Lateran University
  "www.pul.urbe.it",
  "unigre.it", // Pontifical Gregorian University
  "www.unigre.it",
  "santacroce.it", // Pontifical University of the Holy Cross
  "www.santacroce.it",
  "pcj.va", // Pontifical Council for the Family etc — *.va already covered, but
  // include explicitly so the gate function doesn't have to interpret subdomains.

  // ── Tier 3 — Approved Catholic encyclopedic / patristic resources ──
  // Public-domain Catholic Encyclopedia and patristic texts that are
  // mirrored from canonical Catholic editions.
  "newadvent.org",
  "www.newadvent.org",
  "ccel.org", // Christian Classics Ethereal Library — only used for
  // patristic primary sources (Augustine, Aquinas, etc.)
  "www.ccel.org",
] as const;

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
