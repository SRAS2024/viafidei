/**
 * App configuration with safe, hardcoded defaults.
 *
 * The only secrets / deploy-specific values that remain environment
 * variables are:
 *   - DATABASE_URL
 *   - SESSION_SECRET
 *   - ADMIN_USERNAME
 *   - ADMIN_PASSWORD
 *
 * Everything else (URLs, ingestion knobs, log level, ports, search
 * provider) lives here so production deployments do not need to set any
 * additional variables to function correctly.
 */
export const appConfig = {
  /** Public canonical production domain — used for sitemap, robots, OG. */
  canonicalUrl: "https://etviafidei.com",
  /** Base URL the app advertises to itself (email links, etc.). */
  appUrl: "https://etviafidei.com",
  /** HTTP port used by the standalone server. */
  port: 3000,
  /** Bind address used by the standalone server. */
  hostname: "0.0.0.0",
  /** Echoed by /api/admin/search/reindex. */
  searchProvider: "postgres",
  /** Logger floor in production. */
  logLevelProduction: "info" as const,
  /** Logger floor outside production. */
  logLevelDevelopment: "debug" as const,
  ingestion: {
    /** User-Agent sent to upstream sources during scheduled fetches. */
    userAgent: "ViaFideiBot/1.0 (+https://etviafidei.com/bot; ingestion@viafidei.com)",
    /** Per-request timeout for outbound HTTP fetches (milliseconds). */
    httpTimeoutMs: 15_000,
    /**
     * Status assigned to ingested items. Items only reach this stage after
     * passing the allowlist gate (credible Catholic source), the validator
     * (quality / minimum body length / not a non-Catholic place of worship),
     * and the dedup pass (already in the DB → skipped). The fill flow is
     * supposed to grow the public catalog without manual review, so newly
     * ingested rows are published immediately. Curated rows in PUBLISHED /
     * ARCHIVED status are still protected from being overwritten — see the
     * per-kind persisters.
     */
    initialStatus: "PUBLISHED" as const,
    /** Background scheduler tick interval (ms) while below targets. */
    intervalMs: 10 * 60 * 1000,
    /**
     * Delay before the first scheduled tick (ms). Short enough that the
     * operator sees the catalog start filling within a minute of deploy,
     * long enough that migrations and the seeder finish first.
     */
    initialDelayMs: 30 * 1000,
    /** When true, the in-process scheduler does not start. */
    schedulerDisabled: false,
    /**
     * Backlog targets. While the database is below ANY of these
     * thresholds the scheduler stays in `constant` mode and keeps
     * ticking aggressively. Once all of them are met the scheduler
     * switches to `maintenance` mode and runs the upstream check on
     * the cadence below. Public pages never expose these numbers.
     *
     * Targets cover five tracked entity buckets:
     *   - prayers          — Prayer rows
     *   - saints           — Saint rows
     *   - parishes         — Parish rows
     *   - churchDocuments  — LiturgyEntry rows whose slug looks like an
     *                        encyclical / CCC section / canon law book
     *                        / Vatican Council document
     *   - sacraments       — SpiritualLifeGuide rows whose slug starts
     *                        with `sacrament-` or `consecration-`
     */
    targets: {
      prayers: 500,
      saints: 7_000,
      parishes: 150_000,
      churchDocuments: 1_500,
      sacraments: 7,
      consecrations: 4,
    },
    /**
     * Maintenance-mode cadence: after the targets are met we still
     * want to catch new credible Catholic content without scraping
     * constantly. Twice per week (≈84h) is enough to pick up newly
     * published prayers / saint biographies / parish listings without
     * unnecessary background activity. Public pages never expose this.
     */
    maintenanceIntervalMs: 84 * 60 * 60 * 1000,
    /**
     * Durable-queue worker settings. These knobs control how a
     * worker process (separate from the web server) leases and
     * executes IngestionJobQueue rows. The web server still ticks
     * the in-process scheduler so single-server deployments
     * continue to work, but production should run at least one
     * dedicated worker for retry safety.
     */
    queue: {
      /** Max attempts per job before it's marked failed + sent to review. */
      maxAttempts: 5,
      /** Backoff base (ms). Doubles per attempt, jittered ±25%. */
      backoffBaseMs: 30_000,
      /** Backoff cap (ms). Long-failing sources still retry once per ~6h. */
      backoffMaxMs: 6 * 60 * 60 * 1000,
      /** Lease duration (ms). Stale leases beyond this get reclaimed. */
      leaseDurationMs: 10 * 60 * 1000,
      /** Worker idle sleep (ms) between empty-queue polls. */
      idleSleepMs: 5_000,
    },
    /**
     * Stalled-growth detector. Number of ingestion cycles a content
     * type can go without growing (while still below target) before
     * we send the admin a "stalled" alert.
     */
    stalledGrowthCycleThreshold: 6,
    /**
     * One-month retention window for ARCHIVED rows. Measured from
     * `archivedAt`, not `updatedAt`, so editing an archived row does
     * not push its deletion date forward.
     */
    archiveRetentionDays: 30,
  },
  /**
   * Durable ingestion queue tunables. The cron route plans + enqueues
   * via `enqueueDueIngestionJobs()`; a separate worker process
   * (`npm run worker`) is the only adapter executor.
   */
  ingestionQueue: {
    completedRetentionDays: 30,
    failedRetentionDays: 90,
    workerStaleAfterMs: 90 * 1000,
    oldestPendingWarnAfterMs: 30 * 60 * 1000,
  },
  /**
   * Strict content QA cleanup policy. The cleanup loop scans every
   * catalog row and either flips its validation flags (valid +
   * publicRenderReady + isThresholdEligible) or deletes the row +
   * writes a RejectedContentLog entry.
   *
   *   - `deleteAllInvalid` — when `true`, any row that fails its
   *     strict package contract is deleted and logged, even if it is
   *     a status = REVIEW or status = DRAFT row. There is no
   *     "remove from public view but keep the row" outcome under this
   *     mode; the outcome is always one of: keep + valid + render-ready,
   *     update in place, archive (only for valid old content), or
   *     delete + log. Production must run with this enabled.
   *   - `scanAllCatalogRows` — when `true`, the cleanup loop scans
   *     PUBLISHED, REVIEW, DRAFT, ARCHIVED, and any row with stale
   *     package flags or a stale package version, not just rows
   *     visible publicly. This is the "all_catalog_rows" sweep mode.
   *   - `autoTriggerAfterIngestion` — when `true`, every successful
   *     ingestion batch enqueues a content-revalidate job. Keeps the
   *     catalog clean without admin involvement.
   *   - `packageContractVersion` — bumping this string forces the
   *     cleanup loop to treat any row whose contentPackageVersion
   *     does not match as stale, even if the flags say it is valid.
   *     Used to invalidate the entire catalog when a contract is
   *     tightened.
   */
  contentQA: {
    deleteAllInvalid: true,
    scanAllCatalogRows: true,
    autoTriggerAfterIngestion: true,
    packageContractVersion: "1.1.0",
    /**
     * Scheduled strict cleanup cadence. The queue planner enqueues a
     * content_revalidate job on this cadence so the catalog cannot
     * drift even when no ingestion is happening.
     */
    scheduledCleanupIntervalMs: 6 * 60 * 60 * 1000,
    /**
     * "Stale" threshold for the cleanupHealth diagnostic. If no
     * strict cleanup has run within this window, the diagnostic
     * flips to warn.
     */
    staleAfterMs: 24 * 60 * 60 * 1000,
  } as const,
  email: {
    /**
     * Transactional sender address. Must match a verified Resend domain —
     * Resend rejects any `from` whose domain hasn't been verified. The
     * verified domain on this deployment's Resend account is
     * `etviafidei.com` (DKIM/SPF/DMARC green); the API key is scoped to
     * that domain. Using a different domain here returns a 403
     * `API key not authorized for this domain` and the user receives
     * nothing — verified empirically when an earlier revision tried
     * `viafidei.com` and got rejected at the Resend edge.
     */
    fromAddress: "notifications@etviafidei.com",
    /**
     * Display name used in the `From` header. Inbox providers show this
     * as the sender column ("Via Fidei" instead of "notifications@…");
     * a recognizable name materially improves deliverability for new
     * sender domains because Gmail / Outlook / Apple Mail use the
     * From-name as a heuristic for legitimacy.
     */
    fromName: "Via Fidei",
    /**
     * Address that user replies route to. Account-flow emails are
     * automated, so this points at the same notifications mailbox —
     * but having ANY Reply-To set makes the message look transactional
     * rather than bulk-marketing to spam filters.
     */
    replyToAddress: "notifications@etviafidei.com",
    /** Provider name for logs / diagnostics. */
    providerName: "resend" as const,
  },
} as const;

export type AppConfig = typeof appConfig;
