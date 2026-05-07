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
     * Resend dashboard for this deployment shows etviafidei.com as the
     * verified domain (DKIM, SPF, DMARC all green); using a different
     * domain here returns a 422 / validation_error and the user receives
     * nothing.
     */
    fromAddress: "notifications@etviafidei.com",
    /** Provider name for logs / diagnostics. */
    providerName: "resend" as const,
  },
} as const;

export type AppConfig = typeof appConfig;
