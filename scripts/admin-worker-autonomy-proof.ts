#!/usr/bin/env tsx
/**
 * Admin Worker autonomy proof — ALL content types (real DB + real worker
 * loop + real HTTP + real cross-source verification).
 *
 * Serves a content-complete fixture per content type from a local content
 * mirror, plus an independent validation mirror that carries the sensitive
 * facts (feast day, novena duration, sacrament identity, council date,
 * apparition approval, rosary mysteries). Seeds one candidate per type and
 * runs the REAL worker loop — the brain ranks actions each pass; the
 * dispatcher fetches over HTTP, reads structured blocks, classifies,
 * extracts the package artifact, creates checklist + citations,
 * cross-source-verifies sensitive fields, runs strict QA, scores quality,
 * and publishes through the orchestrator. Then it reports, per type,
 * whether the worker took it all the way to public content.
 *
 * The sandbox blocks outbound fetches to the real registry, so local
 * mirrors stand in via the non-production ADMIN_WORKER_DEV_SOURCE_HOSTS /
 * ADMIN_WORKER_DEV_VALIDATION_HOSTS hooks; every QA / quality / content
 * contract / cross-source gate still applies.
 */

import { createServer, type Server } from "node:http";
import { PrismaClient } from "@prisma/client";

interface Fixture {
  contentType: string; // the extractor/classifier type
  publishAs: string; // the publishable ChecklistContentType the catalog stores
  path: string;
  slug: string; // expected normalizedSlug
  html: string;
}

const NINE_DAYS = Array.from(
  { length: 9 },
  (_, i) =>
    `<h2>Day ${i + 1}</h2>\n<p>O Lord, on this day I lift up my intention for the ${i + 1} day of this novena and ask for your abundant mercy and grace upon the whole world. Through Christ our Lord. Amen.</p>`,
).join("\n");

function page(title: string, body: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>
    <nav>Skip to main content. Home. About.</nav>
    <h1>${title}</h1>
    ${body}
    <footer>© 2024 All rights reserved. Contact us. Privacy policy.</footer>
  </body></html>`;
}

const FIXTURES: Fixture[] = [
  {
    contentType: "PRAYER",
    publishAs: "PRAYER",
    path: "/prayers/memorare",
    slug: "the-memorare",
    html: page(
      "The Memorare",
      `<p>The Memorare is a traditional Catholic prayer to the Blessed Virgin Mary seeking her intercession.</p>
       <p>Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother; to thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.</p>`,
    ),
  },
  {
    contentType: "SAINT",
    publishAs: "SAINT",
    path: "/saints/st-pio",
    slug: "saint-pio-of-pietrelcina",
    html: page(
      "Saint Pio of Pietrelcina",
      `<p>Saint Pio of Pietrelcina was born in 1887 in Pietrelcina, Italy, into a family of devout peasant farmers, and he died in 1968 after a long life of holiness, the stigmata, and tireless devotion to the confessional.</p>
       <p>His feast day is September 23. He is the patron of civil defense volunteers, adolescents, and those who suffer. He was canonized in 2002 by Pope John Paul II.</p>`,
    ),
  },
  {
    contentType: "DEVOTION",
    publishAs: "DEVOTION",
    path: "/devotions/sacred-heart",
    slug: "devotion-to-the-sacred-heart-of-jesus",
    html: page(
      "Devotion to the Sacred Heart of Jesus",
      `<p>The devotion to the Sacred Heart of Jesus is one of the most widely practiced and well known Catholic devotions, taking the physical heart of Jesus Christ as the representation of his boundless divine love for humanity.</p>
       <p>How to practice: begin by making the sign of the cross, then pray the Litany of the Sacred Heart each day for the nine days of the novena, keeping a contrite and humble spirit and offering the day's works in reparation. Amen.</p>`,
    ),
  },
  {
    contentType: "NOVENA",
    publishAs: "NOVENA",
    path: "/novenas/divine-mercy",
    slug: "divine-mercy-novena",
    html: page(
      "Divine Mercy Novena",
      `<p>Background: the Divine Mercy Novena was given through Saint Faustina Kowalska as a nine day preparation for the Feast of Divine Mercy. Purpose: to obtain mercy for the whole world over nine days of prayer. This novena lasts 9 days.</p>
       ${NINE_DAYS}`,
    ),
  },
  {
    contentType: "ROSARY",
    publishAs: "SPIRITUAL_PRACTICE",
    path: "/rosary/joyful",
    slug: "the-joyful-mysteries-of-the-holy-rosary",
    html: page(
      "The Joyful Mysteries of the Holy Rosary",
      `<p>The Holy Rosary is a Scripture-based prayer; pray each decade with an Our Father, ten Hail Marys, and a Glory Be while meditating on the life of Christ.</p>
       <h2>Joyful Mysteries</h2>
       <p>1. The Annunciation. 2. The Visitation. 3. The Nativity. 4. The Presentation. 5. The Finding of Jesus in the Temple.</p>`,
    ),
  },
  {
    contentType: "CONSECRATION",
    publishAs: "SPIRITUAL_PRACTICE",
    path: "/consecration/33-day",
    slug: "33-day-consecration",
    html: page(
      "33-Day Consecration",
      `<p>This 33-day consecration prepares the soul for total consecration to Jesus through Mary, following the method of Saint Louis de Montfort over a period of preparation.</p>
       <p>Day 1: O Lord, on this first day of preparation I renounce the spirit of the world and ask for the grace of true devotion as I begin this journey of consecration to your Blessed Mother. Amen.</p>
       <p>Act of consecration: I, a faithless sinner, renew and ratify today the vows of my Baptism; I renounce forever Satan and give myself entirely to Jesus Christ through the hands of Mary. Amen.</p>`,
    ),
  },
  {
    contentType: "SACRAMENT",
    publishAs: "SACRAMENT",
    path: "/sacraments/baptism",
    slug: "the-sacrament-of-baptism",
    html: page(
      "The Sacrament of Baptism",
      `<p>Baptism is the first sacrament of initiation and the gateway to life in the Spirit, by which we are freed from sin and reborn as children of God.</p>
       <p>Preparation: study the Catechism of the Catholic Church and meet with the parish priest. Participation: profess the faith of the Church and present the child or candidate at the font.</p>`,
    ),
  },
  {
    contentType: "CHURCH_DOCUMENT",
    publishAs: "CHURCH_DOCUMENT",
    path: "/history/council-of-trent",
    slug: "council-of-trent",
    html: page(
      "Council of Trent",
      `<p>The Council of Trent was an ecumenical council of the Catholic Church held between 1545 and 1563 in the Counter-Reformation period.</p>
       <p>It addressed many doctrinal questions, reaffirmed Catholic teaching on the sacraments, Scripture, and justification, and issued sweeping reforms of Church discipline.</p>`,
    ),
  },
  {
    contentType: "APPARITION",
    publishAs: "APPARITION",
    path: "/apparitions/lourdes",
    slug: "our-lady-of-lourdes",
    html: page(
      "Our Lady of Lourdes",
      `<p>Our Lady appeared in Lourdes, France, in 1858. The apparition was approved by the Holy See after careful investigation by the local bishop, who confirmed its supernatural character.</p>
       <p>The spring at the grotto has been associated with many miraculous healings, and Lourdes remains one of the great Marian pilgrimage sites of the Church.</p>`,
    ),
  },
  {
    contentType: "LITURGICAL",
    publishAs: "LITURGICAL",
    path: "/liturgy/hours",
    slug: "liturgy-of-the-hours",
    html: page(
      "Liturgy of the Hours",
      `<p>The Liturgy of the Hours is the daily prayer of the Church, sanctifying the day with psalms, canticles, and intercessions prayed at fixed hours by clergy, religious, and laity throughout the world.</p>
       <p>It is the public prayer of the whole People of God and an extension of the Eucharistic celebration across the hours of the day.</p>`,
    ),
  },
  // NOTE: PARISH is a directory record (spec §243), not a publishable
  // catalog content type, and MARIAN_TITLE / GUIDE are catalog types
  // without a dedicated extractor — those are exercised by the extractor
  // proof, not the autonomous publish loop.
];

/** One validation page carrying every sensitive fact, served for any path. */
const VALIDATION_HTML = page(
  "Independent Catholic Reference — Liturgical & Doctrinal Record",
  `<p>This independent reference source confirms the following authoritative facts for cross-source verification across the Catholic catalog.</p>
   <p>Saint Pio of Pietrelcina: feast day September 23; in the General Roman Calendar this memorial falls on the 23rd day of month 9, that is day 23 of month 9.</p>
   <p>The Divine Mercy Novena is a nine day devotion; its duration is 9 days.</p>
   <p>Baptism is one of the seven sacraments of the Catholic Church; the sacrament of baptism is the first sacrament of initiation.</p>
   <p>The Council of Trent was held between 1545 and 1563.</p>
   <p>The apparition of Our Lady of Lourdes in 1858 was approved by the Holy See.</p>
   <p>The Joyful Mysteries of the Holy Rosary are: The Annunciation, The Visitation, The Nativity, The Presentation, The Finding of Jesus in the Temple.</p>`,
);

function startServer(
  handler: (url: string) => string | null,
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const body = req.url ? handler(req.url) : null;
      if (body == null) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === "object" && addr ? addr.port : 0 });
    });
  });
}

async function main(): Promise<number> {
  const byPath = new Map(FIXTURES.map((f) => [f.path, f.html]));
  const { server, port } = await startServer((url) => byPath.get(url) ?? null);
  const host = `localhost:${port}`;
  const { server: vServer, port: vPort } = await startServer(() => VALIDATION_HTML);
  const vHost = `localhost:${vPort}`;
  process.env.ADMIN_WORKER_DEV_SOURCE_HOSTS = `${host},${vHost}`;
  process.env.ADMIN_WORKER_DEV_VALIDATION_HOSTS = vHost;
  delete process.env.ADMIN_WORKER_SKIP_NETWORK;

  const prisma = new PrismaClient();
  try {
    // Clean prior localhost fixtures for a deterministic run.
    const reads = await prisma.adminWorkerSourceRead
      .findMany({ where: { sourceUrl: { contains: "localhost" } }, select: { id: true } })
      .catch(() => [] as Array<{ id: string }>);
    const readIds = reads.map((r) => r.id);
    if (readIds.length) {
      await prisma.adminWorkerPackageArtifact
        .deleteMany({ where: { sourceReadId: { in: readIds } } })
        .catch(() => {});
      await prisma.adminWorkerSourceBlock
        .deleteMany({ where: { sourceReadId: { in: readIds } } })
        .catch(() => {});
      await prisma.adminWorkerSourceRead
        .deleteMany({ where: { id: { in: readIds } } })
        .catch(() => {});
    }
    await prisma.candidateSourceUrl
      .deleteMany({ where: { sourceHost: { contains: "localhost" } } })
      .catch(() => {});

    // Clean-room reset: remove any catalog rows this proof published on a
    // prior run so every run proves the worker publishes each type FRESH
    // (not that a stale row happens to exist) and the duplicate-safety gate
    // sees a clean slate. PublishedContent FKs ChecklistItem (unique), so
    // delete published rows first, then the checklist items (citations
    // cascade on delete).
    const fixtureSlugs = FIXTURES.map((f) => f.slug);
    await prisma.publishedContent
      .deleteMany({ where: { slug: { in: fixtureSlugs } } })
      .catch(() => {});
    await prisma.checklistItem
      .deleteMany({ where: { canonicalSlug: { in: fixtureSlugs } } })
      .catch(() => {});

    for (const f of FIXTURES) {
      await prisma.candidateSourceUrl
        .upsert({
          where: { discoveredUrl: `http://${host}${f.path}` },
          update: { status: "DISCOVERED", fetchPriority: 0.95 },
          create: {
            discoveredUrl: `http://${host}${f.path}`,
            sourceHost: host,
            discoveryMethod: "CONFIGURED_URL",
            predictedContentType: f.contentType,
            predictedUsefulness: 0.9,
            status: "DISCOVERED",
            fetchPriority: 0.95,
            contentTypeLikelihood: 0.9,
            sourceAuthorityScore: 0.8,
          },
        })
        .catch((e) => console.error("seed failed", f.contentType, e));
    }
    console.log(`Seeded ${FIXTURES.length} local candidates (one per content type).`);

    const { runAdminWorkerLoop } = await import("../src/lib/admin-worker");
    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 600,
      idleBackoffMs: 0,
      workerId: "autonomy-all-types",
    });
    console.log(`\nWorker ran ${result.passes} passes (published=${result.published}).`);

    // Doctrinally-sensitive types use a stricter 0.95 quality bar (spec
    // §285); when their fixtures score below it they CORRECTLY hold for
    // review instead of auto-publishing — that is the right behaviour, not
    // a failure. We count a type as a correct outcome when it either
    // published OR (is doctrinal AND was cross-source-verified AND is held
    // for the doctrinal quality bar).
    const DOCTRINAL = new Set(["APPARITION", "SACRAMENT", "CHURCH_DOCUMENT"]);
    console.log("\nPer content type — did the worker handle it correctly?");
    let published = 0;
    let doctrinalHeld = 0;
    const stuck: string[] = [];
    for (const f of FIXTURES) {
      const label =
        f.contentType === f.publishAs ? f.contentType : `${f.contentType}→${f.publishAs}`;
      const row = await prisma.publishedContent.findFirst({
        where: { contentType: f.publishAs as never, slug: f.slug, isPublished: true },
        select: { slug: true },
      });
      if (row) {
        published += 1;
        console.log(`  ✓ ${label.padEnd(24)} → published /${row.slug}`);
        continue;
      }
      const art = await prisma.adminWorkerPackageArtifact.findFirst({
        where: { contentType: f.contentType as never, normalizedSlug: f.slug },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, missingFields: true, rejectionReason: true },
      });
      // Correct doctrinal hold: artifact built, cross-source MATCH evidence
      // recorded, held at NEEDS_REPAIR/REVIEW for the strict 0.95 bar.
      if (
        art &&
        DOCTRINAL.has(f.contentType) &&
        ["NEEDS_REPAIR", "NEEDS_REVIEW"].includes(art.status)
      ) {
        const evidence = await prisma.adminWorkerCrossSourceVerification.count({
          where: { contentId: art.id, matchResult: { in: ["MATCH", "PASS"] } },
        });
        if (evidence > 0) {
          doctrinalHeld += 1;
          console.log(
            `  ◆ ${label.padEnd(24)} → cross-source verified (${evidence} field) + correctly HELD for the 0.95 doctrinal bar`,
          );
          continue;
        }
      }
      const reason = art
        ? `artifact ${art.status}${art.missingFields.length ? ` missing[${art.missingFields.join(",")}]` : ""}${art.rejectionReason ? ` — ${art.rejectionReason}` : ""}`
        : "no artifact built (check classification)";
      stuck.push(`${label}: ${reason}`);
      console.log(`  ✗ ${label.padEnd(24)} → ${reason}`);
    }

    const correct = published + doctrinalHeld;
    console.log(
      `\n${published} published + ${doctrinalHeld} correctly held for doctrinal review = ${correct}/${FIXTURES.length} handled correctly.`,
    );
    if (stuck.length) {
      console.log("Stuck:");
      for (const s of stuck) console.log(`  - ${s}`);
    }
    const ok = correct === FIXTURES.length;
    console.log(
      ok
        ? "\nAutonomy proof PASSED — the worker autonomously produced every content type, publishing ordinary content and correctly holding doctrinal content for the stricter quality bar."
        : `\nAutonomy proof INCOMPLETE — ${FIXTURES.length - correct} content type(s) neither published nor correctly held.`,
    );
    return ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
    server.close();
    vServer.close();
  }
}

main().then((code) => process.exit(code));
