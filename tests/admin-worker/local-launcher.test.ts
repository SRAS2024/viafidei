/**
 * Behavioural tests for scripts/desktop-app/launch-worker-host.sh.
 *
 * The launcher is copied into a throw-away "project" directory together with
 * its Railway resolver, a stub `railway` CLI is put first on PATH, and the
 * host runner is replaced by a script that records the environment the host
 * would have been started with. Each case asserts the ONE thing that matters:
 * which DATABASE_URL (if any) the host sees, how it was routed, and the
 * structured notice line the app parses.
 */
import { execFile } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

const INTERNAL_URL = "postgresql://u:p@postgres.railway.internal:5432/railway";
const PUBLIC_URL = "postgresql://u:p@roundhouse.proxy.rlwy.net:12345/railway";

const STATUS_JSON = JSON.stringify({
  id: "p1",
  name: "viafidei",
  environments: {
    edges: [
      { node: { id: "env-prod", name: "production" } },
      { node: { id: "env-stg", name: "staging" } },
    ],
  },
  services: {
    edges: [
      {
        node: {
          id: "svc-worker",
          name: "worker",
          serviceInstances: { edges: [{ node: { environmentId: "env-prod" } }] },
        },
      },
      {
        node: {
          id: "svc-pg",
          name: "Postgres",
          serviceInstances: { edges: [{ node: { environmentId: "env-prod" } }] },
        },
      },
      {
        node: {
          id: "svc-web",
          name: "web",
          serviceInstances: { edges: [{ node: { environmentId: "env-prod" } }] },
        },
      },
    ],
  },
});

// A stand-in for the Railway CLI: canned `status --json`, per-service
// `variable list`, and a `run` that injects the private-network DATABASE_URL
// exactly as Railway would before exec'ing the wrapped command.
const RAILWAY_STUB = `#!/bin/bash
echo "$*" >> "$STUB_CALLS"
cmd="$1"; shift
case "$cmd" in
  status)
    if [ "\${STUB_LOGGED_IN:-1}" != "1" ]; then
      echo 'Unauthorized. Please login with \`railway login\`' >&2; exit 1
    fi
    cat "$STUB_STATUS_FILE" ;;
  variable)
    svc=""; env=""
    while [ $# -gt 0 ]; do
      case "$1" in --service) svc="$2"; shift ;; --environment) env="$2"; shift ;; esac
      shift
    done
    [ -n "$env" ] || { echo "stub: --environment missing" >&2; exit 1; }
    case "$svc" in
      Postgres) printf '{"DATABASE_PUBLIC_URL":"%s","DATABASE_URL":"%s"}' "$STUB_PUBLIC_URL" "$STUB_INTERNAL_URL" ;;
      web)
        if [ "\${STUB_WEB_NO_SECRETS:-0}" = "1" ]; then printf '{"DATABASE_URL":"%s"}' "$STUB_INTERNAL_URL"
        else printf '{"SESSION_SECRET":"s","ADMIN_USERNAME":"a","DATABASE_URL":"%s"}' "$STUB_INTERNAL_URL"; fi ;;
      *) printf '{"FOO":"bar"}' ;;
    esac ;;
  run)
    svc=""; env=""
    while [ $# -gt 0 ]; do
      case "$1" in --service) svc="$2"; shift ;; --environment) env="$2"; shift ;; --) shift; break ;; esac
      shift
    done
    [ -n "$svc" ] || { echo 'No service linked. Please either specify a service with the --service flag or link one with \`railway service\`' >&2; exit 1; }
    if [ "\${STUB_RUN_FAIL:-0}" = "1" ]; then echo "stub: run refused for $svc" >&2; exit 1; fi
    export DATABASE_URL="$STUB_INTERNAL_URL"
    export SESSION_SECRET="s"
    export RAILWAY_ENVIRONMENT_NAME="$env"
    export RAILWAY_SERVICE_NAME="$svc"
    export RAILWAY_PUBLIC_DOMAIN="viafidei.up.railway.app"
    export PRISMA_CONNECTION_LIMIT="10"
    exec "$@" ;;
  *) echo "stub: unknown command $cmd" >&2; exit 1 ;;
esac
`;

// Stands in for `tsx scripts/local-worker-host.ts`: dumps the environment.
const HOST_STUB = `#!/bin/bash
env > "$STUB_ENV_OUT"
echo "STUB_ARGS=$*" >> "$STUB_ENV_OUT"
`;

let work: string;
let project: string;
let bin: string;
let home: string;

function envFileOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

interface LaunchResult {
  hostEnv: Record<string, string>;
  notice: Record<string, unknown> | null;
  calls: string[];
  stdout: string;
  stderr: string;
  code: number;
}

async function launch(opts: {
  env?: Record<string, string>;
  dotenv?: string;
  linkFile?: boolean;
}): Promise<LaunchResult> {
  const caseDir = mkdtempSync(path.join(work, "case-"));
  const envOut = path.join(caseDir, "host.env");
  const calls = path.join(caseDir, "calls.log");
  const statusFile = path.join(caseDir, "status.json");
  writeFileSync(statusFile, STATUS_JSON);
  writeFileSync(calls, "");

  if (opts.dotenv != null) writeFileSync(path.join(project, ".env"), opts.dotenv);
  else rmSync(path.join(project, ".env"), { force: true });

  const railwayDir = path.join(home, ".railway");
  rmSync(railwayDir, { recursive: true, force: true });
  if (opts.linkFile !== false) {
    mkdirSync(railwayDir, { recursive: true });
    writeFileSync(
      path.join(railwayDir, "config.json"),
      JSON.stringify({
        projects: {
          [project]: {
            project: "p1",
            environment: "env-prod",
            environmentName: "production",
            service: "svc-web",
          },
        },
      }),
    );
  }

  // The unit-test setup exports DATABASE_URL for the suite; the launcher must
  // start from a clean slate unless a case deliberately sets it.
  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    HOME: home,
    STUB_CALLS: calls,
    STUB_STATUS_FILE: statusFile,
    STUB_PUBLIC_URL: PUBLIC_URL,
    STUB_INTERNAL_URL: INTERNAL_URL,
    STUB_ENV_OUT: envOut,
    VIAFIDEI_HOST_RUNNER: path.join(bin, "host-stub"),
    VIAFIDEI_LAUNCHER_LOG: path.join(caseDir, "launcher.log"),
    ...(opts.env ?? {}),
  };
  for (const key of [
    "DATABASE_URL",
    "PUBLIC_BASE_URL",
    "PRISMA_CONNECTION_LIMIT",
    "VIAFIDEI_ALLOW_LOCAL_DB",
    "VIAFIDEI_RAILWAY_SERVICE",
    "VIAFIDEI_RAILWAY_ENVIRONMENT",
    "INTELLIGENCE_PYTHON",
  ]) {
    if (!(key in (opts.env ?? {}))) delete childEnv[key];
  }

  let stdout = "";
  let stderr = "";
  let code = 0;
  try {
    const out = await execFileAsync(
      "/bin/bash",
      [path.join(project, "scripts/desktop-app/launch-worker-host.sh"), "--watch-parent"],
      { env: childEnv, cwd: project, timeout: 30_000 },
    );
    stdout = out.stdout;
    stderr = out.stderr;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
    code = typeof e.code === "number" ? e.code : 1;
  }
  const noticeLine = stdout.split("\n").find((l) => l.includes("viafideiLauncher"));
  const notice = noticeLine
    ? ((JSON.parse(noticeLine) as { viafideiLauncher: Record<string, unknown> }).viafideiLauncher ??
      null)
    : null;
  let hostEnv: Record<string, string> = {};
  try {
    hostEnv = envFileOf(readFileSync(envOut, "utf8"));
  } catch {
    /* the host was not started */
  }
  return {
    hostEnv,
    notice,
    calls: readFileSync(calls, "utf8").split("\n").filter(Boolean),
    stdout,
    stderr,
    code,
  };
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "viafidei-launcher-"));
  project = path.join(work, "project");
  bin = path.join(work, "bin");
  home = path.join(work, "home");
  mkdirSync(path.join(project, "scripts/desktop-app"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  for (const file of ["launch-worker-host.sh", "railway-public-db-url.mjs"]) {
    cpSync(
      path.join(ROOT, "scripts/desktop-app", file),
      path.join(project, "scripts/desktop-app", file),
    );
  }
  writeFileSync(path.join(bin, "railway"), RAILWAY_STUB);
  chmodSync(path.join(bin, "railway"), 0o755);
  writeFileSync(path.join(bin, "host-stub"), HOST_STUB);
  chmodSync(path.join(bin, "host-stub"), 0o755);
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("launch-worker-host.sh — Railway branch", () => {
  it("resolves the web service + environment explicitly and swaps the public Postgres URL in memory", async () => {
    const r = await launch({ dotenv: "DATABASE_URL=postgresql://x:y@localhost:5432/viafidei\n" });
    expect(r.code).toBe(0);
    expect(r.hostEnv.STUB_ARGS).toBe("scripts/local-worker-host.ts --watch-parent");
    // The private-network URL Railway injected was replaced by the proxy URL.
    expect(r.hostEnv.DATABASE_URL).toBe(PUBLIC_URL);
    expect(r.hostEnv.VIAFIDEI_DB_ROUTE).toBe("railway-public-proxy (Postgres)");
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("railway");
    expect(r.hostEnv.VIAFIDEI_DB_FROM_ENV).toBe("1");
    // Verification origin restored from Railway's public domain.
    expect(r.hostEnv.PUBLIC_BASE_URL).toBe("https://viafidei.up.railway.app");
    expect(r.hostEnv.RAILWAY_ENVIRONMENT_NAME).toBe("production");
    // The supervisor keeps a small pool even though the service variable says 10.
    expect(r.hostEnv.PRISMA_CONNECTION_LIMIT).toBe("3");
    // `railway run` was given the service AND environment, after a dry run.
    const runs = r.calls.filter((c) => c.startsWith("run "));
    expect(runs).toHaveLength(2);
    expect(runs[0]).toBe("run --service web --environment production -- /usr/bin/true");
    expect(runs[1]).toMatch(/^run --service web --environment production -- bash -c /);
    // Variable lookups were scoped to the linked environment.
    for (const call of r.calls.filter((c) => c.startsWith("variable"))) {
      expect(call).toContain("--environment production");
    }
    // The notice line the app parses.
    expect(r.notice).toMatchObject({
      level: "info",
      source: "railway",
      route: "railway-public-proxy (Postgres)",
      environment: "production",
      service: "web",
      databaseHost: "roundhouse.proxy.rlwy.net:12345/railway",
    });
    // The public URL (credentials) never appears on stdout.
    expect(r.stdout).not.toContain("u:p@");
  });

  it("honours VIAFIDEI_RAILWAY_SERVICE without probing for secrets", async () => {
    const r = await launch({ env: { VIAFIDEI_RAILWAY_SERVICE: "worker" } });
    expect(r.hostEnv.DATABASE_URL).toBe(PUBLIC_URL);
    expect(r.calls.filter((c) => c.startsWith("run "))[0]).toBe(
      "run --service worker --environment production -- /usr/bin/true",
    );
    expect(r.calls.some((c) => c.startsWith("variable") && c.includes("--service web"))).toBe(
      false,
    );
  });

  it("starts the host UNCONFIGURED (not against .env) when `railway run` fails, and says why", async () => {
    const r = await launch({
      env: { STUB_RUN_FAIL: "1" },
      dotenv: "DATABASE_URL=postgresql://x:y@localhost:5432/viafidei\n",
    });
    expect(r.hostEnv.STUB_ARGS).toBe("scripts/local-worker-host.ts --watch-parent");
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("railway-error");
    expect(r.hostEnv.VIAFIDEI_DB_ROUTE).toBe("none");
    // Empty, not absent: an empty value stops Prisma loading .env itself.
    expect(r.hostEnv.DATABASE_URL).toBe("");
    expect(r.hostEnv.VIAFIDEI_LAUNCHER_MESSAGE).toMatch(
      /railway run --service "web".*stub: run refused/,
    );
    expect(r.notice).toMatchObject({ level: "error", source: "railway-error", route: "none" });
    expect(String(r.notice?.message)).toMatch(/^Railway: /);
    expect(r.calls.filter((c) => c.startsWith("run ")).length).toBe(1);
  });

  it("refuses to guess when no service carries the app's secrets", async () => {
    const r = await launch({ env: { STUB_WEB_NO_SECRETS: "1" }, linkFile: false });
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("railway-error");
    expect(r.hostEnv.DATABASE_URL).toBe("");
    expect(String(r.notice?.message)).toMatch(
      /SESSION_SECRET\/ADMIN_USERNAME.*VIAFIDEI_RAILWAY_SERVICE/,
    );
    expect(r.calls.some((c) => c.startsWith("run "))).toBe(false);
  });
});

describe("launch-worker-host.sh — no Railway link (.env fallback)", () => {
  it("blocks a loopback database from .env and starts the host with no database", async () => {
    const r = await launch({
      env: { STUB_LOGGED_IN: "0" },
      dotenv: 'DATABASE_URL="postgresql://viafidei:viafidei@localhost:5432/viafidei"\n',
      linkFile: false,
    });
    expect(r.hostEnv.STUB_ARGS).toBe("scripts/local-worker-host.ts --watch-parent");
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("blocked-local-dotenv");
    expect(r.hostEnv.VIAFIDEI_DB_ROUTE).toBe("blocked-local");
    expect(r.hostEnv.DATABASE_URL).toBe("");
    expect(r.hostEnv.VIAFIDEI_DB_FROM_ENV).toBe("0");
    expect(r.notice).toMatchObject({
      level: "error",
      source: "blocked-local-dotenv",
      databaseHost: "localhost:5432/viafidei",
    });
    expect(String(r.notice?.message)).toMatch(/not linked.*Refusing the LOCAL database/);
    // The launcher never ran `railway run` without a resolved service.
    expect(r.calls.some((c) => c.startsWith("run "))).toBe(false);
  });

  it("allows the loopback database only with VIAFIDEI_ALLOW_LOCAL_DB=1", async () => {
    const r = await launch({
      env: { STUB_LOGGED_IN: "0", VIAFIDEI_ALLOW_LOCAL_DB: "1" },
      dotenv: "DATABASE_URL=postgresql://viafidei:viafidei@127.0.0.1:5432/viafidei\n",
      linkFile: false,
    });
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("dotenv");
    expect(r.hostEnv.VIAFIDEI_DB_ROUTE).toBe("dotenv");
    // Left for Prisma to load from .env — the launcher does not copy it.
    expect(r.hostEnv.DATABASE_URL).toBeUndefined();
    expect(r.hostEnv.VIAFIDEI_DB_FROM_ENV).toBe("0");
    expect(r.notice).toMatchObject({ level: "warn", source: "dotenv", route: "dotenv" });
    expect(r.notice?.databaseHost).toBe("127.0.0.1:5432/viafidei");
  });

  it("passes a remote .env database through and names its host (never the credentials)", async () => {
    const r = await launch({
      env: { STUB_LOGGED_IN: "0" },
      dotenv: `DATABASE_URL=${PUBLIC_URL}\n`,
      linkFile: false,
    });
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("dotenv");
    expect(r.hostEnv.DATABASE_URL).toBeUndefined();
    expect(r.notice?.databaseHost).toBe("roundhouse.proxy.rlwy.net:12345/railway");
    expect(r.stdout).not.toContain("u:p@");
  });

  it("blocks a loopback DATABASE_URL that was already in the environment", async () => {
    const r = await launch({
      env: { STUB_LOGGED_IN: "0", DATABASE_URL: "postgresql://a:b@localhost:5432/x" },
      linkFile: false,
    });
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("blocked-local-dotenv");
    expect(r.hostEnv.DATABASE_URL).toBe("");
    expect(String(r.notice?.message)).toMatch(/LOCAL database in the environment/);
  });

  it("reports the absence of any DATABASE_URL", async () => {
    const r = await launch({ env: { STUB_LOGGED_IN: "0" }, linkFile: false });
    expect(r.hostEnv.VIAFIDEI_CONFIG_SOURCE).toBe("dotenv");
    expect(r.hostEnv.VIAFIDEI_DB_ROUTE).toBe("none");
    expect(r.notice).toMatchObject({ level: "error" });
    expect(String(r.notice?.message)).toMatch(/No DATABASE_URL/);
  });
});

describe("launch-worker-host.sh — process defaults", () => {
  it("pins the supervisor pool and defaults the brain's Python only when the Homebrew 3.11 exists", async () => {
    const r = await launch({ env: { STUB_LOGGED_IN: "0" }, linkFile: false });
    expect(r.hostEnv.PRISMA_CONNECTION_LIMIT).toBe("3");
    const brewPython = "/opt/homebrew/opt/python@3.11/bin/python3.11";
    let exists = false;
    try {
      readFileSync(brewPython);
      exists = true;
    } catch {
      exists = false;
    }
    if (exists) expect(r.hostEnv.INTELLIGENCE_PYTHON).toBe(brewPython);
    else expect(r.hostEnv.INTELLIGENCE_PYTHON).toBeUndefined();
  });

  it("respects an INTELLIGENCE_PYTHON and PRISMA_CONNECTION_LIMIT already set by the operator", async () => {
    const r = await launch({
      env: {
        STUB_LOGGED_IN: "0",
        INTELLIGENCE_PYTHON: "/custom/python",
        PRISMA_CONNECTION_LIMIT: "5",
      },
      linkFile: false,
    });
    expect(r.hostEnv.INTELLIGENCE_PYTHON).toBe("/custom/python");
    expect(r.hostEnv.PRISMA_CONNECTION_LIMIT).toBe("5");
  });
});
