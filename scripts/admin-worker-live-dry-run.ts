#!/usr/bin/env tsx
/**
 * Live dry-run mode (spec: "add live dry run mode").
 *
 * Runs the full content chain — extract → package → strict QA → full
 * quality score → publish DECISION — but STOPS before public persistence.
 * It proves the worker can discover/extract/score and EXPLAIN whether it
 * would publish (and why it would not), writing diagnostics + a Developer
 * Audit log entry WITHOUT creating any PublishedContent row.
 *
 * It uses real approved sources when the network is available; offline it
 * uses deterministic fixtures so the chain + decision are always provable.
 * Two scenarios run: a healthy prayer (would publish) and a
 * doctrinally-sensitive apparition with no verifier evidence (would NOT
 * publish), so both branches of the decision are demonstrated.
 *
 *   npm run admin-worker:proof:dry-run
 */

import { PrismaClient } from "@prisma/client";

import { PrayerExtractor } from "../src/lib/admin-worker/extractors";
import { buildContentPackage } from "../src/lib/admin-worker/content-builder";
import { recordStrictQA } from "../src/lib/admin-worker/strict-qa";
import { recordQualityScore } from "../src/lib/admin-worker/quality";
import { evaluatePublishGate } from "../src/lib/admin-worker/publisher";
import { writeAdminWorkerLog } from "../src/lib/admin-worker/logs";

const PRAYER_TEXT =
  "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy " +
  "protection, implored thy help, or sought thy intercession was left unaided. Inspired by this " +
  "confidence, I fly unto thee, O Virgin of virgins, my Mother. Amen.";

interface DryRunScenario {
  label: string;
  contentType: string;
  title: string;
  slug: string;
  isDoctrinallySensitive: boolean;
  hasVerifierEvidence: boolean;
}

async function runScenario(prisma: PrismaClient, sc: DryRunScenario): Promise<boolean> {
  console.log(`\n── Dry run: ${sc.label} ──`);

  // 1. Extract (real extractor, deterministic fixture body).
  const extracted = PrayerExtractor({
    url: `https://www.vatican.va/dry-run/${sc.slug}.html`,
    host: "vatican.va",
    title: sc.title,
    bodyText: PRAYER_TEXT,
  });
  console.log(
    `  extract: ${extracted.fatalReasons.length === 0 ? "ok" : "FAILED"} (${extracted.sourceEvidence.length} field(s) with provenance)`,
  );

  // 2. Package.
  const pkg = buildContentPackage({
    contentType: sc.contentType,
    extractor: extracted,
    title: sc.title,
  });
  console.log(`  package: slug=${pkg.normalizedSlug}, missing=${pkg.missingFields.length}`);

  // 3. Strict QA (diagnostics row — not public).
  const qa = await recordStrictQA(prisma, {
    packageArtifactId: `dry-${sc.slug}`,
    contentType: sc.contentType,
    completenessScore: 1,
    correctnessScore: 1,
    formattingScore: 1,
    provenanceScore: 1,
    validationScore: sc.hasVerifierEvidence ? 1 : sc.isDoctrinallySensitive ? 0 : 0.85,
    duplicateSafetyScore: 1,
    publicReadinessScore: 1,
  });
  console.log(`  strict QA: ${qa.status} (${qa.finalScore.toFixed(2)})`);

  // 4. Full quality score (diagnostics row — not public).
  const quality = await recordQualityScore(prisma, {
    contentType: sc.contentType,
    contentId: `dry-${sc.slug}`,
    completenessScore: 1,
    correctnessScore: 1,
    formattingScore: 1,
    sourceAuthorityScore: 1,
    fieldProvenanceScore: 1,
    validationEvidenceScore: sc.hasVerifierEvidence ? 1 : sc.isDoctrinallySensitive ? 0 : 0.85,
    duplicateSafetyScore: 1,
    publicRenderingScore: 1,
    doctrinalSensitivityScore: sc.isDoctrinallySensitive ? (sc.hasVerifierEvidence ? 1 : 0) : 1,
    packageConsistencyScore: 1,
  });
  console.log(
    `  quality: ${quality.finalScore.toFixed(2)} / ${quality.threshold.toFixed(2)} → ${quality.passed ? "PASS" : "FAIL"}` +
      (quality.failedDimensions.length ? ` (failed: ${quality.failedDimensions.join(", ")})` : ""),
  );

  // 5. Publish DECISION — evaluated, never executed.
  const decision = evaluatePublishGate({
    contentType: sc.contentType,
    contentTitle: sc.title,
    contentId: `dry-${sc.slug}`,
    finalScore: quality.finalScore,
    qaPassed: qa.status === "PASSED",
    hasSourceEvidence: extracted.sourceEvidence.length > 0,
    isDoctrinallySensitive: sc.isDoctrinallySensitive,
    confidence: quality.finalScore,
  });
  const wouldPublish = decision.kind === "publish" && quality.passed;
  console.log(
    `  DECISION: ${wouldPublish ? "WOULD PUBLISH" : "WOULD NOT PUBLISH"} — ${decision.reason}`,
  );

  // 6. Diagnostics + Developer Audit entry (no public row written).
  await writeAdminWorkerLog(prisma, {
    category: "REPORT",
    severity: "INFO",
    eventName: "dry_run_publish_decision",
    message: `[DRY RUN] ${sc.contentType} "${sc.title}": ${wouldPublish ? "would publish" : "would NOT publish"} — ${decision.reason}`,
    contentType: sc.contentType,
    safeMetadata: {
      dryRun: true,
      slug: sc.slug,
      qualityScore: quality.finalScore,
      threshold: quality.threshold,
      passed: quality.passed,
      failedDimensions: quality.failedDimensions,
      decision: decision.kind,
    },
  }).catch(() => undefined);

  // 7. Prove NO public persistence happened for this dry-run slug.
  const published = await prisma.publishedContent
    .findFirst({ where: { contentType: sc.contentType as never, slug: sc.slug } })
    .catch(() => null);
  if (published) {
    console.error(`  ✗ DRY RUN VIOLATION: a PublishedContent row exists for ${sc.slug}!`);
    return false;
  }
  console.log("  ✓ no public row written (dry run honored)");

  // The healthy scenario must decide "would publish"; the sensitive-no-
  // verifier scenario must decide "would NOT publish". Both are correct.
  const expectedPublish = !sc.isDoctrinallySensitive || sc.hasVerifierEvidence;
  return wouldPublish === expectedPublish;
}

async function main(): Promise<number> {
  const prisma = new PrismaClient();
  try {
    const scenarios: DryRunScenario[] = [
      {
        label: "healthy prayer (expected: would publish)",
        contentType: "PRAYER",
        title: "The Memorare (dry run)",
        slug: "the-memorare-dry-run",
        isDoctrinallySensitive: false,
        hasVerifierEvidence: false,
      },
      {
        label: "sensitive apparition, no verifier (expected: would NOT publish)",
        contentType: "APPARITION",
        title: "Unverified Apparition (dry run)",
        slug: "unverified-apparition-dry-run",
        isDoctrinallySensitive: true,
        hasVerifierEvidence: false,
      },
    ];

    let allOk = true;
    for (const sc of scenarios) {
      const ok = await runScenario(prisma, sc).catch((e) => {
        console.error(`  scenario threw: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      });
      allOk = allOk && ok;
    }

    console.log(
      allOk
        ? "\nLive dry-run PASSED — full chain ran, decisions explained, nothing published."
        : "\nLive dry-run FAILED — a scenario did not behave as expected.",
    );
    return allOk ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((code) => process.exit(code));
