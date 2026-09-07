/**
 * The local Admin Worker launcher must connect the operator's Mac to the
 * PRODUCTION database, never silently to a laptop Postgres.
 *
 * Inside Railway every service reaches Postgres over the private network
 * (`postgres.railway.internal`), a hostname that resolves nowhere else. A worker
 * on a laptop that inherited it would connect to nothing — and with the
 * repository .env pointing at localhost it would "publish" into a local
 * database while every dashboard reported success (exactly what happened
 * before this launcher rewrite).
 *
 * The BEHAVIOUR is exercised in local-launcher.test.ts (a stub `railway` on
 * PATH) and local-config.test.ts (the blocking rules). What remains here are
 * the few source-level invariants that no behavioural test can pin: that the
 * secret never reaches stdout or disk, and that the host gates on the
 * structured `blockingReason` rather than on warning prose.
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

describe("local Admin Worker launcher — source invariants", () => {
  it("runs under `railway run` with an explicit service AND environment", () => {
    expect(launcher).toMatch(
      /exec railway run --service "\$RW_WEB" --environment "\$RW_ENV" -- bash -c/,
    );
    expect(launcher).toContain('VIAFIDEI_CONFIG_SOURCE="railway"');
  });

  it("keeps the resolved public URL in memory only — never on stdout or disk", () => {
    expect(launcher).toContain('export DATABASE_URL="$DATABASE_PUBLIC_URL"');
    expect(launcher).toContain('export DATABASE_URL="$VIAFIDEI_DB_PUBLIC_URL"');
    expect(launcher).not.toMatch(
      />\s*\.env|tee\s|echo\s+"?\$VIAFIDEI_DB_PUBLIC_URL|echo\s+"?\$RW_PUBLIC_URL/,
    );
    // The notice line carries the database HOST only.
    expect(launcher).toContain('"databaseHost":"%s"');
  });

  it("forbids the .env fallback with an EMPTY DATABASE_URL (Prisma treats present-but-empty as set)", () => {
    expect(launcher).toContain('export DATABASE_URL=""');
    expect(launcher).toContain("VIAFIDEI_ALLOW_LOCAL_DB");
    expect(launcher).toContain('"blocked-local-dotenv"');
    expect(launcher).toContain('"railway-error"');
  });

  it("helper prints ONE JSON object and uses bounded, environment-scoped CLI calls", () => {
    expect(helper).toContain("CLI_TIMEOUT_MS = 15_000");
    expect(helper).toContain('"--environment"');
    expect(helper).toContain("DATABASE_PUBLIC_URL");
    expect(helper).toContain("SESSION_SECRET");
    expect(helper).toContain("VIAFIDEI_RAILWAY_SERVICE");
    expect(helper).toContain("/usr/bin/true");
    expect(helper).toMatch(/process\.stdout\.write\(`\$\{JSON\.stringify\(result\)\}\\n`\)/);
    expect(helper).not.toMatch(/process\.stdout\.write\(url\)/);
  });
});

describe("local host — database preflight", () => {
  it("gates switching ON and resuming on the structured blockingReason, not on warning text", () => {
    expect(host).toContain("async function probeDatabase(");
    expect(host).toContain('case "POST /api/switch"');
    expect(host).toContain('error: "database_unavailable"');
    expect(host).toContain("cfg.blockingReason || !probe.reachable");
    expect(host).toContain("bootConfig.blockingReason || !bootConfig.database.reachable");
    expect(host).not.toMatch(/private network\|LOCAL database\|No database\|not answering/);
  });

  it("stops the local tree BEFORE recording OFF, and bounds every shutdown database call", () => {
    const off = host.indexOf('await stopWorkerChild("master switch OFF")');
    const durable = host.indexOf("await writeDurableOff(body.actor");
    expect(off).toBeGreaterThan(0);
    expect(durable).toBeGreaterThan(off);
    expect(host).toContain("SHUTDOWN_DB_BUDGET_MS = 3_000");
    expect(host).toContain("CHILD_KILL_GRACE_MS = 5_000");
  });

  it("resolves the verification origin through local-config (no guess for non-production)", () => {
    expect(host).toContain("function ensurePublicBaseUrl(");
    expect(host).toContain("resolvePublicBaseUrl({");
    expect(host).toContain("railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME");
  });
});
