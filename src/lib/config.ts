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
  canonicalUrl: "https://viafidei.com",
  /** Base URL the app advertises to itself (email links, etc.). */
  appUrl: "https://viafidei.com",
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
    userAgent: "ViaFideiBot/1.0 (+https://viafidei.com/bot; ingestion@viafidei.com)",
    /** Per-request timeout for outbound HTTP fetches (milliseconds). */
    httpTimeoutMs: 15_000,
    /** Initial status assigned to ingested items. */
    initialStatus: "REVIEW" as const,
    /** Background scheduler tick interval (ms). */
    intervalMs: 30 * 60 * 1000,
    /** Delay before the first scheduled tick (ms). */
    initialDelayMs: 5 * 60 * 1000,
    /** When true, the in-process scheduler does not start. */
    schedulerDisabled: true,
  },
  email: {
    /**
     * Transactional sender address. Must match a verified Resend domain —
     * Resend rejects any `from` whose domain hasn't been verified. The
     * Resend dashboard for this deployment is configured for viafidei.com
     * (DKIM, SPF, DMARC verified); using a different domain here returns
     * a 422 / validation_error and the user receives nothing.
     */
    fromAddress: "notifications@viafidei.com",
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
    replyToAddress: "notifications@viafidei.com",
    /** Provider name for logs / diagnostics. */
    providerName: "resend" as const,
  },
} as const;

export type AppConfig = typeof appConfig;
