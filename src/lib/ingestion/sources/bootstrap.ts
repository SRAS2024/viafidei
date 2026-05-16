import { prisma } from "../../db/client";
import { getAdapter, listAdapterKeys, registerAdapter } from "../registry";
import type { SourceAdapter } from "../types";
import { listApprovedHosts } from "./vatican-allowlist";
import { buildAllVaticanCrawlers } from "./vatican-adapters";

/**
 * For each adapter key, the set of secondary hosts the adapter walks
 * (in addition to the primary host in ADAPTER_HOST_MAP). Registering a
 * job row against each one means the admin dashboard can show non-zero
 * "N jobs" counts next to every source that genuinely contributes to
 * ingestion — not just the primary host.
 *
 * The list is curated rather than auto-derived because the index URL
 * lists inside each adapter are the source of truth — the bootstrap
 * file should not parse them. When a new index URL is added that lives
 * on a host not already covered here, add the host to the right
 * adapter entry below.
 */
const ADAPTER_SECONDARY_HOSTS: Record<string, ReadonlyArray<string>> = {
  "vatican.prayers": [
    "usccb.org",
    "cbcew.org.uk",
    "cccb.ca",
    "catholic.org.au",
    "catholicbishops.ie",
  ],
  "vatican.saints": [
    "usccb.org",
    "cccb.ca",
    "cbcew.org.uk",
    "catholic.org.au",
    "catholicbishops.ie",
    "archny.org",
    "rcab.org",
    "archchicago.org",
    "archphila.org",
    "ewtn.com",
    "catholicculture.org",
    "newadvent.org",
    "catholic.com",
    "osv.com",
  ],
  "vatican.apparitions": [
    "usccb.org",
    "cbcew.org.uk",
    "cccb.ca",
    "lourdes-france.org",
    "fatima.pt",
    "knock-shrine.ie",
    "virgendeguadalupe.org.mx",
    "basilica.mxv.mx",
    "czestochowa.pl",
    "jasnagora.pl",
    "lasaletteshrine.org",
  ],
  "vatican.devotions": [
    "usccb.org",
    "cbcew.org.uk",
    "thedivinemercy.org",
    "marian.org",
    "dominicans.org",
    "franciscan.org",
    "carmelites.com",
    "jesuits.org",
  ],
  "vatican.parishes": [
    "cccb.ca",
    "cbcew.org.uk",
    "catholic.org.au",
    "archny.org",
    "archchicago.org",
    "rcab.org",
    "archmil.org",
    "rcdow.org.uk",
    "lacatholics.org",
    "archphila.org",
    "archatl.com",
    "archbalt.org",
    "archstl.org",
    "archden.org",
    "miamiarch.org",
    "archsa.org",
    "sfarchdiocese.org",
    "seattlearchdiocese.org",
    "archtoronto.org",
    "diomelb.org.au",
    "sydneycatholic.org",
    "dublindiocese.ie",
    "dphx.org",
    "dosp.org",
    "dioceseoftrenton.org",
    "dioceseofbrooklyn.org",
    "rcdony.org",
    "archomaha.org",
    "archindy.org",
    "archdpdx.org",
    "archkck.org",
    "parishesonline.com",
    "masstimes.org",
    "thecatholicdirectory.com",
    "gcatholic.org",
    "catholic-hierarchy.org",
    "adw.org",
    "aod.org",
    "archdioceseofhartford.org",
    "rcan.org",
    "diopitt.org",
    "dioceseofcleveland.org",
    "catholicaoc.org",
    "archgh.org",
    "sdcatholic.org",
    "catholichawaii.org",
    "scd.org",
    "dolr.org",
    "richmonddiocese.org",
    "diocesseofcc.org",
    "raleighdiocese.org",
    "dosma.org",
    "rcdea.org.uk",
    "erzbistumberlin.de",
    "erzbistum-muenchen.de",
    "erzbistum-koeln.de",
    "kirchen.net",
    "erzdioezese-wien.at",
    "diecezja.pl",
    "diecezja.krakow.pl",
    "diecezja.warszawa.pl",
    "kuria.lublin.pl",
    "archimadrid.es",
    "diocesimilano.it",
    "diocesedeparis.fr",
    "arquisp.org.br",
    "arqrio.org",
    "arzbaires.org.ar",
  ],
  "bishops.saints": [
    "cccb.ca",
    "cbcew.org.uk",
    "catholic.org.au",
    "catholicbishops.ie",
    "archny.org",
    "rcab.org",
    "archchicago.org",
    "catholic.org.nz",
    "cbcp.net",
    "sacbc.org.za",
    "cbcindia.com",
    "dbk.de",
    "conferenciaepiscopal.es",
    "chiesacattolica.it",
    "eglise.catholique.fr",
    "episcopado.pt",
    "episkopat.pl",
    "cnbb.org.br",
    "celam.org",
    "archphila.org",
    "archatl.com",
    "archbalt.org",
    "archstl.org",
    "lacatholics.org",
    "archtoronto.org",
    "sydneycatholic.org",
    "dublindiocese.ie",
  ],
  "catholic.devotions": [
    "cbcew.org.uk",
    "cccb.ca",
    "catholic.org.au",
    "catholicbishops.ie",
    "catholic.org.nz",
    "cbcp.net",
    "dbk.de",
    "conferenciaepiscopal.es",
    "chiesacattolica.it",
    "eglise.catholique.fr",
    "episkopat.pl",
    "cnbb.org.br",
  ],
  "catholic.prayers": [
    "cbcew.org.uk",
    "catholic.org.au",
    "catholicbishops.ie",
    "cccb.ca",
    "catholic.org.nz",
    "cbcp.net",
    "sacbc.org.za",
    "dbk.de",
    "conferenciaepiscopal.es",
    "chiesacattolica.it",
    "eglise.catholique.fr",
    "episcopado.pt",
    "episkopat.pl",
    "cnbb.org.br",
    "katolsk.no",
  ],
  "credible.prayers": [
    "catholicculture.org",
    "kofc.org",
    "thedivinemercy.org",
    "marian.org",
    "dominicans.org",
    "franciscan.org",
    "jesuits.org",
    "salesians.org",
    "carmelites.com",
    "redemptorists.com",
    "osv.com",
    "catholic.com",
    "augustinian.org",
    "benedictine.org",
    "passionist.org",
    "vincentians.org",
    "norbertines.org",
    "carmelitefriars.org",
    "trappist.net",
    "fathersofmercy.com",
    "wordonfire.org",
    "ascensionpress.com",
    "ignatius.com",
    "sophiainstitute.com",
    "tanbooks.com",
    "scepterpublishers.org",
  ],
  "credible.saints": [
    "catholicculture.org",
    "dominicans.org",
    "franciscan.org",
    "jesuits.org",
    "salesians.org",
    "carmelites.com",
    "redemptorists.com",
    "osv.com",
    "catholic.com",
    "newadvent.org",
    "augustinian.org",
    "benedictine.org",
    "passionist.org",
    "vincentians.org",
    "norbertines.org",
    "carmelitefriars.org",
    "trappist.net",
    "ocist.org",
    "wordonfire.org",
    "ignatius.com",
    "sophiainstitute.com",
    "tanbooks.com",
    "thecatholicthing.org",
    "ncregister.com",
    "catholicnewsagency.com",
  ],
  "vatican.teaching": [
    "usccb.org",
    "cbcew.org.uk",
    "cccb.ca",
    "newadvent.org",
    "catholicculture.org",
    "catholic.com",
    "wordonfire.org",
    "ascensionpress.com",
  ],
  "vatican.guides": [
    "usccb.org",
    "cbcew.org.uk",
    "cccb.ca",
    "catholic.org.au",
    "thedivinemercy.org",
    "marian.org",
    "osv.com",
    "ascensionpress.com",
    "sophiainstitute.com",
    "wordonfire.org",
    "discalcedcarmelitevocations.com",
    "dominicans.org",
    "franciscan.org",
    "jesuits.org",
  ],
  "vatican.history": [
    "usccb.org",
    "newadvent.org",
    "catholicculture.org",
    "catholic-hierarchy.org",
    "gcatholic.org",
  ],
};

/**
 * Mapping from adapter keys to their primary upstream host. Used so the
 * scheduler always has an IngestionSource + IngestionJob row backing each
 * registered adapter.
 *
 * Hosts here are mirrored from the Vatican allowlist; if you add an adapter
 * that pulls from a new host, also add it to vatican-allowlist.ts.
 */
const ADAPTER_HOST_MAP: Record<string, { host: string; baseUrl: string; name: string }> = {
  "vatican.prayers": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Prayers",
  },
  "vatican.saints": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Saints",
  },
  "vatican.apparitions": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Apparitions",
  },
  "vatican.devotions": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Devotions",
  },
  "vatican.parishes": {
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    name: "USCCB — Parish Directory",
  },
  "bishops.saints": {
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    name: "Bishops' Conferences — Saints",
  },
  "catholic.devotions": {
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    name: "Catholic Devotional Content",
  },
  "catholic.prayers": {
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    name: "Catholic Prayer Catalog",
  },
  "vatican.teaching": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Catechesis & Liturgy",
  },
  "vatican.guides": {
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    name: "USCCB — Spiritual Life Guides",
  },
  "vatican.history": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Church History & Councils",
  },
  "credible.prayers": {
    host: "ewtn.com",
    baseUrl: "https://www.ewtn.com",
    name: "Credible Catholic — Prayers",
  },
  "credible.saints": {
    host: "ewtn.com",
    baseUrl: "https://www.ewtn.com",
    name: "Credible Catholic — Saints",
  },
  "vatican.councils": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Ecumenical Councils",
  },
  "vatican.catechism": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Catechism of the Catholic Church",
  },
  "vatican.canonlaw": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Code of Canon Law (CIC 1983 + CCEO 1990)",
  },
  "vatican.encyclicals": {
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    name: "The Holy See — Papal Encyclicals",
  },
};

const ADAPTER_TARGET_ENTITY: Record<string, string> = {
  "vatican.prayers": "Prayer",
  "vatican.saints": "Saint",
  "vatican.apparitions": "MarianApparition",
  "vatican.devotions": "Devotion",
  "vatican.parishes": "Parish",
  "bishops.saints": "Saint",
  "catholic.devotions": "Devotion",
  "catholic.prayers": "Prayer",
  "vatican.teaching": "LiturgyEntry",
  "vatican.guides": "SpiritualLifeGuide",
  "vatican.history": "LiturgyEntry",
  "credible.prayers": "Prayer",
  "credible.saints": "Saint",
  "vatican.councils": "LiturgyEntry",
  "vatican.catechism": "LiturgyEntry",
  "vatican.canonlaw": "LiturgyEntry",
  "vatican.encyclicals": "LiturgyEntry",
};

let registered = false;

/**
 * Idempotent: register all built-in Vatican adapters into the in-memory
 * registry. Safe to call from cron handlers, the admin UI, or tests.
 */
export function registerVaticanAdapters(): SourceAdapter[] {
  const adapters = buildAllVaticanCrawlers();
  for (const adapter of adapters) {
    if (!getAdapter(adapter.key)) {
      registerAdapter(adapter);
    }
  }
  registered = true;
  return adapters;
}

/**
 * Ensures every Vatican-allowlisted host is represented as an
 * IngestionSource, and every registered adapter has a matching
 * IngestionJob, so the scheduler picks them up automatically.
 *
 * Existing rows (e.g. ones a human admin enabled/disabled) are not
 * overwritten — we only insert what is missing.
 */
export async function ensureVaticanSchedule(): Promise<void> {
  registerVaticanAdapters();

  const hosts = listApprovedHosts();
  for (const host of hosts) {
    const baseUrl = `https://${host.replace(/^www\./, "www.")}`;
    await prisma.ingestionSource.upsert({
      where: { host },
      create: {
        host,
        name: deriveName(host),
        baseUrl,
        sourceType: "web-crawler",
        isOfficial: true,
        rateLimitPerMin: 30,
      },
      update: { isOfficial: true },
    });
  }

  for (const key of listAdapterKeys()) {
    const meta = ADAPTER_HOST_MAP[key];
    if (!meta) continue;
    // Register ONE job per adapter against its primary host. The adapter's
    // internal index URL list still walks every secondary host it knows
    // about (see ADAPTER_SECONDARY_HOSTS for the documented set) — those
    // fetches go through the allowlist gate and end up in the same
    // IngestionJobRun under the primary host. Registering one job per
    // secondary host would cause `runAllActiveJobs()` to invoke the same
    // adapter once per host per tick, multiplying HTTP load with no
    // additional content.
    const source = await prisma.ingestionSource.findUnique({ where: { host: meta.host } });
    if (!source) continue;
    const existing = await prisma.ingestionJob.findFirst({
      where: { sourceId: source.id, jobName: key },
    });
    if (existing) continue;
    await prisma.ingestionJob.create({
      data: {
        sourceId: source.id,
        jobName: key,
        targetEntity: ADAPTER_TARGET_ENTITY[key] ?? "Unknown",
        // Run hourly. Cron itself is invoked by the platform; this string is
        // metadata only — actual frequency is controlled by the cron caller.
        schedule: "@hourly",
        isActive: true,
      },
    });
  }
}

/**
 * Exposes the secondary-host mapping so the admin Sources page can
 * surface "walked by adapter X" hints next to hosts that don't have a
 * registered IngestionJob row but still participate in ingestion via
 * one of the multi-source adapters above.
 */
export function listAdapterSecondaryHosts(): Readonly<Record<string, ReadonlyArray<string>>> {
  return ADAPTER_SECONDARY_HOSTS;
}

function deriveName(host: string): string {
  if (host.includes("vatican.va")) return "The Holy See";
  if (host.includes("vaticannews.va")) return "Vatican News";
  if (host.includes("osservatoreromano.va")) return "L'Osservatore Romano";
  if (host.includes("synod.va") || host.includes("synod2")) return "Synod of Bishops";
  if (host.includes("dicastery") || host.includes("doctrineoffaith.va")) return "Vatican Dicastery";
  if (host.includes("vaticanlibrary.va")) return "Vatican Apostolic Library";
  if (host.includes("vaticanobservatory.va")) return "Vatican Observatory";
  if (host.includes("vaticanstate.va")) return "Vatican City State";
  if (host.includes("museivaticani.va")) return "Vatican Museums";
  if (host.includes("clerus.va")) return "Vatican — Congregation for the Clergy";
  if (host.includes("usccb.org")) return "USCCB";
  if (host.includes("cccb.ca")) return "CCCB — Canadian Conference of Catholic Bishops";
  if (host.includes("cbcew.org.uk")) return "CBCEW — England & Wales";
  if (host.includes("catholicbishops.ie")) return "Irish Catholic Bishops' Conference";
  if (host.includes("catholic.org.au")) return "Australian Catholic Bishops Conference";
  if (host.includes("catholic.org.nz")) return "NZ Catholic Bishops Conference";
  if (host.includes("cbcp.net")) return "CBCP — Philippine Bishops";
  if (host.includes("sacbc.org.za")) return "SACBC — Southern African Bishops";
  if (host.includes("cbcindia.com")) return "CBCI — Catholic Bishops' Conference of India";
  if (host.includes("dbk.de")) return "Deutsche Bischofskonferenz";
  if (host.includes("conferenciaepiscopal.es")) return "Conferencia Episcopal Española";
  if (host.includes("chiesacattolica.it")) return "Conferenza Episcopale Italiana";
  if (host.includes("eglise.catholique.fr")) return "Conférence des évêques de France";
  if (host.includes("episcopado.pt")) return "Conferência Episcopal Portuguesa";
  if (host.includes("episkopat.pl")) return "Konferencja Episkopatu Polski";
  if (host.includes("celam.org")) return "CELAM — Latin American Episcopal Council";
  if (host.includes("cebmexico.org")) return "CEM — Mexican Episcopal Conference";
  if (host.includes("cnbb.org.br")) return "CNBB — Brazilian Bishops Conference";
  if (host.includes("episcopadoargentino")) return "Argentine Episcopal Conference";
  if (host.includes("katolsk.no")) return "Den katolske kirke i Norge";
  if (host.includes("archny.org")) return "Archdiocese of New York";
  if (host.includes("archchicago.org")) return "Archdiocese of Chicago";
  if (host.includes("rcab.org")) return "Archdiocese of Boston";
  if (host.includes("archmil.org")) return "Archdiocese of Milwaukee";
  if (host.includes("rcdow.org.uk")) return "Archdiocese of Westminster";
  if (host.includes("rcaola.org") || host.includes("lacatholics.org"))
    return "Archdiocese of Los Angeles";
  if (host.includes("ewtn.com")) return "EWTN — Catholic Reference";
  if (host.includes("biblegateway.com") || host.includes("biblia.com")) return "Bible reference";
  if (host.includes("drbo.org")) return "Douay-Rheims Bible Online";
  if (host.includes("liturgicalcalendar.org")) return "Liturgical Calendar";
  if (host.includes("ibreviary.com")) return "iBreviary";
  if (host.includes("universalis.com")) return "Universalis — Liturgy of the Hours";
  if (host.includes("ccwatershed.org")) return "Corpus Christi Watershed";
  if (host.includes("icel.org")) return "ICEL — International Commission on English in the Liturgy";
  if (host.includes("magnificat.net")) return "Magnificat";
  if (host.includes("pul.urbe.it")) return "Pontifical Lateran University";
  if (host.includes("unigre.it")) return "Pontifical Gregorian University";
  if (host.includes("santacroce.it")) return "Pontifical University of the Holy Cross";
  if (host.includes("newadvent.org")) return "New Advent — Catholic Encyclopedia";
  if (host.includes("ccel.org")) return "Christian Classics Ethereal Library (Patristic)";
  if (host.includes("thedivinemercy.org") || host.includes("marian.org"))
    return "Marian Fathers — Divine Mercy";
  if (host.includes("knightsofcolumbus.org") || host.includes("kofc.org"))
    return "Knights of Columbus";
  if (host.includes("dominicans.org")) return "Order of Preachers (Dominicans)";
  if (host.includes("franciscan.org")) return "Franciscan Friars";
  if (host.includes("jesuits.org")) return "Society of Jesus (Jesuits)";
  if (host.includes("salesians.org")) return "Salesians of Don Bosco";
  if (host.includes("carmelites.com") || host.includes("ocarm.org")) return "Carmelite Order";
  if (host.includes("redemptorists.com")) return "Congregation of the Most Holy Redeemer";
  if (host.includes("passionist.org")) return "Passionist Congregation";
  if (host.includes("benedictine.org")) return "Benedictine Order";
  if (host.includes("vincentians.org")) return "Congregation of the Mission (Vincentians)";
  if (host.includes("augustinian.org")) return "Augustinian Order";
  if (host.includes("fathersofmercy.com")) return "Fathers of Mercy";
  if (host.includes("ignatius.com")) return "Ignatius Press";
  if (host.includes("osv.com")) return "Our Sunday Visitor";
  if (host.includes("tanbooks.com")) return "TAN Books";
  if (host.includes("sophiainstitute.com")) return "Sophia Institute Press";
  if (host.includes("scepterpublishers.org")) return "Scepter Publishers";
  if (host.includes("catholicculture.org")) return "Catholic Culture";
  if (host.includes("catholicnewsagency.com")) return "Catholic News Agency";
  if (host.includes("ncregister.com")) return "National Catholic Register";
  if (host.includes("catholicworldreport.com")) return "Catholic World Report";
  if (host.includes("thecatholicthing.org")) return "The Catholic Thing";
  if (host.includes("wordonfire.org")) return "Word on Fire";
  if (host.includes("ascensionpress.com")) return "Ascension";
  if (host.includes("catholic.com")) return "Catholic Answers";
  if (host.includes("dphx.org")) return "Diocese of Phoenix";
  if (host.includes("dosp.org")) return "Diocese of Saint Petersburg";
  if (host.includes("dioceseoftrenton.org")) return "Diocese of Trenton";
  if (host.includes("dioceseofbrooklyn.org")) return "Diocese of Brooklyn";
  if (host.includes("rcdony.org")) return "Diocese of Ogdensburg";
  if (host.includes("archomaha.org")) return "Archdiocese of Omaha";
  if (host.includes("archindy.org")) return "Archdiocese of Indianapolis";
  if (host.includes("archdpdx.org")) return "Archdiocese of Portland (OR)";
  if (host.includes("archkck.org")) return "Archdiocese of Kansas City in Kansas";
  if (host.includes("parishesonline.com")) return "Parishes Online (Catholic locator)";
  if (host.includes("masstimes.org")) return "Mass-Times Catholic Directory";
  if (host.includes("thecatholicdirectory.com")) return "The Catholic Directory";
  if (host.includes("catholic-hierarchy.org")) return "Catholic-Hierarchy.org";
  if (host.includes("gcatholic.org")) return "GCatholic Registry";
  return host;
}

export function hasRegisteredAdapters(): boolean {
  return registered;
}
