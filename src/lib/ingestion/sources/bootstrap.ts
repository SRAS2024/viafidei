import { prisma } from "../../db/client";
import { getAdapter, listAdapterKeys, registerAdapter } from "../registry";
import type { SourceAdapter } from "../types";
import { listApprovedHosts } from "./vatican-allowlist";
import { buildAllVaticanCrawlers } from "./vatican-adapters";

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
};

const ADAPTER_TARGET_ENTITY: Record<string, string> = {
  "vatican.prayers": "Prayer",
  "vatican.saints": "Saint",
  "vatican.apparitions": "MarianApparition",
  "vatican.devotions": "Devotion",
  "vatican.parishes": "Parish",
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

function deriveName(host: string): string {
  if (host.includes("vatican.va")) return "The Holy See";
  if (host.includes("vaticannews.va")) return "Vatican News";
  if (host.includes("osservatoreromano.va")) return "L'Osservatore Romano";
  if (host.includes("synod.va") || host.includes("synod2")) return "Synod of Bishops";
  if (host.includes("dicastery") || host.includes("doctrineoffaith.va")) return "Vatican Dicastery";
  if (host.includes("vaticanlibrary.va")) return "Vatican Apostolic Library";
  if (host.includes("vaticanobservatory.va")) return "Vatican Observatory";
  if (host.includes("vaticanstate.va")) return "Vatican City State";
  if (host.includes("usccb.org")) return "USCCB";
  if (host.includes("cccb.ca")) return "CCCB — Canadian Conference of Catholic Bishops";
  if (host.includes("cbcew.org.uk")) return "CBCEW — England & Wales";
  if (host.includes("catholicbishops.ie")) return "Irish Catholic Bishops' Conference";
  if (host.includes("catholic.org.au")) return "Australian Catholic Bishops Conference";
  if (host.includes("catholic.org.nz")) return "NZ Catholic Bishops Conference";
  if (host.includes("dbk.de")) return "Deutsche Bischofskonferenz";
  if (host.includes("conferenciaepiscopal.es")) return "Conferencia Episcopal Española";
  if (host.includes("chiesacattolica.it")) return "Conferenza Episcopale Italiana";
  if (host.includes("eglise.catholique.fr")) return "Conférence des évêques de France";
  if (host.includes("episcopado.pt")) return "Conferência Episcopal Portuguesa";
  if (host.includes("episkopat.pl")) return "Konferencja Episkopatu Polski";
  if (host.includes("celam.org")) return "CELAM — Latin American Episcopal Council";
  if (host.includes("ewtn.com")) return "EWTN — Catholic Reference";
  if (host.includes("biblegateway.com") || host.includes("biblia.com")) return "Bible reference";
  if (host.includes("liturgicalcalendar.org")) return "Liturgical Calendar";
  if (host.includes("ibreviary.com")) return "iBreviary";
  if (host.includes("universalis.com")) return "Universalis — Liturgy of the Hours";
  if (host.includes("ccwatershed.org")) return "Corpus Christi Watershed";
  if (host.includes("icel.org")) return "ICEL — International Commission on English in the Liturgy";
  return host;
}

export function hasRegisteredAdapters(): boolean {
  return registered;
}
