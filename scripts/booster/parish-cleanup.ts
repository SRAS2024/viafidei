#!/usr/bin/env tsx
/**
 * Booster: correct parish records that a quality audit found wrong.
 *
 *   1. OpenStreetMap copies of the hand-curated landmark churches (St Peter's,
 *      the Lateran, Guadalupe, Cologne Cathedral, ...): the curated row is the
 *      keeper; the OSM row within 60 m that names the same church is unpublished.
 *   2. Records whose whole name is a generic descriptor ("Kaplica domowa" -
 *      house chapel, "Kaplica szpitalna", "Kapelle", "Chapelle", ...): they name
 *      a kind of chapel, not a place a reader can identify.
 *   3. "major-basilica" outside Rome: only the four papal basilicas, all in
 *      Rome / Vatican City, are major basilicas. A church elsewhere that shares
 *      a dedication ("Santa Maria Maggiore") becomes a minor basilica when its
 *      name says basilica, otherwise a parish church.
 *
 * Nothing is deleted. An unpublished row keeps its payload plus
 * `_meta.excluded {reason, at, by}`, and its OSM id gets a one-year skip so no
 * sweep republishes it. Designation fixes go through applyProtectedContentUpdate.
 * Every action is logged to AdminWorkerLog (`booster_parish_cleanup`).
 *
 * usage: tsx scripts/booster/parish-cleanup.ts [--apply]
 */

process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
process.env.INTELLIGENCE_BRAIN_ENABLED = "0";

import { PrismaClient } from "@prisma/client";

import { applyProtectedContentUpdate } from "../../src/lib/admin-worker/content-protection";
import { writeAdminWorkerLog } from "../../src/lib/admin-worker/logs";
import { writeOsmSkip } from "../../src/lib/admin-worker/parish-osm";

const APPLY = process.argv.includes("--apply");
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const GENERIC_NAMES = new Set([
  "kaplica domowa",
  "kaplica szpitalna",
  "kaplica dojazdowa",
  "kaplica cmentarna",
  "kaplica zakonna",
  "kaplica publiczna",
  "kaplica prywatna",
  "kaplica filialna",
  "kaplica",
  "kapliczka",
  "hauskapelle",
  "krankenhauskapelle",
  "schulkapelle",
  "klosterkapelle",
  "kapelle",
  "chapelle",
  "chapelle de l'hôpital",
  "chapelle de l'hopital",
  "chapelle privée",
  "chapel",
  "hospital chapel",
  "house chapel",
  "private chapel",
  "convent chapel",
  "capilla",
  "capilla del hospital",
  "cappella",
  "cappella dell'ospedale",
  "cappella privata",
  "kapel",
  "kapela",
  "capela",
  "kaple",
]);

function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Words that tie a local-language landmark name to its curated English one. */
const LANDMARK_KEYS: Record<string, RegExp> = {
  "basilica-saint-peter-vatican": /san pietro|saint peter|st\.? peter/i,
  "archbasilica-saint-john-lateran": /laterano|lateran/i,
  "basilica-saint-mary-major": /maria maggiore|mary major/i,
  "basilica-saint-paul-outside-the-walls": /san paolo fuori|paul outside/i,
  "basilica-of-saint-francis-of-assisi": /francesco d'assisi|francis of assisi/i,
  "basilica-our-lady-of-guadalupe-mexico-city": /bas[ií]lica de santa mar[ií]a de guadalupe/i,
  "cathedral-saint-patrick-new-york": /patrick/i,
  "cologne-cathedral": /k[öo]lner dom|hohe domkirche/i,
  "milan-cathedral": /duomo di milano/i,
  "saint-marys-cathedral-sydney": /mary'?s cathedral/i,
  "cathedral-notre-dame-de-paris": /notre[- ]dame de paris/i,
  "basilica-sagrada-familia-barcelona": /sagrada fam[ií]lia/i,
  "basilica-sacred-heart-montmartre": /sacr[ée][- ]c(œ|oe)ur/i,
  "westminster-cathedral":
    /westminster cathedral|metropolitan cathedral of the most precious blood/i,
  "cathedral-of-santiago-de-compostela": /catedral de santiago/i,
  "basilica-of-saint-anthony-padua": /basilica (pontificia )?di sant'antonio/i,
  "basilica-of-the-holy-house-loreto": /santa casa/i,
  "basilica-national-shrine-our-lady-aparecida": /aparecida/i,
  "basilica-national-shrine-immaculate-conception": /immaculate conception/i,
  "sanctuary-of-fatima": /bas[ií]lica de nossa senhora do ros[áa]rio|santu[áa]rio de f[áa]tima/i,
  "sanctuary-our-lady-of-lourdes":
    /basilique (notre-dame du rosaire|de l'immacul[ée]e conception)|sanctuaire/i,
  "shrine-of-our-lady-of-czestochowa-jasna-gora": /jasna g[óo]ra|jasnog[óo]rsk/i,
  "basilica-of-the-annunciation-nazareth": /annunciation|annunziazione/i,
  "church-of-the-holy-sepulchre-jerusalem": /holy sepulchre|santo sepolcro/i,
  "cathedral-basilica-saint-louis": /cathedral basilica of saint louis/i,
  "basilica-saint-mary-minneapolis": /basilica of (saint|st\.?) mary/i,
};

async function main() {
  const prisma = new PrismaClient();
  const now = new Date();
  const out = { landmarkDuplicates: [] as string[], generic: 0, basilicaFixed: [] as string[] };

  const unpublish = async (
    row: { id: string; slug: string; title: string; sourceRef: string | null; payload: unknown },
    reason: string,
  ) => {
    if (!APPLY) return;
    const payload = { ...((row.payload as Record<string, unknown>) ?? {}) };
    const meta = { ...((payload._meta as Record<string, unknown>) ?? {}) };
    meta.excluded = { reason, at: now.toISOString(), by: "booster-parish-cleanup" };
    payload._meta = meta;
    await prisma.publishedContent.update({
      where: { id: row.id },
      data: { isPublished: false, unpublishedAt: now, payload: payload as never },
    });
    if (row.sourceRef) await writeOsmSkip(prisma, row.sourceRef, reason, YEAR_MS);
    await writeOsmSkip(prisma, row.slug, reason, YEAR_MS);
  };

  // 1. Landmark duplicates.
  const curated = await prisma.publishedContent.findMany({
    where: { contentType: "PARISH" as never, sourceRef: null, isPublished: true },
    select: { slug: true, title: true, latitude: true, longitude: true },
  });
  for (const c of curated) {
    const key = LANDMARK_KEYS[c.slug];
    if (!key || typeof c.latitude !== "number" || typeof c.longitude !== "number") continue;
    const near = await prisma.publishedContent.findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        sourceRef: { not: null },
        latitude: { gte: c.latitude - 0.003, lte: c.latitude + 0.003 },
        longitude: { gte: c.longitude - 0.004, lte: c.longitude + 0.004 },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        sourceRef: true,
        payload: true,
        latitude: true,
        longitude: true,
      },
    });
    for (const r of near) {
      const d = metres(c.latitude, c.longitude, r.latitude ?? 0, r.longitude ?? 0);
      if (d > 120 || !key.test(r.title)) continue;
      out.landmarkDuplicates.push(`${r.title} (${r.sourceRef}, ${Math.round(d)} m) -> ${c.slug}`);
      await unpublish(r, `duplicate of the curated landmark ${c.slug}`);
    }
  }

  // 2. Generic descriptor names (whole name).
  const generic = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select id from "PublishedContent" where "contentType"='PARISH' and "isPublished" and lower(btrim(title)) = any($1::text[])`,
    [...GENERIC_NAMES],
  );
  for (const { id } of generic) {
    const r = await prisma.publishedContent.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, sourceRef: true, payload: true },
    });
    if (!r) continue;
    out.generic += 1;
    await unpublish(r, "the name is a generic descriptor, not a place a reader can identify");
  }

  // 3. Major basilicas outside Rome / Vatican City.
  const majorIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select id from "PublishedContent" where "contentType"='PARISH' and "isPublished" and payload->>'designation' = 'major-basilica'`,
  );
  const majors = await prisma.publishedContent.findMany({
    where: { id: { in: majorIds.map((m) => m.id) } },
    select: { id: true, slug: true, title: true, latitude: true, longitude: true, payload: true },
  });
  for (const r of majors) {
    const p = (r.payload as Record<string, unknown>) ?? {};
    if (p.designation !== "major-basilica") continue;
    const lat = r.latitude ?? 0;
    const lon = r.longitude ?? 0;
    if (lat > 41.79 && lat < 41.99 && lon > 12.35 && lon < 12.62) continue;
    const next = /\bbasilic|bas[ií]lica|basilika|bazylika|basilique|bazilika/i.test(r.title)
      ? "minor-basilica"
      : /\b(shrine|santuario|santu[áa]rio|sanctuaire|sanktuarium|wallfahrtskirche)\b/i.test(r.title)
        ? "shrine"
        : "parish";
    out.basilicaFixed.push(`${r.title} -> ${next}`);
    if (!APPLY) continue;
    await applyProtectedContentUpdate(prisma, {
      contentId: r.id,
      proposedPayload: { ...p, designation: next },
      reason: "booster-parish-cleanup: only the four papal basilicas in Rome are major basilicas",
      qualityScore: 0.9,
      evidenceCount: 1,
      allowReplace: true,
    }).catch(() => null);
  }

  console.log(JSON.stringify({ apply: APPLY, ...out }, null, 1));
  if (APPLY) {
    await writeAdminWorkerLog(prisma, {
      category: "CLEANUP",
      severity: "WARN",
      eventName: "booster_parish_cleanup",
      contentType: "PARISH",
      message: `Booster parish cleanup: unpublished ${out.landmarkDuplicates.length} OSM copies of curated landmarks and ${out.generic} generic-named records; re-designated ${out.basilicaFixed.length} non-papal "major basilicas".`,
      safeMetadata: {
        landmarkDuplicates: out.landmarkDuplicates,
        generic: out.generic,
        basilicaFixed: out.basilicaFixed,
      },
    }).catch(() => undefined);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[parish-cleanup] fatal:", err);
  process.exitCode = 1;
});
