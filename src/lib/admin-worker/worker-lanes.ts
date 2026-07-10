/**
 * The concrete internal worker lanes (adaptive-worker Phase B, fine-grained).
 *
 * Each lane is ONE independent, fail-open workstream that used to run
 * one-after-another inside a coarse grouped lane (or serially in the loop).
 * Splitting the old grouped lanes ("ingestion", "enrichment", "discovery",
 * "maintenance") into a lane PER workstream means the worker now runs far more
 * tasks at once — curated / structured / liturgical ingest fire in parallel,
 * the three discovery methods fire in parallel, the four awareness/custody
 * passes fire in parallel — instead of blocking on each other. Every lane
 * records its OWN live `AdminWorkerLaneState` row, so the dashboard/diagnostics
 * show exactly what each one is doing, its last outcome, and its last error.
 *
 * Safety is by construction, unchanged from the grouped design:
 *   - Lanes touch DISJOINT domains (curated vs structured vs liturgical ingest
 *     publish different content sets; the drain owns artifacts; the three
 *     discovery methods only INSERT candidates, deduped by the URL unique
 *     constraint), so concurrent lanes never fight over the same rows.
 *   - `PublishedContent @@unique([contentType, slug])` makes double-publishing
 *     impossible at the DB level even under a race.
 *   - ALL Python-brain-calling work stays in the SINGLE `intelligence` lane, so
 *     the one resident brain subprocess never gets concurrent calls. (The main
 *     decision/dispatch brain call happens in the loop BEFORE the lanes run.)
 *   - Each lane is isolated + enters an error-backoff cooldown on failure
 *     (runWorkerLanes), so a failing lane never kills the others and retries on
 *     its own cadence — per-lane self-repair.
 *
 * Lanes are invoked through `runWorkerLanes` (lanes.ts), which runs them
 * concurrently under the global cap (ADMIN_WORKER_LANE_CONCURRENCY), isolates
 * failures, applies the cooldown, and records each lane's live state.
 */

import type { LaneDef } from "./lanes";

/**
 * CONTENT lanes — publish or grow public content, so they only run when the
 * Python final brain is active (safe-degraded contract). One lane per
 * workstream, all touching disjoint domains → safe to run concurrently.
 */
export const CONTENT_LANES: LaneDef[] = [
  // ── Ingestion: curated, structured, and liturgical ingest each publish a
  //    DISJOINT content set, so they run as three parallel lanes. ────────────
  {
    name: "ingest-curated",
    capacity: 4,
    activeOnly: true,
    growth: true,
    async run({ prisma, passId }) {
      const { runCuratedIngest } = await import("./curated-ingest");
      const published = (await runCuratedIngest(prisma, { passId })).published;
      return { published, detail: `curated ingest +${published}` };
    },
  },
  {
    name: "ingest-structured",
    capacity: 4,
    activeOnly: true,
    growth: true,
    async run({ prisma, passId }) {
      const { runStructuredIngest } = await import("./structured/ingest");
      const published = (await runStructuredIngest(prisma, { passId })).published;
      return { published, detail: `structured ingest +${published}` };
    },
  },
  {
    name: "ingest-liturgical",
    capacity: 1,
    activeOnly: true,
    async run({ prisma }) {
      const { runLiturgicalCalendarIngest } = await import("./liturgical-calendar-ingest");
      const published = (await runLiturgicalCalendarIngest(prisma)).published;
      return { published, detail: `liturgical ingest +${published}` };
    },
  },

  // ── Enrichment: translation backfill, review auto-resolve, and pope-record
  //    cleanup are independent domains → three parallel lanes. ────────────────
  {
    name: "enrich-translations",
    capacity: 2,
    activeOnly: true,
    async run({ prisma }) {
      const { runPrayerTranslationBackfill } = await import("./prayer-translation-backfill");
      await runPrayerTranslationBackfill(prisma);
      return { detail: "prayer-translation backfill ran" };
    },
  },
  {
    name: "enrich-reviews",
    capacity: 2,
    activeOnly: true,
    async run({ prisma }) {
      const { runReviewAutoResolve } = await import("./human-review");
      await runReviewAutoResolve(prisma);
      return { detail: "review auto-resolve ran" };
    },
  },
  {
    name: "enrich-pope-cleanup",
    capacity: 1,
    activeOnly: true,
    async run({ prisma }) {
      const { pruneAntipopeRecords, pruneDuplicatePopeRecords } = await import("./pope-cleanup");
      await pruneAntipopeRecords(prisma);
      await pruneDuplicatePopeRecords(prisma);
      return { detail: "pope-record cleanup ran" };
    },
  },

  // ── Discovery: the structured seeder, OSM parish discovery, and the always-on
  //    web sweep only INSERT candidates (deduped by URL) → three parallel
  //    lanes keep the funnel full from every angle at once. ───────────────────
  {
    name: "discover-structured",
    capacity: 2,
    activeOnly: true,
    growth: true,
    discovery: true,
    async run({ prisma }) {
      const { runDiscoverySeeder } = await import("./structured/discovery-seeder");
      await runDiscoverySeeder(prisma);
      return { detail: "structured discovery-seeder ran" };
    },
  },
  {
    name: "discover-parish-osm",
    capacity: 2,
    // NOT activeOnly: parishes are grown deterministically from OpenStreetMap's
    // curated roman_catholic tag + the communion verifier + the strict parish
    // schema + the publish orchestrator — no brain judgement is involved — so
    // the directory keeps growing even when the Python brain is degraded
    // (`brainActive: true` here means "publishing is allowed", which it always
    // is for this deterministic lane).
    growth: true,
    discovery: true,
    async run({ prisma }) {
      const { runOsmParishDiscovery } = await import("./parish-osm");
      const published = (await runOsmParishDiscovery(prisma, { brainActive: true })).published;
      return { published, detail: `OSM parish discovery +${published}` };
    },
  },
  {
    name: "discover-web",
    capacity: 4,
    activeOnly: true,
    growth: true,
    discovery: true,
    async run({ prisma, passId }) {
      const { runAlwaysOnDiscovery } = await import("./always-on-discovery");
      await runAlwaysOnDiscovery(prisma, { passId });
      return { detail: "always-on web discovery ran" };
    },
  },
];

/**
 * OPS lanes — run every pass regardless of brain mode. None publish NEW public
 * content except the drain's publish step, which self-gates on `active`.
 */
export const OPS_LANES: LaneDef[] = [
  {
    name: "drain",
    capacity: 5,
    // The drain can legitimately run long over a large BUILD_READY backlog
    // (round-based verify → QA → publish), so it gets a generous watchdog so a
    // big-but-progressing drain is never interrupted.
    watchdogMs: 10 * 60 * 1000,
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

  // ── Maintenance: schema awareness, UI awareness, the self-model refresh, and
  //    content custody are independent → four parallel lanes. ────────────────
  {
    name: "maint-schema",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runSchemaAwareness } = await import("./awareness");
      await runSchemaAwareness(prisma, { passId });
      return { detail: "schema awareness ran" };
    },
  },
  {
    name: "maint-ui",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runUiAwareness } = await import("./awareness");
      await runUiAwareness(prisma, { passId });
      return { detail: "UI awareness ran" };
    },
  },
  {
    name: "maint-self-model",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runSelfModelPass } = await import("./self-model");
      await runSelfModelPass(prisma, { passId });
      return { detail: "self-model refreshed" };
    },
  },
  {
    name: "maint-custody",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runCustodyPass } = await import("./custody");
      await runCustodyPass(prisma, { passId });
      return { detail: "content custody ran" };
    },
  },
  {
    name: "reporting",
    capacity: 1,
    async run({ prisma, passId }) {
      const { maybeRunReportingPass } = await import("./reporting-pass");
      await maybeRunReportingPass(prisma, { passId });
      // Monthly Admin Worker Report: checked EVERY pass, not only at process
      // startup. The startup-only check meant the report fired only if the
      // worker container happened to restart on the last calendar day of the
      // month — a continuously-running worker silently skipped month-end (the
      // June 2026 report that never arrived). The job self-gates (last day of
      // month, or catch-up for a missed month) and is idempotent via a
      // durable per-month marker, so calling it here is cheap and can never
      // double-send.
      const { runMonthlyReportJobIfDue } = await import("./monthly-report-job");
      await runMonthlyReportJobIfDue(prisma).catch(() => undefined);
      return { detail: "reporting ran" };
    },
  },
  {
    // Parish directory upkeep: continuous address-dedup maintenance every pass,
    // plus the end-of-month refresh of Mass/confession times + phone during the
    // last 7 days of the month. Both self-gate (throttle / date window) and fail
    // open, and the refresh stops the moment it finishes so the worker returns
    // to normal tasks. Website re-reads are bounded per pass.
    name: "refresh-parishes",
    capacity: 1,
    async run({ prisma, passId }) {
      const { runParishRefreshLane } = await import("./parish-refresh");
      return runParishRefreshLane(prisma, { passId });
    },
  },
  {
    // ALL Python-brain-calling work lives in ONE lane so it never issues
    // concurrent calls to the single resident brain subprocess.
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
  {
    // Innovation lane (adaptive-worker Phase D): a throttled, MEASURE-ONLY
    // experiment over recorded per-method stats that remembers the winning
    // method. Never publishes or mutates content — pure research.
    name: "innovation",
    capacity: 1,
    async run({ prisma, passId }) {
      const { maybeRunInnovationExperiment } = await import("./innovation-lab");
      const r = await maybeRunInnovationExperiment(prisma, { passId });
      return {
        detail: r.ran
          ? `experiment: ${r.dimension} → ${r.conclusive ? `winner ${r.leader}` : "inconclusive"}`
          : `innovation ${r.reason ?? "skipped"}`,
      };
    },
  },
];

/**
 * Every active lane name across both groups — used to prune stale lane-state
 * rows left over from earlier lane layouts so the dashboard only ever shows the
 * lanes that are actually running.
 */
export const ALL_LANE_NAMES: readonly string[] = [...CONTENT_LANES, ...OPS_LANES].map(
  (l) => l.name,
);
