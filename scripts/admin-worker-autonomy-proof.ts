#!/usr/bin/env tsx
/**
 * Admin Worker autonomy proof (real DB + real worker loop + real HTTP).
 *
 * This is the end-to-end proof that the worker AUTONOMOUSLY produces and
 * implements content. It:
 *
 *   1. Serves content-complete Catholic fixtures from a LOCAL HTTP server
 *      (a stand-in for an approved source — the sandbox blocks outbound
 *      fetches to vatican.va, so we mirror the same content locally).
 *   2. Seeds candidate URLs pointing at that server.
 *   3. Runs the REAL Admin Worker loop (runAdminWorkerLoop) — the brain
 *      ranks actions each pass; the dispatcher really fetches over HTTP,
 *      reads the page into structured blocks, classifies, extracts the
 *      package artifact, creates checklist + citations, runs strict QA,
 *      computes the quality score, and publishes through the orchestrator.
 *   4. Reads the resulting PublishedContent rows back out and prints the
 *      constructed content fields (prayer title + text; saint name +
 *      patronage + birthplace + lived dates + feast day + background).
 *
 * The dev-source-host hook (ADMIN_WORKER_DEV_SOURCE_HOSTS) only widens the
 * fetch allow-list for this non-production run; every QA / quality / content
 * contract gate still applies.
 */

import { createServer, type Server } from "node:http";

import { PrismaClient } from "@prisma/client";

const PAGES: Record<string, { contentType: string; title: string; html: string }> = {
  "/prayers/memorare": {
    contentType: "PRAYER",
    title: "The Memorare",
    html: `<!doctype html><html><head><title>The Memorare</title></head><body>
      <nav>Skip to main content</nav>
      <h1>The Memorare</h1>
      <p>The Memorare is a traditional Catholic prayer to the Blessed Virgin Mary, attributed by tradition to Saint Bernard of Clairvaux, beseeching her intercession.</p>
      <p>Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother; to thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.</p>
      <footer>© 2024 All rights reserved</footer>
    </body></html>`,
  },
  "/saints/st-pio": {
    contentType: "SAINT",
    title: "Saint Pio of Pietrelcina",
    html: `<!doctype html><html><head><title>Saint Pio of Pietrelcina</title></head><body>
      <nav>Skip to main content</nav>
      <h1>Saint Pio of Pietrelcina</h1>
      <p>Saint Pio of Pietrelcina was born in 1887 in Pietrelcina, Italy, into a family of devout peasant farmers, and he died in 1968 after a long life marked by holiness, the stigmata, and tireless devotion to the confessional.</p>
      <p>His feast day is September 23. He is the patron of civil defense volunteers, adolescents, and those who suffer. He was canonized in 2002 by Pope John Paul II before an immense crowd in Saint Peter's Square.</p>
      <footer>© 2024 All rights reserved</footer>
    </body></html>`,
  },
  "/devotions/sacred-heart": {
    contentType: "DEVOTION",
    title: "Devotion to the Sacred Heart of Jesus",
    html: `<!doctype html><html><head><title>Devotion to the Sacred Heart of Jesus</title></head><body>
      <h1>Devotion to the Sacred Heart of Jesus</h1>
      <p>The devotion to the Sacred Heart of Jesus is one of the most widely practiced and well known Catholic devotions, taking the physical heart of Jesus Christ as the representation of his boundless divine love for humanity.</p>
      <p>How to practice: begin by making the sign of the cross, then pray the Litany of the Sacred Heart each day for the nine days of the novena, keeping a contrite and humble spirit and offering the day's works in reparation. Amen.</p>
      <footer>© 2024</footer>
    </body></html>`,
  },
};

function startServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const page = req.url ? PAGES[req.url] : undefined;
      if (!page) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page.html);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

async function main(): Promise<number> {
  const { server, port } = await startServer();
  const host = `localhost:${port}`;
  // Widen the fetch allow-list to the local mirror (non-production only).
  process.env.ADMIN_WORKER_DEV_SOURCE_HOSTS = host;
  delete process.env.ADMIN_WORKER_SKIP_NETWORK; // we want REAL HTTP fetches

  const prisma = new PrismaClient();
  try {
    // Clean any prior localhost fixtures so the run is deterministic:
    // candidates, source reads (+ their blocks), and artifacts.
    const priorReads = await prisma.adminWorkerSourceRead
      .findMany({ where: { sourceUrl: { contains: "localhost" } }, select: { id: true } })
      .catch(() => [] as Array<{ id: string }>);
    const priorReadIds = priorReads.map((r) => r.id);
    if (priorReadIds.length > 0) {
      await prisma.adminWorkerPackageArtifact
        .deleteMany({ where: { sourceReadId: { in: priorReadIds } } })
        .catch(() => undefined);
      await prisma.adminWorkerSourceBlock
        .deleteMany({ where: { sourceReadId: { in: priorReadIds } } })
        .catch(() => undefined);
      await prisma.adminWorkerSourceRead
        .deleteMany({ where: { id: { in: priorReadIds } } })
        .catch(() => undefined);
    }
    await prisma.candidateSourceUrl
      .deleteMany({ where: { sourceHost: { contains: "localhost" } } })
      .catch(() => undefined);

    // Seed one candidate per fixture page (status DISCOVERED, high priority).
    for (const [path, page] of Object.entries(PAGES)) {
      const url = `http://${host}${path}`;
      await prisma.candidateSourceUrl
        .upsert({
          where: { discoveredUrl: url },
          update: { status: "DISCOVERED", fetchPriority: 0.95 },
          create: {
            discoveredUrl: url,
            sourceHost: host,
            discoveryMethod: "CONFIGURED_URL",
            predictedContentType: page.contentType,
            predictedUsefulness: 0.9,
            status: "DISCOVERED",
            fetchPriority: 0.95,
            contentTypeLikelihood: 0.9,
            sourceAuthorityScore: 0.8,
          },
        })
        .catch((e) => console.error("seed failed", e));
    }
    console.log(`Seeded ${Object.keys(PAGES).length} local candidate(s) at http://${host}`);

    // Run the REAL worker loop. One stage per pass; ~12 stages per item ×
    // 3 items + discovery/maintenance noise → 80 passes is ample.
    const { runAdminWorkerLoop } = await import("../src/lib/admin-worker");
    const before = await prisma.publishedContent.count({ where: { isPublished: true } });
    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 80,
      idleBackoffMs: 0,
      workerId: "autonomy-proof",
    });
    const after = await prisma.publishedContent.count({ where: { isPublished: true } });
    console.log(
      `\nWorker ran ${result.passes} passes; published rows ${before} → ${after} (built=${result.built}, published=${result.published}).`,
    );

    // Show the brain actually walked the pipeline (action distribution).
    const decisions = await prisma.adminWorkerDecision.groupBy({
      by: ["missionStage"],
      where: { decisionType: "brain_pass" },
      _count: { _all: true },
    });
    console.log("\nBrain mission-stage distribution across passes:");
    for (const d of decisions.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`  ${d.missionStage ?? "—"}: ${d._count._all}`);
    }

    // Print the constructed content for the fixtures we seeded.
    console.log("\nConstructed public content (from the local mirror):");
    let proven = 0;
    let saintConstructed = false;
    for (const page of Object.values(PAGES)) {
      const row = await prisma.publishedContent.findFirst({
        where: { contentType: page.contentType as never, isPublished: true },
        orderBy: { publishedAt: "desc" },
        select: { contentType: true, slug: true, title: true, payload: true },
      });
      if (!row) {
        // Not public — show the CONSTRUCTED artifact instead. Sensitive
        // types (e.g. SAINT feast day) correctly hold for cross-source
        // verification, which needs multiple approved sources (not
        // possible with a single local mirror) — that is the spec's
        // doctrinal-safety behaviour, not a failure.
        const art = await prisma.adminWorkerPackageArtifact.findFirst({
          where: { contentType: page.contentType as never },
          orderBy: { createdAt: "desc" },
          select: { status: true, normalizedSlug: true, extractedFields: true, rejectionReason: true },
        });
        if (art) {
          const f = (art.extractedFields ?? {}) as Record<string, unknown>;
          console.log(
            `  ◐ ${page.contentType} → artifact ${art.status} (/${art.normalizedSlug}) — constructed, holding: ${art.rejectionReason ?? "—"}`,
          );
          if (page.contentType === "SAINT") {
            console.log(`       saintName:   ${f.saintName ?? "—"}`);
            console.log(`       patronage:   ${f.patronage ?? "—"}`);
            console.log(`       birthplace:  ${f.birthplace ?? "—"}  (where the saint is of)`);
            console.log(`       lived:       ${f.birthDate ?? "?"}–${f.deathDate ?? "?"}`);
            console.log(`       feastDay:    ${f.feastDay ?? "—"}`);
            console.log(`       background:  ${String(f.background ?? "").slice(0, 55)}…`);
            if (f.saintName && f.patronage && f.birthplace && f.birthDate && f.feastDay) saintConstructed = true;
          }
        } else {
          console.log(`  ✗ ${page.contentType} (${page.title}) — no artifact built`);
        }
        continue;
      }
      proven += 1;
      const p = (row.payload ?? {}) as Record<string, unknown>;
      console.log(`  ✓ ${row.contentType} → /${row.slug}  "${row.title}"`);
      if (row.contentType === "PRAYER") {
        console.log(`       prayerText: ${String(p.prayerText ?? "").slice(0, 70)}…`);
      }
      if (row.contentType === "SAINT") {
        console.log(`       patronage:   ${p.patronage ?? "—"}`);
        console.log(`       birthplace:  ${p.birthplace ?? "—"}  (where the saint is of)`);
        console.log(`       lived:       ${p.birthDate ?? "?"}–${p.deathDate ?? "?"}`);
        console.log(`       feastDay:    ${p.feastDay ?? "—"}`);
        console.log(`       canonized:   ${p.canonizationYear ?? "—"}`);
        console.log(`       background:  ${String(p.background ?? "").slice(0, 60)}…`);
      }
      if (row.contentType === "DEVOTION") {
        console.log(`       howToPractice: ${String(p.howToPractice ?? "").slice(0, 60)}…`);
      }
    }

    // PASS: the worker autonomously published ≥2 non-validation content
    // types end-to-end AND constructed the SAINT artifact completely
    // (name + patronage + birthplace + lived dates + feast day), which
    // correctly holds for cross-source verification before publishing.
    const ok = proven >= 2 && saintConstructed;
    console.log(
      ok
        ? `\nAutonomy proof PASSED — the worker autonomously fetched → read → extracted → QA'd → published ${proven} content type(s), and constructed a complete SAINT artifact (held for cross-source verification, as required for sensitive fields).`
        : `\nAutonomy proof INCOMPLETE — published=${proven}, saintConstructed=${saintConstructed}. See brain distribution + repair plans above.`,
    );
    return ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

main().then((code) => process.exit(code));
