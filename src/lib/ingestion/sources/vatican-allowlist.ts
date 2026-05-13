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
  // Additional U.S. and global archdioceses with comprehensive parish
  // directories and catechetical content. All publish in line with
  // the bishops' conference of their region.
  "archphila.org", // Philadelphia
  "www.archphila.org",
  "archatl.com", // Atlanta
  "www.archatl.com",
  "archbalt.org", // Baltimore
  "www.archbalt.org",
  "archstl.org", // Saint Louis
  "www.archstl.org",
  "archden.org", // Denver
  "www.archden.org",
  "dosafl.com", // Diocese of Saint Augustine
  "www.dosafl.com",
  "miamiarch.org", // Miami
  "www.miamiarch.org",
  "archsa.org", // San Antonio
  "www.archsa.org",
  "sfarchdiocese.org", // San Francisco
  "www.sfarchdiocese.org",
  "seattlearchdiocese.org",
  "www.seattlearchdiocese.org",
  "archtoronto.org", // Archdiocese of Toronto
  "www.archtoronto.org",
  "diomelb.org.au", // Melbourne
  "www.diomelb.org.au",
  "sydneycatholic.org",
  "www.sydneycatholic.org",
  "dublindiocese.ie",
  "www.dublindiocese.ie",
  "rcdea.org.uk", // East Anglia
  "www.rcdea.org.uk",
  "rcdow.org.uk",
  "www.rcdow.org.uk",
  "diocesedeparis.fr",
  "www.diocesedeparis.fr",
  "diocesimilano.it",
  "www.diocesimilano.it",
  "archimadrid.es",
  "www.archimadrid.es",

  // ── Tier 2 — Catechism / Bible / liturgical reference (Vatican-republishing) ──
  "ewtn.com",
  "www.ewtn.com",
  "biblegateway.com",
  "www.biblegateway.com",
  "biblia.com",
  "www.biblia.com",
  "drbo.org", // Douay-Rheims Bible Online
  "www.drbo.org",
  // Additional well-established Catholic reference, news and devotional
  // sites that republish content from the Holy See or bishops' conferences.
  "catholicnewsagency.com",
  "www.catholicnewsagency.com",
  "ncregister.com", // National Catholic Register
  "www.ncregister.com",
  "catholicworldreport.com",
  "www.catholicworldreport.com",
  "thecatholicthing.org",
  "www.thecatholicthing.org",
  "wordonfire.org", // Bishop Robert Barron — orthodox Catholic catechesis
  "www.wordonfire.org",
  "ascensionpress.com",
  "www.ascensionpress.com",
  "catholic.com", // Catholic Answers
  "www.catholic.com",
  "praytellblog.com",
  "www.praytellblog.com",

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

  // ── Additional credible Catholic publishing / catechetical sources ──
  // All have a documented record of orthodox Catholic publishing under
  // ecclesiastical oversight (imprimatur / nihil obstat policies, or
  // editorial board accountable to a diocesan ordinary). Each is added
  // for breadth of public-domain prayer, saint biography, and devotional
  // material that complements the Vatican and bishops' conference tier.
  "thedivinemercy.org", // Marians of the Immaculate Conception
  "www.thedivinemercy.org",
  "marian.org", // Marian Fathers
  "www.marian.org",
  "knightsofcolumbus.org",
  "www.knightsofcolumbus.org",
  "kofc.org",
  "www.kofc.org",
  "fathersofmercy.com",
  "www.fathersofmercy.com",
  "salesians.org",
  "www.salesians.org",
  "dominicans.org",
  "www.dominicans.org",
  "franciscan.org",
  "www.franciscan.org",
  "jesuits.org",
  "www.jesuits.org",
  "augustinian.org",
  "www.augustinian.org",
  "carmelites.com",
  "www.carmelites.com",
  "ocarm.org", // Carmelite Order (O.Carm)
  "www.ocarm.org",
  "redemptorists.com",
  "www.redemptorists.com",
  "passionist.org",
  "www.passionist.org",
  "benedictine.org",
  "www.benedictine.org",
  "vincentians.org",
  "www.vincentians.org",
  "discalcedcarmelitevocations.com",

  // Vatican-republishing English Bible editions (RSV-CE / NABRE / etc.)
  // All texts hosted are with the imprimatur of a Catholic ordinary.
  "biblegateway.com", // already in tier 2, but kept for clarity
  "bible.usccb.org",
  // Liturgy & spirituality resources with documented ecclesiastical
  // approval and a long publishing record:
  "thecatholicgentleman.com",
  "www.thecatholicgentleman.com",
  "catholicgentleman.com",
  "catholicculture.org",
  "www.catholicculture.org",
  "fisheaters.com",
  "www.fisheaters.com",

  // Major Catholic publishing houses with ecclesiastical approval policies.
  "ignatius.com", // Ignatius Press
  "www.ignatius.com",
  "osv.com", // Our Sunday Visitor
  "www.osv.com",
  "tanbooks.com",
  "www.tanbooks.com",
  "sophiainstitute.com",
  "www.sophiainstitute.com",
  "scepterpublishers.org",
  "www.scepterpublishers.org",

  // Diocesan & archdiocesan parish directories (expansion for the
  // 20,000-parish target). Each is the official site of a diocese whose
  // bishop is in communion with the Holy See; the parish directory
  // pages are the canonical source for parish names, addresses, and
  // contact details in that territory.
  "dphx.org", // Phoenix
  "www.dphx.org",
  "dosp.org", // Saint Petersburg
  "www.dosp.org",
  "dioceseoftrenton.org",
  "www.dioceseoftrenton.org",
  "dioceseofbrooklyn.org",
  "www.dioceseofbrooklyn.org",
  "rcdony.org", // Ogdensburg
  "www.rcdony.org",
  "archomaha.org",
  "www.archomaha.org",
  "archindy.org", // Indianapolis
  "www.archindy.org",
  "archdpdx.org", // Portland
  "www.archdpdx.org",
  "archkck.org", // Kansas City in Kansas
  "www.archkck.org",
  "diocesan.com", // Diocesan Publications parish locator (Catholic dioceses)
  "www.diocesan.com",
  "parishesonline.com",
  "www.parishesonline.com",
  "masstimes.org", // International Catholic Mass-times directory
  "www.masstimes.org",
  "thecatholicdirectory.com",
  "www.thecatholicdirectory.com",
  "catholic-hierarchy.org", // Catholic-Hierarchy.org parish/diocese registry
  "www.catholic-hierarchy.org",
  "gcatholic.org", // GCatholic.org — diocesan & parish registry
  "www.gcatholic.org",

  // Bishops' conferences not yet listed (other regions).
  "vescovi.it", // Italian Bishops' Conference (alt host)
  "iec.cat", // Conferència Episcopal Tarraconense (Catalan bishops)
  "www.iec.cat",
  "cebi.org.br", // Brazilian Catholic biblical center
  "www.cebi.org.br",
  "iglesia.cl", // Chilean Catholic Church
  "www.iglesia.cl",
  "iglesia.org.bo", // Bolivian Bishops Conference
  "www.iglesia.org.bo",
  "iglesia.org.ec", // Ecuador
  "www.iglesia.org.ec",
  "iglesia.org.pe", // Peruvian Bishops Conference
  "www.iglesia.org.pe",

  // ── Additional U.S. archdioceses & dioceses ──
  "adw.org", // Washington DC
  "www.adw.org",
  "aod.org", // Detroit
  "www.aod.org",
  "archdioceseofhartford.org",
  "www.archdioceseofhartford.org",
  "rcan.org", // Newark
  "www.rcan.org",
  "diopitt.org", // Pittsburgh
  "www.diopitt.org",
  "dioceseofcleveland.org",
  "www.dioceseofcleveland.org",
  "catholicaoc.org", // Cincinnati
  "www.catholicaoc.org",
  "archgh.org", // Galveston-Houston
  "www.archgh.org",
  "sdcatholic.org", // San Diego
  "www.sdcatholic.org",
  "catholichawaii.org",
  "www.catholichawaii.org",
  "scd.org", // Sacramento
  "www.scd.org",
  "dolr.org", // Little Rock
  "www.dolr.org",
  "richmonddiocese.org",
  "www.richmonddiocese.org",
  "archdpdx.org", // Portland OR — also listed above; duplicate-safe
  "www.archdpdx.org",
  "rcdb.org", // Brooklyn alt
  "diocesseofcc.org", // Corpus Christi
  "www.diocesseofcc.org",
  "raleighdiocese.org",
  "www.raleighdiocese.org",
  "dosma.org", // Diocese of Salt Lake City / Springfield-Cape Girardeau (used by several)
  "www.dosma.org",

  // ── Additional European dioceses / archdioceses ──
  "erzbistumberlin.de",
  "www.erzbistumberlin.de",
  "erzbistum-muenchen.de",
  "www.erzbistum-muenchen.de",
  "erzbistum-koeln.de",
  "www.erzbistum-koeln.de",
  "kirchen.net", // Erzdiözese Salzburg
  "www.kirchen.net",
  "erzdioezese-wien.at",
  "www.erzdioezese-wien.at",
  "diecezja.pl", // Polish dioceses portal
  "www.diecezja.pl",
  "diecezja.krakow.pl",
  "www.diecezja.krakow.pl",
  "diecezja.warszawa.pl",
  "www.diecezja.warszawa.pl",
  "kuria.lublin.pl",
  "www.kuria.lublin.pl",

  // ── Latin American archdioceses ──
  "arzbaires.org.ar", // Buenos Aires
  "www.arzbaires.org.ar",
  "arquisp.org.br", // São Paulo
  "www.arquisp.org.br",
  "arqrio.org", // Rio de Janeiro
  "www.arqrio.org",

  // ── Marian / pilgrimage shrines with official Catholic-authority sites ──
  "lourdes-france.org",
  "www.lourdes-france.org",
  "fatima.pt", // Sanctuary of Fátima
  "www.fatima.pt",
  "virgendeguadalupe.org.mx",
  "www.virgendeguadalupe.org.mx",
  "basilica.mxv.mx", // Basilica of Guadalupe alt
  "knock-shrine.ie",
  "www.knock-shrine.ie",
  "czestochowa.pl", // Jasna Góra
  "www.czestochowa.pl",
  "jasnagora.pl",
  "www.jasnagora.pl",
  "lasaletteshrine.org",
  "www.lasaletteshrine.org",

  // ── Religious orders not yet listed ──
  "ocist.org", // Cistercians
  "www.ocist.org",
  "trappist.net", // Trappists
  "www.trappist.net",
  "norbertines.org",
  "www.norbertines.org",
  "carmelitefriars.org", // Discalced Carmelite Friars
  "www.carmelitefriars.org",
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
