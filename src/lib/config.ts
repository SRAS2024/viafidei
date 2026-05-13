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
     * ticking aggressively. Once all three are met the scheduler
     * switches to `maintenance` mode and runs the upstream check on
     * the cadence below. Public pages never expose these numbers.
     */
    targets: {
      prayers: 300,
      saints: 1_000,
      parishes: 20_000,
    },
    /**
     * Maintenance-mode cadence: after the targets are met we still
     * want to catch new credible Catholic content without scraping
     * constantly. Twice per week (≈84h) is enough to pick up newly
     * published prayers / saint biographies / parish listings without
     * unnecessary background activity. Public pages never expose this.
     */
    maintenanceIntervalMs: 84 * 60 * 60 * 1000,
  },
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
