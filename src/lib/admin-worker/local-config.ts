/**
 * Local execution host — configuration provenance, blocking rules and the few
 * pure decisions the host makes about its own environment.
 *
 * Extracted from scripts/local-worker-host.ts so they can be unit-tested
 * without a database or a process tree. Everything here is a pure function of
 * its inputs; the host feeds it `process.env` and the last database probe.
 *
 * The one rule that matters most: the worker must never start against a
 * database that is not the production one it thinks it is talking to. The
 * incident that motivated this module was a laptop .env pointing at a local
 * Postgres — every dashboard reported an active worker and rising "published"
 * counters while etviafidei.com never changed. The gate is therefore a
 * structured `blockingReason`, never a regex over warning prose.
 */

/** Why the worker may not be started, or null when nothing blocks it. */
export type BlockingReason = "internal_host" | "local_db" | "no_db" | "unreachable" | null;

export interface DatabaseProbe {
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
  at: string;
}

export interface LocalConfigInput {
  /** The effective DATABASE_URL (credentials are never surfaced). */
  databaseUrl: string | undefined;
  publicBaseUrl: string | undefined;
  /** VIAFIDEI_CONFIG_SOURCE as set by the launcher (or "direct"). */
  source: string;
  /** VIAFIDEI_DB_ROUTE as set by the launcher (or "unknown"). */
  route: string;
  databaseUrlFromEnvironment: boolean | null;
  probe: DatabaseProbe;
  /** RAILWAY_ENVIRONMENT_NAME when running under `railway run`. */
  railwayEnvironmentName?: string | undefined;
  /** One-line message the launcher left for the operator (VIAFIDEI_LAUNCHER_MESSAGE). */
  launcherMessage?: string | undefined;
}

export interface LocalConfigPayload {
  source: string;
  databaseUrlFromEnvironment: boolean | null;
  databaseHost: string | null;
  remoteDatabase: boolean;
  route: string;
  database: DatabaseProbe;
  publicBaseUrl: string | null;
  railwayEnvironment: string | null;
  launcherMessage: string | null;
  blockingReason: BlockingReason;
  warnings: string[];
}

/** Host[:port]/database of a connection string — never the credentials. */
export function describeDatabaseHost(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "unparseable";
  }
}

/** Loopback hosts only: a laptop Postgres masquerading as production. */
export function isLocalDatabaseHost(databaseHost: string | null): boolean {
  return (
    databaseHost != null &&
    /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1)(:|\/|$)/i.test(databaseHost)
  );
}

/** Railway's private network resolves nowhere outside Railway. */
export function isRailwayInternalUrl(raw: string | undefined): boolean {
  return !!raw && /\.railway\.internal(:|\/|$)/i.test(raw);
}

const LINK_RECIPE =
  "Run `railway login` and `railway link` in the repository (choose the production environment " +
  "and the web service), then relaunch the app.";

/**
 * Compute the non-sensitive configuration payload shown in the app and the
 * console, plus the single structured reason the worker may not start.
 */
export function computeLocalConfig(input: LocalConfigInput): LocalConfigPayload {
  const raw = input.databaseUrl ?? "";
  const databaseHost = describeDatabaseHost(raw);
  const publicBaseUrl = input.publicBaseUrl || null;
  const internalHost = isRailwayInternalUrl(raw);
  const localDatabase = !internalHost && isLocalDatabaseHost(databaseHost);
  const remoteDatabase = databaseHost != null && !localDatabase && !internalHost;
  const railwayEnvironment = input.railwayEnvironmentName || null;
  const launcherMessage = input.launcherMessage?.trim() || null;

  const warnings: string[] = [];
  let blockingReason: BlockingReason = null;

  if (launcherMessage) warnings.push(launcherMessage);

  if (!databaseHost) {
    blockingReason = "no_db";
    if (input.source === "blocked-local-dotenv") {
      warnings.push(
        "The repository .env points at a LOCAL database, so the launcher refused to use it — " +
          "production (etviafidei.com) would NOT be updated. " +
          LINK_RECIPE +
          " (Set VIAFIDEI_ALLOW_LOCAL_DB=1 only for deliberate local testing.)",
      );
    } else if (input.source === "railway-error") {
      warnings.push(
        "Railway could not supply the configuration (see the launcher message above) — " +
          "no database is configured and the worker cannot start.",
      );
    } else {
      warnings.push(
        "No database configured. Link this checkout to Railway (railway login && railway link) " +
          "so the worker inherits production configuration, or provide a local .env.",
      );
    }
  } else if (internalHost) {
    blockingReason = "internal_host";
    warnings.push(
      `DATABASE_URL points at Railway's private network (${databaseHost}), which this computer cannot reach. ` +
        "Link the Railway project (railway link) so the launcher can resolve the Postgres service's " +
        "DATABASE_PUBLIC_URL, then switch the Admin Worker off and on again.",
    );
  } else if (localDatabase) {
    blockingReason = "local_db";
    warnings.push(
      `The worker is pointed at a LOCAL database (${databaseHost}) — ` +
        "production (etviafidei.com) is NOT being updated. " +
        LINK_RECIPE,
    );
  } else if (!input.probe.reachable) {
    blockingReason = "unreachable";
    warnings.push(
      `The database at ${databaseHost} is not answering: ${input.probe.error ?? "unreachable"}`,
    );
  }

  if (remoteDatabase && !publicBaseUrl) {
    warnings.push(
      railwayEnvironment && railwayEnvironment !== "production"
        ? `Running against the Railway "${railwayEnvironment}" environment with no PUBLIC_BASE_URL — ` +
            "published pages would be verified against http://localhost:3000, not the live site, " +
            "so nothing is guessed. Set PUBLIC_BASE_URL on that Railway environment if verification is wanted."
        : "Connected to a remote database but PUBLIC_BASE_URL is unset — published pages would be " +
            "verified against http://localhost:3000 instead of the live site.",
    );
  }

  return {
    source: input.source,
    databaseUrlFromEnvironment: input.databaseUrlFromEnvironment,
    databaseHost,
    remoteDatabase,
    route: input.route,
    database: input.probe,
    publicBaseUrl,
    railwayEnvironment,
    launcherMessage,
    blockingReason,
    warnings,
  };
}

/**
 * Where published pages are verified. A worker on the production database is
 * working on the production site, so when nothing sets PUBLIC_BASE_URL the
 * canonical origin is the only sensible default — `publicOrigin()` would
 * otherwise fall back to http://localhost:3000 outside NODE_ENV=production.
 *
 * Refuses to guess when `railway run` says the linked environment is NOT
 * production: a staging database with production verification URLs would
 * either fail every probe or, worse, "verify" a staging publish against a
 * production page of the same slug. Returns null then, so the missing-URL
 * warning fires instead. Precedence: explicit PUBLIC_BASE_URL → Railway's
 * public domain (set by the launcher) → canonical URL for a remote database.
 */
export function resolvePublicBaseUrl(input: {
  publicBaseUrl: string | undefined;
  databaseUrl: string | undefined;
  railwayEnvironmentName: string | undefined;
  canonicalUrl: string;
}): string | null {
  if (input.publicBaseUrl) return input.publicBaseUrl;
  const databaseHost = describeDatabaseHost(input.databaseUrl);
  if (
    !databaseHost ||
    isLocalDatabaseHost(databaseHost) ||
    isRailwayInternalUrl(input.databaseUrl)
  ) {
    return null;
  }
  const env = input.railwayEnvironmentName?.trim();
  if (env && env.toLowerCase() !== "production") return null;
  return input.canonicalUrl;
}

/**
 * Lease renewal cadence with ±20% jitter. Two runtimes renewing on an exact
 * 20-second beat over a shared proxy link line up their round-trips; jitter
 * spreads them out and keeps a retry after a blip from landing on the same
 * congested instant.
 */
export function leaseRenewDelayMs(baseMs: number, random: () => number = Math.random): number {
  const spread = baseMs * 0.2;
  return Math.round(baseMs - spread + random() * spread * 2);
}

/**
 * One useful line out of a Prisma/network error. Prisma's first line is the
 * bare "Invalid `prisma.$queryRaw()` invocation:" — the cause ("Can't reach
 * database server at …", "You must provide a nonempty URL …") comes later.
 * Never includes credentials: Prisma quotes hosts, not passwords.
 */
export function summarizeDatabaseError(err: unknown, max = 300): string {
  const message = err instanceof Error ? err.message : String(err);
  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^-->/.test(l) && !/^\d+\s*\|/.test(l));
  const cause = lines.find((l) => !/^Invalid `prisma\./.test(l) && !/^Validation Error/.test(l));
  return (cause ?? lines[0] ?? "database error").replace(/^error:\s*/i, "").slice(0, max);
}

export type WorkerExitKind = "stopped" | "db_unreachable" | "refused" | "crashed";

/**
 * What a worker child's exit means to the supervisor. `scripts/run-worker.ts`
 * exits 4 when it could not read the master switch (database unreachable) and
 * 3 when it was refused (switch OFF / lease held elsewhere). Neither is a
 * crash of the worker itself, and a DB outage in particular must not burn the
 * restart budget: the host waits for the database instead.
 */
export function classifyWorkerExit(
  code: number | null,
  signal: string | null,
  wasStopping: boolean,
): WorkerExitKind {
  if (wasStopping) return "stopped";
  if (code === 4) return "db_unreachable";
  if (code === 3) return "refused";
  void signal;
  return "crashed";
}

/**
 * Parse one line of launcher stdout. The launcher (launch-worker-host.sh)
 * prints exactly one `{"viafideiLauncher":{...}}` JSON line per branch so the
 * app can show where configuration came from — or why it could not — before
 * the host has even started.
 */
export interface LauncherNotice {
  level: "info" | "warn" | "error";
  message: string;
  source: string | null;
  route: string | null;
  environment: string | null;
  service: string | null;
  databaseHost: string | null;
}

export function parseLauncherLine(line: string): LauncherNotice | null {
  if (!line.includes("viafideiLauncher")) return null;
  try {
    const root = JSON.parse(line) as { viafideiLauncher?: Record<string, unknown> };
    const info = root.viafideiLauncher;
    if (!info || typeof info !== "object") return null;
    const str = (key: string): string | null =>
      typeof info[key] === "string" && (info[key] as string).length > 0
        ? (info[key] as string)
        : null;
    const level = str("level");
    return {
      level: level === "error" || level === "warn" ? level : "info",
      message: str("message") ?? "",
      source: str("source"),
      route: str("route"),
      environment: str("environment"),
      service: str("service"),
      databaseHost: str("databaseHost"),
    };
  } catch {
    return null;
  }
}
