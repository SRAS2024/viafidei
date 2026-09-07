/**
 * Pure decisions of the local execution host (src/lib/admin-worker/local-config.ts):
 * the structured blocking reason that gates switching the worker ON, the
 * PUBLIC_BASE_URL guess that must refuse non-production Railway environments,
 * lease-renewal jitter, worker exit classification and the launcher notice
 * line the Swift app parses.
 */
import { describe, expect, it } from "vitest";

import {
  classifyWorkerExit,
  computeLocalConfig,
  describeDatabaseHost,
  isLocalDatabaseHost,
  leaseRenewDelayMs,
  parseLauncherLine,
  resolvePublicBaseUrl,
  type DatabaseProbe,
} from "@/lib/admin-worker/local-config";

const reachable: DatabaseProbe = { reachable: true, latencyMs: 40, error: null, at: "t" };
const unreachable: DatabaseProbe = {
  reachable: false,
  latencyMs: null,
  error: "Can't reach database server",
  at: "t",
};

const PROXY = "postgresql://user:secret@roundhouse.proxy.rlwy.net:12345/railway";

function config(overrides: Partial<Parameters<typeof computeLocalConfig>[0]> = {}) {
  return computeLocalConfig({
    databaseUrl: PROXY,
    publicBaseUrl: "https://etviafidei.com",
    source: "railway",
    route: "railway-public-proxy (Postgres)",
    databaseUrlFromEnvironment: true,
    probe: reachable,
    ...overrides,
  });
}

describe("describeDatabaseHost / isLocalDatabaseHost", () => {
  it("never surfaces credentials", () => {
    expect(describeDatabaseHost(PROXY)).toBe("roundhouse.proxy.rlwy.net:12345/railway");
    expect(describeDatabaseHost("")).toBeNull();
    expect(describeDatabaseHost(undefined)).toBeNull();
    expect(describeDatabaseHost("not a url")).toBe("unparseable");
  });

  it("recognises loopback hosts only", () => {
    expect(isLocalDatabaseHost("localhost:5432/viafidei")).toBe(true);
    expect(isLocalDatabaseHost("127.0.0.1:5432/viafidei")).toBe(true);
    expect(isLocalDatabaseHost("[::1]:5432/viafidei")).toBe(true);
    expect(isLocalDatabaseHost("localhost.example.com/db")).toBe(false);
    expect(isLocalDatabaseHost("roundhouse.proxy.rlwy.net:12345/railway")).toBe(false);
    expect(isLocalDatabaseHost(null)).toBe(false);
  });
});

describe("computeLocalConfig — blocking reason", () => {
  it("is null for a reachable remote database", () => {
    const cfg = config();
    expect(cfg.blockingReason).toBeNull();
    expect(cfg.remoteDatabase).toBe(true);
    expect(cfg.warnings).toEqual([]);
  });

  it("blocks a loopback database (the incident that motivated the gate)", () => {
    const cfg = config({
      databaseUrl: "postgresql://viafidei:viafidei@localhost:5432/viafidei",
      source: "dotenv",
    });
    expect(cfg.blockingReason).toBe("local_db");
    expect(cfg.remoteDatabase).toBe(false);
    expect(cfg.warnings[0]).toMatch(/LOCAL database.*NOT being updated/);
  });

  it("blocks Railway's private network host, which never resolves on a laptop", () => {
    const cfg = config({
      databaseUrl: "postgresql://u:p@postgres.railway.internal:5432/railway",
      route: "railway-internal-unreachable",
    });
    expect(cfg.blockingReason).toBe("internal_host");
    expect(cfg.warnings[0]).toMatch(/private network/);
  });

  it("blocks when no database is configured and explains the launcher's refusal", () => {
    const blocked = config({ databaseUrl: "", source: "blocked-local-dotenv", probe: unreachable });
    expect(blocked.blockingReason).toBe("no_db");
    expect(blocked.databaseHost).toBeNull();
    expect(blocked.warnings.join(" ")).toMatch(/launcher refused/);

    const railwayError = config({
      databaseUrl: undefined,
      source: "railway-error",
      probe: unreachable,
      launcherMessage: "Railway: No service linked.",
    });
    expect(railwayError.blockingReason).toBe("no_db");
    expect(railwayError.launcherMessage).toBe("Railway: No service linked.");
    expect(railwayError.warnings[0]).toBe("Railway: No service linked.");
    expect(railwayError.warnings[1]).toMatch(/Railway could not supply/);
  });

  it("blocks an unreachable remote database with the probe's error", () => {
    const cfg = config({ probe: unreachable });
    expect(cfg.blockingReason).toBe("unreachable");
    expect(cfg.warnings[0]).toMatch(/not answering: Can't reach database server/);
  });

  it("warns (without blocking) when a remote database has no verification origin", () => {
    const cfg = config({ publicBaseUrl: undefined });
    expect(cfg.blockingReason).toBeNull();
    expect(cfg.warnings).toHaveLength(1);
    expect(cfg.warnings[0]).toMatch(/PUBLIC_BASE_URL is unset/);
  });

  it("names the non-production Railway environment in the verification warning", () => {
    const cfg = config({ publicBaseUrl: undefined, railwayEnvironmentName: "staging" });
    expect(cfg.railwayEnvironment).toBe("staging");
    expect(cfg.warnings[0]).toMatch(/"staging" environment.*nothing is guessed/);
  });
});

describe("resolvePublicBaseUrl", () => {
  const canonicalUrl = "https://etviafidei.com";

  it("keeps an explicit PUBLIC_BASE_URL", () => {
    expect(
      resolvePublicBaseUrl({
        publicBaseUrl: "https://viafidei.up.railway.app",
        databaseUrl: PROXY,
        railwayEnvironmentName: "staging",
        canonicalUrl,
      }),
    ).toBe("https://viafidei.up.railway.app");
  });

  it("guesses the canonical origin for a remote database in production (or outside Railway)", () => {
    expect(
      resolvePublicBaseUrl({
        publicBaseUrl: undefined,
        databaseUrl: PROXY,
        railwayEnvironmentName: "production",
        canonicalUrl,
      }),
    ).toBe(canonicalUrl);
    expect(
      resolvePublicBaseUrl({
        publicBaseUrl: undefined,
        databaseUrl: PROXY,
        railwayEnvironmentName: undefined,
        canonicalUrl,
      }),
    ).toBe(canonicalUrl);
  });

  it("refuses to guess for a non-production Railway environment", () => {
    expect(
      resolvePublicBaseUrl({
        publicBaseUrl: undefined,
        databaseUrl: PROXY,
        railwayEnvironmentName: "staging",
        canonicalUrl,
      }),
    ).toBeNull();
  });

  it("never guesses for a local, internal or missing database", () => {
    for (const databaseUrl of [
      "postgresql://u:p@localhost:5432/viafidei",
      "postgresql://u:p@postgres.railway.internal:5432/railway",
      "",
      undefined,
    ]) {
      expect(
        resolvePublicBaseUrl({
          publicBaseUrl: undefined,
          databaseUrl,
          railwayEnvironmentName: undefined,
          canonicalUrl,
        }),
      ).toBeNull();
    }
  });
});

describe("leaseRenewDelayMs", () => {
  it("stays within ±20% of the base interval", () => {
    expect(leaseRenewDelayMs(20_000, () => 0)).toBe(16_000);
    expect(leaseRenewDelayMs(20_000, () => 1)).toBe(24_000);
    expect(leaseRenewDelayMs(20_000, () => 0.5)).toBe(20_000);
    for (let i = 0; i < 50; i += 1) {
      const d = leaseRenewDelayMs(20_000);
      expect(d).toBeGreaterThanOrEqual(16_000);
      expect(d).toBeLessThanOrEqual(24_000);
    }
  });
});

describe("classifyWorkerExit", () => {
  it("maps run-worker exit codes to what the supervisor should do", () => {
    expect(classifyWorkerExit(0, null, true)).toBe("stopped");
    expect(classifyWorkerExit(4, null, false)).toBe("db_unreachable");
    expect(classifyWorkerExit(3, null, false)).toBe("refused");
    expect(classifyWorkerExit(1, null, false)).toBe("crashed");
    expect(classifyWorkerExit(null, "SIGSEGV", false)).toBe("crashed");
    // A deliberate stop wins over any code.
    expect(classifyWorkerExit(4, null, true)).toBe("stopped");
  });
});

describe("parseLauncherLine", () => {
  it("parses the launcher's structured notice and ignores everything else", () => {
    const line = JSON.stringify({
      viafideiLauncher: {
        level: "error",
        message: "Railway: No service linked.",
        source: "railway-error",
        route: "none",
        environment: "",
        service: "",
        databaseHost: "",
      },
    });
    expect(parseLauncherLine(line)).toEqual({
      level: "error",
      message: "Railway: No service linked.",
      source: "railway-error",
      route: "none",
      environment: null,
      service: null,
      databaseHost: null,
    });
    expect(parseLauncherLine("[launcher] plain text")).toBeNull();
    expect(parseLauncherLine('{"viafideiLocalHost":{"port":1}}')).toBeNull();
    expect(parseLauncherLine('{"viafideiLauncher": not json')).toBeNull();
    expect(parseLauncherLine('{"viafideiLauncher":{"level":"bogus","message":"x"}}')?.level).toBe(
      "info",
    );
  });
});
