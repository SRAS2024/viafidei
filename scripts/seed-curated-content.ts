#!/usr/bin/env tsx
/**
 * `npm run seed:content`
 *
 * Publishes the in-repo curated knowledge base through the real Admin Worker
 * publish pipeline so the public site has real content across every type that
 * ships curated entries — useful locally and in any environment that can't
 * fetch live authority sources. Idempotent.
 */

// Skip the per-publish live network probes (post-publish / sitemap / cache)
// so the seed completes quickly. Publishing itself needs no network — the
// curated payloads are the verified source. Live verification still runs in
// the worker's normal passes against the real public route.
process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
process.env.ADMIN_WORKER_DISABLE_LIVE_PROBE = "1";
// Disable the Python brain for the bulk seed. The orchestrator's brain-backed
// checks (communion-risk screen, semantic dedupe) are advisory and fail-open:
// the communion screen no-ops when the brain is offline and dedupe is skipped
// entirely, while the deterministic safety + full quality gates still run on
// every item. Curated entries are hand-verified ground truth with citations,
// so the per-item brain round-trip is pure latency here. The worker's normal
// autonomous passes still use the brain as the final action selector.
process.env.INTELLIGENCE_BRAIN_ENABLED = "0";

import { PrismaClient } from "@prisma/client";

import { seedCuratedContent } from "../src/lib/admin-worker/seed-curated-content";

async function main() {
  const prisma = new PrismaClient();
  try {
    const res = await seedCuratedContent(prisma);
    console.log("Curated content publish complete:");
    console.log(
      `  attempted=${res.attempted} published=${res.published} alreadyPublished=${res.alreadyPublished} skipped=${res.skipped} failed=${res.failed}`,
    );
    console.log("  by type:", JSON.stringify(res.byType));
    if (res.errors.length > 0) {
      console.log(`  first issues:\n    ${res.errors.slice(0, 8).join("\n    ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed:content] fatal:", e);
  process.exitCode = 1;
});
