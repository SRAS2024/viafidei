/**
 * The concrete internal worker lanes (adaptive-worker Phase B).
 *
 * Each lane groups related, independent, fail-open workstreams that used to run
 * one-after-another in the loop. Grouped so that lanes touch DISJOINT domains
 * (safe to run concurrently) and so brain-calling work stays in a single lane
 * (never issues concurrent calls to the one Python brain subprocess).
 *
 *   CONTENT lanes (activeOnly — publish content, so only in python/active mode):
 *     - ingestion:  curated + structured + liturgical ingest (publishes)
 *     - enrichment: prayer-translation backfill + review auto-resolve + pope cleanup
 *     - discovery:  structured discovery-seeder + OSM parish + always-on web discovery
 *
 *   OPS lanes (run regardless of mode — no new public publishing except the
 *   drain's publish step, which self-gates on `active`):
 *     - drain:        BUILD_READY drain + triage (Phase A)
 *     - readings:     daily-readings refresh + backfill
 *     - maintenance:  schema/ui awareness + self-model + content custody
 *     - reporting:    growth + source-coverage reporting pass
 *     - intelligence: post-pass intelligence + lab + skill matrix (brain-calling → serial)
 *     - escalation:   self-monitoring → governance → escalation check
 *
 * Every lane is invoked through `runWorkerLanes` (lanes.ts), which runs them
 * concurrently under a global cap, isolates failures, applies error-backoff, and
 * records each lane's live state.
 */

import type { LaneDef } from "./lanes";

/** Content lanes — only run when the Python final brain is active. */
export const CONTENT_LANES: LaneDef[] = [
  {
    name: "ingestion",
    capacity: 3,
    activeOnly: true,
    async run({ prisma, passId }) {
      let published = 0;
      try {
        const { runCuratedIngest } = await import("./curated-ingest");
        published += (await runCuratedIngest(prisma, { passId })).published;
      } catch {
        /* fail-open */
      }
      try {
        const { runStructuredIngest } = await import("./structured/ingest");
        published += (await runStructuredIngest(prisma, { passId })).published;
      } catch {
        /* fail-open */
      }
      try {
        const { runLiturgicalCalendarIngest } = await import("./liturgical-calendar-ingest");
        published += (await runLiturgicalCalendarIngest(prisma)).published;
      } catch {
        /* fail-open */
      }
      return { published, detail: `ingestion +${published}` };
    },
  },
  {
    name: "enrichment",
    capacity: 3,
    activeOnly: true,
    async run({ prisma }) {
      try {
        const { runPrayerTranslationBackfill } = await import("./prayer-translation-backfill");
        await runPrayerTranslationBackfill(prisma);
      } catch {
        /* fail-open */
      }
      try {
        const { runReviewAutoResolve } = await import("./human-review");
        await runReviewAutoResolve(prisma);
      } catch {
        /* fail-open */
      }
      try {
        const { pruneAntipopeRecords, pruneDuplicatePopeRecords } = await import("./pope-cleanup");
        await pruneAntipopeRecords(prisma);
        await pruneDuplicatePopeRecords(prisma);
      } catch {
        /* fail-open */
      }
      return { detail: "enrichment ran" };
    },
  },
  {
    name: "discovery",
    capacity: 3,
    activeOnly: true,
    async run({ prisma, passId }) {
      let published = 0;
      try {
        const { runDiscoverySeeder } = await import("./structured/discovery-seeder");
        await runDiscoverySeeder(prisma);
      } catch {
        /* fail-open */
      }
      try {
        const { runOsmParishDiscovery } = await import("./parish-osm");
        published += (await runOsmParishDiscovery(prisma, { brainActive: true })).published;
      } catch {
        /* fail-open */
      }
      try {
        const { runAlwaysOnDiscovery } = await import("./always-on-discovery");
        await runAlwaysOnDiscovery(prisma, { passId });
      } catch {
        /* fail-open */
      }
      return { published, detail: `discovery +${published}` };
    },
  },
];

/** Ops lanes — run every pass regardless of brain mode. */
export const OPS_LANES: LaneDef[] = [
  {
    name: "drain",
    capacity: 5,
    async run({ prisma, passId, active }) {
      const { runBuildReadyDrain } = await import("./build-ready-drain");
      const r = await runBuildReadyDrain(prisma, { passId, active });
      return {
        published: r.published,
        advanced: r.advanced,
        detail: `drain: ${r.stuck} triaged, +${r.published} pub, +${r.advanced} QA`,
      };
    },
  },
  {
    name: "readings",
    capacity: 1,
    async run({ prisma, passId }) {
      const { maybeRefreshDailyReadings, maybeBackfillDailyReadings } =
        await import("./daily-readings");
      const { initReadingsSources } = await import("./readings-source");
      initReadingsSources();
      await maybeRefreshDailyReadings(prisma, { passId });
      await maybeBackfillDailyReadings(prisma, { passId });
      return { detail: "readings refreshed" };
    },
  },
  {
    name: "maintenance",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runSchemaAwareness, runUiAwareness } = await import("./awareness");
      const { runSelfModelPass } = await import("./self-model");
      const { runCustodyPass } = await import("./custody");
      await runSchemaAwareness(prisma, { passId });
      await runUiAwareness(prisma, { passId });
      await runSelfModelPass(prisma, { passId });
      await runCustodyPass(prisma, { passId });
      return { detail: "maintenance ran" };
    },
  },
  {
    name: "reporting",
    capacity: 1,
    async run({ prisma, passId }) {
      const { maybeRunReportingPass } = await import("./reporting-pass");
      await maybeRunReportingPass(prisma, { passId });
      return { detail: "reporting ran" };
    },
  },
  {
    // Brain-calling work lives in ONE lane so it never issues concurrent calls
    // to the single Python brain subprocess.
    name: "intelligence",
    capacity: 1,
    async run({ prisma, passId, workerId }) {
      if (passId && workerId) {
        try {
          const { runPostPassIntelligence } = await import("./intelligence-pass");
          await runPostPassIntelligence(prisma, { passId, workerId });
        } catch {
          /* fail-open */
        }
      }
      try {
        const { maybeRunIntelligenceLabPass } = await import("./intelligence-lab");
        await maybeRunIntelligenceLabPass(prisma, { passId });
      } catch {
        /* fail-open */
      }
      try {
        const { ensureSkillsRegistered, refreshCapabilityMatrix } = await import("./skills");
        ensureSkillsRegistered();
        await refreshCapabilityMatrix(prisma);
      } catch {
        /* fail-open */
      }
      try {
        const { recordCodeVersionIfChanged } = await import("./code-version");
        await recordCodeVersionIfChanged(prisma);
      } catch {
        /* fail-open */
      }
      return { detail: "intelligence ran" };
    },
  },
  {
    name: "escalation",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runEscalationCheckIfDue } = await import("./escalation");
      await runEscalationCheckIfDue(prisma, { passId });
      return { detail: "escalation checked" };
    },
  },
];
