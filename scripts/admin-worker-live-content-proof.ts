#!/usr/bin/env tsx
/**
 * Live content proof (real database).
 *
 * Drives one content-correct item through the back half of the pipeline
 * against the REAL Prisma client — extractor → package artifact → strict
 * QA → quality score → publish orchestrator → reasoning chain — and then
 * reads the persisted rows back out, so a developer can confirm that the
 * worker constructs correct content (prayer title + actual prayer text)
 * and publishes it locally with a full, queryable reasoning trail.
 *
 * The discover → fetch → read front half is exercised by the live worker
 * (`npm run worker`); it needs outbound access to the approved Catholic
 * sources. This script proves the build → publish → verify half lands
 * real rows in the database without depending on the network.
 *
 *   npm run worker:once          # front half (discover/fetch)
 *   tsx scripts/admin-worker-live-content-proof.ts   # back half (publish)
 */

import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { PrayerExtractor } from "../src/lib/admin-worker/extractors";
import { buildContentPackage } from "../src/lib/admin-worker/content-builder";
import { recordStrictQA } from "../src/lib/admin-worker/strict-qa";
import { runPublishOrchestrator } from "../src/lib/admin-worker/publish-orchestrator";
import { getReasoningChain } from "../src/lib/admin-worker/reasoning-graph";

const TITLE = "The Memorare";
const URL = "https://www.vatican.va/content/vatican/en/prayers/the-memorare.html";
const HOST = "vatican.va";
const PRAYER_TEXT =
  "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy " +
  "protection, implored thy help, or sought thy intercession was left unaided. Inspired by this " +
  "confidence, I fly unto thee, O Virgin of virgins, my Mother. Amen.";

async function main(): Promise<number> {
  const prisma = new PrismaClient();
  try {
    // 0. Self-clean so the proof is idempotent regardless of prior runs
    //    (e.g. the autonomy proof may have already published this prayer).
    //    Without this, a re-publish returns "duplicate" and records no new
    //    PUBLISH_ALLOWED_BECAUSE reasoning edge, so the proof would only
    //    pass on a pristine database.
    const SLUG = "the-memorare";
    await prisma.publishedContent
      .deleteMany({ where: { contentType: "PRAYER" as never, slug: SLUG } })
      .catch(() => undefined);
    // Delete any prior artifact for this slug so the upsert below creates
    // a fresh row with a fresh id (and the reasoning chain query, keyed by
    // that id, starts clean).
    await prisma.adminWorkerPackageArtifact
      .deleteMany({ where: { contentType: "PRAYER" as never, normalizedSlug: SLUG } })
      .catch(() => undefined);

    // 1. REAL extraction — recover the prayer title + actual prayer text.
    const extracted = PrayerExtractor({
      url: URL,
      host: HOST,
      title: TITLE,
      bodyText: PRAYER_TEXT,
    });
    if (extracted.fatalReasons.length > 0) {
      console.error("Extraction failed:", extracted.fatalReasons);
      return 1;
    }
    console.log("1. Extracted:");
    console.log(`     prayerTitle = ${extracted.fields.prayerTitle}`);
    console.log(`     prayerText  = ${String(extracted.fields.prayerText).slice(0, 60)}…`);
    console.log(
      `     provenance  = ${extracted.sourceEvidence.length} field(s) with source evidence`,
    );

    // 2. Package artifact (real row).
    const pkg = buildContentPackage({ contentType: "PRAYER", extractor: extracted, title: TITLE });
    const checksum = createHash("sha256")
      .update(JSON.stringify(pkg.displayFields))
      .digest("hex")
      .slice(0, 32);
    const artifact = await prisma.adminWorkerPackageArtifact.upsert({
      where: {
        contentType_normalizedSlug_packageChecksum: {
          contentType: "PRAYER",
          normalizedSlug: pkg.normalizedSlug,
          packageChecksum: checksum,
        },
      },
      update: { status: "BUILT" },
      create: {
        contentType: "PRAYER",
        normalizedTitle: pkg.normalizedTitle,
        normalizedSlug: pkg.normalizedSlug,
        extractedFields: pkg.displayFields as never,
        fieldProvenance: pkg.fieldProvenance as never,
        missingFields: pkg.missingFields,
        validationNeeds: pkg.validationNeeds,
        formattingMetadata: pkg.formattingMetadata as never,
        confidenceScore: pkg.confidenceByPackage,
        packageChecksum: checksum,
        status: "BUILT",
      },
    });
    console.log(`2. Package artifact persisted: ${artifact.id} (slug=${pkg.normalizedSlug})`);

    // 3. Strict QA (real row) — healthy dimensions → PASSED.
    const qa = await recordStrictQA(prisma, {
      packageArtifactId: artifact.id,
      contentType: "PRAYER",
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      provenanceScore: 1,
      validationScore: 1,
      duplicateSafetyScore: 1,
      publicReadinessScore: 1,
    });
    console.log(`3. Strict QA: ${qa.status} (finalScore=${qa.finalScore.toFixed(2)})`);
    if (qa.status !== "PASSED") return 1;

    // 4 + 5. Publish orchestrator — records ContentQualityScore + the
    // PublishedContent row + the PUBLISH_ALLOWED_BECAUSE reasoning edge.
    const result = await runPublishOrchestrator(prisma, {
      contentType: "PRAYER",
      contentId: artifact.id,
      title: TITLE,
      slug: pkg.normalizedSlug,
      payload: { title: TITLE, prayerText: PRAYER_TEXT, ...pkg.displayFields } as never,
      authorityLevel: "VATICAN",
      finalScore: 0.95,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: false,
      confidence: 0.95,
      strictQAArtifactId: artifact.id,
    });
    console.log(
      `4. Publish orchestrator: ${result.kind} — ${"reason" in result ? result.reason : ""}`,
    );
    if (result.kind !== "published" && result.kind !== "duplicate") return 1;

    // 6. Read the published row + the reasoning chain back out of the DB.
    const published = await prisma.publishedContent.findFirst({
      where: { contentType: "PRAYER", slug: pkg.normalizedSlug },
      select: { id: true, title: true, slug: true, isPublished: true, publishedAt: true },
    });
    console.log("5. PublishedContent row in DB:");
    console.log(`     ${JSON.stringify(published)}`);

    const chain = await getReasoningChain(prisma, {
      contentType: "PRAYER",
      contentId: artifact.id,
    });
    console.log(`6. Reasoning chain (${chain.edges.length} edge(s)):`);
    for (const e of chain.edges) {
      console.log(`     ${e.from.type} —${e.relation}→ ${e.to.type}: ${e.explanation}`);
    }

    const ok =
      !!published?.isPublished && chain.edges.some((e) => e.relation === "PUBLISH_ALLOWED_BECAUSE");
    console.log(
      ok
        ? "\nLive content proof PASSED — a real prayer is public with a full reasoning trail."
        : "\nLive content proof FAILED — published row or reasoning edge missing.",
    );
    return ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((code) => process.exit(code));
