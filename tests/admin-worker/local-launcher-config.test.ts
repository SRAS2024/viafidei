/**
 * The local Admin Worker launcher must connect the operator's Mac to the
 * PRODUCTION database, never silently to a laptop Postgres.
 *
 * Inside Railway every service reaches Postgres over the private network
 * (`postgres.railway.internal`), a hostname that resolves nowhere else. A worker
 * on a laptop that inherited it would connect to nothing — and with the
 * repository .env pointing at localhost it would "publish" into a local
 * database while every dashboard reported success (exactly what happened
 * before this launcher rewrite). These are offline invariants on the launcher
 * and its helper so that regression cannot come back quietly.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const launcher = readFileSync(path.join(ROOT, "scripts/desktop-app/launch-worker-host.sh"), "utf8");
const helper = readFileSync(
  path.join(ROOT, "scripts/desktop-app/railway-public-db-url.mjs"),
  "utf8",
);
const host = readFileSync(path.join(ROOT, "scripts/local-worker-host.ts"), "utf8");

describe("local Admin Worker launcher — Railway configuration", () => {
  it("runs under `railway run` when the checkout is linked and falls back to .env otherwise", () => {
    expect(launcher).toContain("railway status");
    expect(launcher).toContain("exec railway run --");
    expect(launcher).toContain('VIAFIDEI_CONFIG_SOURCE="railway"');
    expect(launcher).toContain('VIAFIDEI_CONFIG_SOURCE="dotenv"');
  });

  it("swaps Railway's private-network DATABASE_URL for the public proxy URL in memory", () => {
    expect(launcher).toContain("railway-public-db-url.mjs");
    expect(launcher).toContain("*.railway.internal*");
    expect(launcher).toContain('export DATABASE_URL="$DATABASE_PUBLIC_URL"');
    expect(launcher).toContain('export DATABASE_URL="$VIAFIDEI_DB_PUBLIC_URL"');
    // The resolved secret lives only in the process environment.
    expect(launcher).not.toMatch(/>\s*\.env|tee\s|echo\s+"?\$VIAFIDEI_DB_PUBLIC_URL/);
  });

  it("records how the database was reached so the console can show it", () => {
    for (const route of [
      "railway-public-proxy",
      "railway-internal-unreachable",
      "railway-service-variable",
      "dotenv",
    ]) {
      expect(launcher).toContain(`VIAFIDEI_DB_ROUTE="${route}`);
    }
  });

  it("helper prints only the public URL to stdout and reports failure with a distinct exit code", () => {
    expect(helper).toContain("DATABASE_PUBLIC_URL");
    expect(helper).toContain('railway(["status", "--json"])');
    expect(helper).toContain('"variable", "list", "--service"');
    expect(helper).toContain("process.stdout.write(url)");
    expect(helper).toContain("process.exit(2)");
    expect(helper).toContain("process.exit(3)");
  });
});

describe("local host — database preflight", () => {
  it("probes the database before switching the worker on and refuses when it is not production", () => {
    expect(host).toContain("async function probeDatabase(");
    expect(host).toContain('case "POST /api/switch"');
    expect(host).toContain('error: "database_unavailable"');
    expect(host).toMatch(
      /LOCAL database[\s\S]*production \(etviafidei\.com\) is NOT being updated/,
    );
    expect(host).toContain("private network");
  });

  it("verifies published pages against the canonical site when connected to a remote database", () => {
    expect(host).toContain("function ensurePublicBaseUrl(");
    expect(host).toContain("appConfig.canonicalUrl");
  });
});
